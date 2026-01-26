//! RQL Query Executor
//!
//! Executes parsed RQL queries against the NodeStore.
//!
//! # Execution Methods
//!
//! - `execute_rql()` - Basic execution for filter-only queries
//! - `execute_rql_with_search()` - Execution with BM25 full-text search support
//! - `execute_rql_async()` - Async execution with REASON (LLM semantic search)

use std::collections::HashSet;
use std::sync::Arc;

use crate::engine::{SearchConfig, SearchEngine};
use crate::error::Result;
use crate::llm::ReasoningEngine;
use crate::model::{Document, NodeId};
use crate::store::NodeStore;
use crate::text_index::TextIndex;

use super::ast::*;

/// Result of executing a query.
#[derive(Debug, Clone)]
pub struct QueryResult {
    /// Matched documents (for regular SELECT queries)
    pub documents: Vec<DocumentMatch>,
    /// Total count (before pagination)
    pub total_count: usize,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
    /// Query execution statistics
    pub stats: QueryStats,
    /// Aggregate results (for COUNT/SUM/AVG/etc. queries)
    pub aggregates: Option<Vec<AggregateResult>>,
    /// Query plan (for EXPLAIN queries)
    pub explain: Option<QueryPlan>,
}

/// Result of an aggregate function
#[derive(Debug, Clone)]
pub struct AggregateResult {
    /// Alias or function name
    pub name: String,
    /// Computed value
    pub value: AggregateValue,
    /// Group key (for GROUP BY queries)
    pub group_key: Option<Vec<(String, serde_json::Value)>>,
}

/// Value types for aggregate results
#[derive(Debug, Clone)]
pub enum AggregateValue {
    /// Integer count
    Count(usize),
    /// Floating point sum/avg/min/max
    Float(f64),
    /// Null (when no rows match)
    Null,
}

/// Query execution plan (for EXPLAIN)
#[derive(Debug, Clone)]
pub struct QueryPlan {
    /// Steps in the execution plan
    pub steps: Vec<PlanStep>,
    /// Estimated row count
    pub estimated_rows: usize,
    /// Indexes that would be used
    pub indexes_used: Vec<String>,
}

/// A single step in the query plan
#[derive(Debug, Clone)]
pub struct PlanStep {
    /// Step type (e.g., "TableScan", "IndexScan", "Filter", "Aggregate")
    pub step_type: String,
    /// Description of what this step does
    pub description: String,
    /// Estimated cost (0-100)
    pub estimated_cost: u32,
}

/// Query execution statistics for analysis and optimization.
#[derive(Debug, Clone, Default)]
pub struct QueryStats {
    /// Index used for initial filtering
    pub index_used: Option<String>,
    /// Total rows scanned
    pub rows_scanned: usize,
    /// Rows returned after filtering
    pub rows_returned: usize,
    /// Whether SEARCH clause was executed
    pub search_executed: bool,
    /// Whether REASON clause was executed
    pub reason_executed: bool,
    /// Number of LLM calls made (for REASON)
    pub llm_calls: usize,
}

/// A document match with relevance info.
#[derive(Debug, Clone)]
pub struct DocumentMatch {
    /// The matched document
    pub document: Document,
    /// Relevance score (for search queries)
    pub score: Option<f32>,
    /// Nodes that matched the query
    pub matched_nodes: Vec<NodeId>,
    /// Highlighted text snippets
    pub highlights: Vec<String>,
    /// LLM-extracted answer (for REASON queries)
    pub answer: Option<String>,
    /// Confidence score from LLM (for REASON queries)
    pub confidence: Option<f32>,
}

impl NodeStore {
    /// Execute an RQL query.
    ///
    /// The table name in the FROM clause can be:
    /// - Table ID (e.g., "tbl_abc123")
    /// - Table slug (e.g., "legal_contracts")
    /// - Table display name (e.g., "Legal Contracts")
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use reasondb_core::{NodeStore, rql::Query};
    ///
    /// let store = NodeStore::open("./test.db").unwrap();
    /// let query = Query::parse("SELECT * FROM legal_contracts WHERE author = 'Alice'").unwrap();
    /// let result = store.execute_rql(&query).unwrap();
    /// ```
    pub fn execute_rql(&self, query: &Query) -> Result<QueryResult> {
        let start = std::time::Instant::now();

        // Resolve table name to ID
        let table_id = self.resolve_table_id(&query.from.table)?;

        // Convert query to search filter with resolved table ID
        let mut filter = query.to_search_filter();
        filter.table_id = Some(table_id.clone());

        // Find documents using existing infrastructure
        let documents = self.find_documents(&filter)?;

        // Apply additional filtering from WHERE clause
        let filtered = if let Some(ref where_clause) = query.where_clause {
            documents
                .into_iter()
                .filter(|doc| self.matches_condition(doc, &where_clause.condition))
                .collect()
        } else {
            documents
        };

        // Sort if ORDER BY specified
        let mut sorted = filtered;
        if let Some(ref order_by) = query.order_by {
            self.sort_documents(&mut sorted, order_by);
        }

        // Get total count before pagination
        let total_count = sorted.len();

        // Handle EXPLAIN (before pagination)
        if query.explain {
            let stats = QueryStats {
                index_used: Some("idx_table_docs".to_string()),
                rows_scanned: total_count,
                rows_returned: 0,
                search_executed: query.search.is_some(),
                reason_executed: query.reason.is_some(),
                llm_calls: 0,
            };
            let plan = self.build_query_plan(query, &table_id);
            return Ok(QueryResult {
                documents: Vec::new(),
                total_count: 0,
                execution_time_ms: start.elapsed().as_millis() as u64,
                stats,
                aggregates: None,
                explain: Some(plan),
            });
        }

        // Handle aggregates (on all filtered/sorted documents, before pagination)
        if let SelectClause::Aggregates(ref aggs) = query.select {
            // Convert sorted to DocumentMatch for aggregation (no pagination for aggregates)
            let all_matches: Vec<DocumentMatch> = sorted
                .into_iter()
                .map(|doc| DocumentMatch {
                    document: doc,
                    score: None,
                    matched_nodes: Vec::new(),
                    highlights: Vec::new(),
                    answer: None,
                    confidence: None,
                })
                .collect();
            let stats = QueryStats {
                index_used: Some("idx_table_docs".to_string()),
                rows_scanned: total_count,
                rows_returned: all_matches.len(),
                search_executed: query.search.is_some(),
                reason_executed: query.reason.is_some(),
                llm_calls: 0,
            };
            let aggregates = self.compute_aggregates(&all_matches, aggs, query.group_by.as_ref());
            return Ok(QueryResult {
                documents: Vec::new(),
                total_count,
                execution_time_ms: start.elapsed().as_millis() as u64,
                stats,
                aggregates: Some(aggregates),
                explain: None,
            });
        }

        // Apply pagination for regular queries
        let paginated: Vec<Document> = if let Some(ref limit) = query.limit {
            let offset = limit.offset.unwrap_or(0);
            sorted.into_iter().skip(offset).take(limit.count).collect()
        } else {
            sorted
        };

        // Convert to DocumentMatch for regular queries
        let matches: Vec<DocumentMatch> = paginated
            .into_iter()
            .map(|doc| DocumentMatch {
                document: doc,
                score: None,
                matched_nodes: Vec::new(),
                highlights: Vec::new(),
                answer: None,
                confidence: None,
            })
            .collect();

        // Build stats
        let stats = QueryStats {
            index_used: Some("idx_table_docs".to_string()),
            rows_scanned: total_count,
            rows_returned: matches.len(),
            search_executed: query.search.is_some(),
            reason_executed: query.reason.is_some(),
            llm_calls: 0,
        };

        Ok(QueryResult {
            documents: matches,
            total_count,
            execution_time_ms: start.elapsed().as_millis() as u64,
            stats,
            aggregates: None,
            explain: None,
        })
    }

    /// Execute an RQL query with full-text search support.
    ///
    /// This method supports the SEARCH clause using BM25 ranking.
    ///
    /// # Arguments
    ///
    /// * `query` - The parsed RQL query
    /// * `text_index` - Optional TextIndex for BM25 search
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use reasondb_core::{NodeStore, TextIndex, rql::Query};
    ///
    /// let store = NodeStore::open("./test.db").unwrap();
    /// let text_index = TextIndex::open("./search_index").unwrap();
    /// let query = Query::parse("SELECT * FROM legal_contracts SEARCH 'payment terms'").unwrap();
    /// let result = store.execute_rql_with_search(&query, Some(&text_index)).unwrap();
    /// ```
    pub fn execute_rql_with_search(
        &self,
        query: &Query,
        text_index: Option<&TextIndex>,
    ) -> Result<QueryResult> {
        let start = std::time::Instant::now();

        // Resolve table name to ID
        let table_id = self.resolve_table_id(&query.from.table)?;

        // Check if we have a SEARCH clause and a text index
        let search_results = if let (Some(ref search_clause), Some(index)) =
            (&query.search, text_index)
        {
            // Execute BM25 search
            let results = index.search(&search_clause.query, 1000, Some(&table_id))?;
            Some(results)
        } else {
            None
        };

        // Get documents either from search results or filter
        let documents = if let Some(ref search_hits) = search_results {
            // Get documents from search results, preserving BM25 order
            let mut docs = Vec::new();
            let seen: HashSet<String> = HashSet::new();
            for hit in search_hits {
                if seen.contains(&hit.document_id) {
                    continue;
                }
                if let Ok(Some(doc)) = self.get_document(&hit.document_id) {
                    docs.push((doc, hit.score, hit.snippet.clone()));
                }
            }
            docs
        } else {
            // Fall back to filter-based search
            let mut filter = query.to_search_filter();
            filter.table_id = Some(table_id.clone());
            let docs = self.find_documents(&filter)?;
            docs.into_iter().map(|d| (d, 0.0, None)).collect()
        };

        // Apply additional WHERE filtering
        let filtered: Vec<(Document, f32, Option<String>)> = if let Some(ref where_clause) = query.where_clause {
            documents
                .into_iter()
                .filter(|(doc, _, _)| self.matches_condition(doc, &where_clause.condition))
                .collect()
        } else {
            documents
        };

        // Sort - use BM25 score if search, otherwise by field
        let mut sorted = filtered;
        if search_results.is_none() {
            if let Some(ref order_by) = query.order_by {
                sorted.sort_by(|(a, _, _), (b, _, _)| {
                    let field = order_by.field.first_field().unwrap_or("");
                    let cmp = match field {
                        "title" => a.title.cmp(&b.title),
                        "created_at" => a.created_at.cmp(&b.created_at),
                        "updated_at" => a.updated_at.cmp(&b.updated_at),
                        "author" => a.author.cmp(&b.author),
                        _ => std::cmp::Ordering::Equal,
                    };
                    if order_by.direction == SortDirection::Desc {
                        cmp.reverse()
                    } else {
                        cmp
                    }
                });
            }
        }
        // BM25 results are already sorted by relevance (desc)

        // Get total count before pagination
        let total_count = sorted.len();

        // Apply pagination
        let paginated: Vec<(Document, f32, Option<String>)> = if let Some(ref limit) = query.limit {
            let offset = limit.offset.unwrap_or(0);
            sorted.into_iter().skip(offset).take(limit.count).collect()
        } else {
            sorted
        };

        // Convert to DocumentMatch with scores and highlights
        let matches: Vec<DocumentMatch> = paginated
            .into_iter()
            .map(|(doc, score, snippet)| DocumentMatch {
                document: doc,
                score: if search_results.is_some() {
                    Some(score)
                } else {
                    None
                },
                matched_nodes: Vec::new(),
                highlights: snippet.into_iter().collect(),
                answer: None,
                confidence: None,
            })
            .collect();

        // Build stats
        let stats = QueryStats {
            index_used: if search_results.is_some() {
                Some("bm25_full_text".to_string())
            } else {
                Some("idx_table_docs".to_string())
            },
            rows_scanned: total_count,
            rows_returned: matches.len(),
            search_executed: search_results.is_some(),
            reason_executed: query.reason.is_some(),
            llm_calls: 0,
        };

        // Handle EXPLAIN
        if query.explain {
            let plan = self.build_query_plan(query, &table_id);
            return Ok(QueryResult {
                documents: Vec::new(),
                total_count: 0,
                execution_time_ms: start.elapsed().as_millis() as u64,
                stats,
                aggregates: None,
                explain: Some(plan),
            });
        }

        // Handle aggregates
        if let SelectClause::Aggregates(ref aggs) = query.select {
            let aggregates = self.compute_aggregates(&matches, aggs, query.group_by.as_ref());
            return Ok(QueryResult {
                documents: Vec::new(),
                total_count,
                execution_time_ms: start.elapsed().as_millis() as u64,
                stats,
                aggregates: Some(aggregates),
                explain: None,
            });
        }

        Ok(QueryResult {
            documents: matches,
            total_count,
            execution_time_ms: start.elapsed().as_millis() as u64,
            stats,
            aggregates: None,
            explain: None,
        })
    }

    /// Execute an RQL query with full async support (SEARCH + REASON).
    ///
    /// This method supports:
    /// - SEARCH clause: BM25 full-text search
    /// - REASON clause: LLM-powered semantic search with answer extraction
    ///
    /// # Arguments
    ///
    /// * `query` - The parsed RQL query
    /// * `text_index` - Optional TextIndex for BM25 search
    /// * `reasoner` - The reasoning engine for REASON queries
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use reasondb_core::{NodeStore, TextIndex, rql::Query};
    /// use reasondb_core::llm::MockReasoner;
    /// use std::sync::Arc;
    ///
    /// async fn example() {
    ///     let store = Arc::new(NodeStore::open("./test.db").unwrap());
    ///     let text_index = TextIndex::open("./search_index").unwrap();
    ///     let reasoner = Arc::new(MockReasoner::new());
    ///     let query = Query::parse("SELECT * FROM legal REASON 'What are the penalties?'").unwrap();
    ///     let result = store.execute_rql_async(&query, Some(&text_index), reasoner).await.unwrap();
    /// }
    /// ```
    pub async fn execute_rql_async<R: ReasoningEngine + Send + Sync + 'static>(
        self: &Arc<Self>,
        query: &Query,
        text_index: Option<&TextIndex>,
        reasoner: Arc<R>,
    ) -> Result<QueryResult> {
        // Check if this is a REASON query
        if let Some(ref reason_clause) = query.reason {
            return self.execute_reason_query(
                query,
                &reason_clause.query,
                reason_clause.min_confidence,
                text_index,
                reasoner,
            ).await;
        }

        // For non-REASON queries, delegate to execute_rql_with_search
        self.execute_rql_with_search(query, text_index)
    }

    /// Execute a REASON (semantic search) query using the LLM.
    ///
    /// Uses an **agentic search** pattern for efficiency:
    /// 1. BM25 pre-filter (if SEARCH clause) or table filter → get candidates
    /// 2. LLM scans document summaries → ranks top 10 most relevant
    /// 3. LLM deep reasoning → only on top 10 documents
    ///
    /// This is much more efficient than reasoning on all documents.
    async fn execute_reason_query<R: ReasoningEngine + Send + Sync + 'static>(
        self: &Arc<Self>,
        query: &Query,
        reason_query: &str,
        min_confidence: Option<f32>,
        text_index: Option<&TextIndex>,
        reasoner: Arc<R>,
    ) -> Result<QueryResult> {
        use crate::llm::DocumentSummary;

        let start = std::time::Instant::now();

        // Resolve table name to ID
        let table_id = self.resolve_table_id(&query.from.table)?;

        // Target number of documents to reason on (user can override with LIMIT)
        let target_docs = query.limit.as_ref().map(|l| l.count).unwrap_or(10);

        // Build search config
        let config = SearchConfig {
            min_confidence: min_confidence.unwrap_or(0.3),
            max_results: target_docs,
            ..Default::default()
        };

        // Create search engine for deep reasoning
        let engine = SearchEngine::with_config(self.clone(), reasoner.clone(), config);

        // ====== PHASE 1: Get candidate documents ======
        // Use BM25 to get initial candidates - this is REQUIRED for large tables
        // BM25/Tantivy is designed for millions of documents and returns results in ~1ms
        const MAX_CANDIDATES: usize = 100;
        const SAFE_TABLE_SIZE: usize = 1000; // Tables larger than this REQUIRE SEARCH clause

        let candidates: Vec<Document> = if let (Some(ref search_clause), Some(index)) = (&query.search, text_index) {
            // HYBRID: BM25 pre-filters to relevant docs (FAST - handles millions)
            let search_results = index.search(&search_clause.query, MAX_CANDIDATES, Some(&table_id))?;
            let mut seen: HashSet<String> = HashSet::new();
            let mut docs = Vec::new();
            for hit in search_results {
                if seen.contains(&hit.document_id) {
                    continue;
                }
                if let Ok(Some(doc)) = self.get_document(&hit.document_id) {
                    docs.push(doc);
                    seen.insert(hit.document_id);
                }
            }
            docs
        } else if let Some(index) = text_index {
            // No SEARCH clause but we have an index - use broad search on reason_query
            // This extracts keywords from the reason query for BM25 matching
            let search_results = index.search(reason_query, MAX_CANDIDATES, Some(&table_id))?;
            let mut seen: HashSet<String> = HashSet::new();
            let mut docs = Vec::new();
            for hit in search_results {
                if seen.contains(&hit.document_id) {
                    continue;
                }
                if let Ok(Some(doc)) = self.get_document(&hit.document_id) {
                    docs.push(doc);
                    seen.insert(hit.document_id);
                }
            }
            
            // If BM25 found nothing, fall back to filter (but with strict limit)
            if docs.is_empty() {
                let mut filter = query.to_search_filter();
                filter.table_id = Some(table_id.clone());
                filter.limit = Some(MAX_CANDIDATES.min(SAFE_TABLE_SIZE));
                self.find_documents(&filter)?
            } else {
                docs
            }
        } else {
            // No text index available - strict limit to prevent OOM
            let mut filter = query.to_search_filter();
            filter.table_id = Some(table_id.clone());
            filter.limit = Some(MAX_CANDIDATES.min(SAFE_TABLE_SIZE));
            self.find_documents(&filter)?
        };

        // ====== PHASE 2: Agentic Summary Scan ======
        // LLM quickly scans document summaries to rank relevance
        // Only do this if we have more candidates than target
        let documents: Vec<Document> = if candidates.len() > target_docs {
            // Build document summaries for LLM ranking
            let doc_summaries: Vec<DocumentSummary> = candidates
                .iter()
                .filter_map(|doc| {
                    // Get root node for summary
                    let root = self.get_node(&doc.id).ok()??;
                    Some(DocumentSummary {
                        id: doc.id.clone(),
                        title: doc.title.clone(),
                        summary: root.summary.clone(),
                        tags: doc.tags.clone(),
                    })
                })
                .collect();

            if doc_summaries.is_empty() {
                // Fallback: use documents directly without summaries
                candidates.into_iter().take(target_docs).collect()
            } else {
                // LLM ranks documents by relevance (single fast call)
                let rankings = reasoner.rank_documents(reason_query, &doc_summaries, target_docs).await
                    .unwrap_or_else(|_| {
                        // Fallback: take first N if ranking fails
                        doc_summaries.iter().take(target_docs)
                            .map(|d| crate::llm::DocumentRanking {
                                document_id: d.id.clone(),
                                relevance: 0.5,
                                reasoning: "Fallback".to_string(),
                            })
                            .collect()
                    });

                // Collect ranked documents
                let ranked_ids: HashSet<_> = rankings.iter().map(|r| r.document_id.as_str()).collect();
                candidates.into_iter()
                    .filter(|d| ranked_ids.contains(d.id.as_str()))
                    .collect()
            }
        } else {
            // Few enough candidates, reason on all
            candidates
        };

        // ====== PHASE 3: Deep LLM Reasoning (PARALLEL) ======
        // Process documents in parallel for 3-5x speedup
        // Configurable concurrency to respect rate limits
        const MAX_CONCURRENT: usize = 5; // Process 5 docs at a time
        
        let docs_to_process: Vec<_> = documents.into_iter().collect();
        let total_docs = docs_to_process.len();
        
        // Process in batches for controlled parallelism
        let mut all_matches: Vec<DocumentMatch> = Vec::new();
        let mut total_llm_calls = 1; // Count the ranking call
        
        for chunk in docs_to_process.chunks(MAX_CONCURRENT) {
            // Create futures for parallel execution
            let futures: Vec<_> = chunk.iter().map(|doc| {
                let engine = &engine;
                let doc = doc.clone();
                let query = reason_query.to_string();
                async move {
                    let result = engine.search_document(&query, &doc.id).await;
                    (doc, result)
                }
            }).collect();
            
            // Execute all futures in parallel
            let results = futures::future::join_all(futures).await;
            
            // Collect results
            for (doc, search_result) in results {
                if let Ok(response) = search_result {
                    total_llm_calls += response.stats.llm_calls;

                    for result in response.results {
                        // Apply min_confidence filter
                        if let Some(min_conf) = min_confidence {
                            if result.confidence < min_conf {
                                continue;
                            }
                        }

                        all_matches.push(DocumentMatch {
                            document: doc.clone(),
                            score: Some(result.confidence),
                            matched_nodes: vec![result.node_id.clone()],
                            highlights: vec![result.content.clone()],
                            answer: result.extracted_answer,
                            confidence: Some(result.confidence),
                        });
                    }
                }
            }
            
            // Early termination check after each batch
            let target_results = query.limit.as_ref().map(|l| l.count).unwrap_or(10);
            let high_confidence_count = all_matches.iter()
                .filter(|m| m.confidence.unwrap_or(0.0) >= min_confidence.unwrap_or(0.3))
                .count();
            if high_confidence_count >= target_results * 2 {
                break;
            }
        }
        
        let docs_processed = total_docs.min(all_matches.len() + MAX_CONCURRENT);

        // Sort by confidence (highest first)
        all_matches.sort_by(|a, b| {
            b.confidence
                .unwrap_or(0.0)
                .partial_cmp(&a.confidence.unwrap_or(0.0))
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Apply pagination
        let total_count = all_matches.len();
        let paginated: Vec<DocumentMatch> = if let Some(ref limit) = query.limit {
            let offset = limit.offset.unwrap_or(0);
            all_matches.into_iter().skip(offset).take(limit.count).collect()
        } else {
            all_matches
        };

        // Build stats
        let stats = QueryStats {
            index_used: if query.search.is_some() {
                Some("hybrid_bm25_llm".to_string())
            } else {
                Some("llm_semantic".to_string())
            },
            rows_scanned: docs_processed, // Actual docs processed (may be less due to early termination)
            rows_returned: paginated.len(),
            search_executed: query.search.is_some(),
            reason_executed: true,
            llm_calls: total_llm_calls,
        };

        Ok(QueryResult {
            documents: paginated,
            total_count,
            execution_time_ms: start.elapsed().as_millis() as u64,
            stats,
            aggregates: None,
            explain: None,
        })
    }

    /// Check if a document matches a condition.
    fn matches_condition(&self, doc: &Document, condition: &Condition) -> bool {
        match condition {
            Condition::Comparison(comp) => self.matches_comparison(doc, comp),
            Condition::And(left, right) => {
                self.matches_condition(doc, left) && self.matches_condition(doc, right)
            }
            Condition::Or(left, right) => {
                self.matches_condition(doc, left) || self.matches_condition(doc, right)
            }
            Condition::Not(inner) => !self.matches_condition(doc, inner),
        }
    }

    /// Check if a document matches a comparison.
    fn matches_comparison(&self, doc: &Document, comp: &Comparison) -> bool {
        let field_value = self.get_field_value(doc, &comp.left);

        match comp.operator {
            ComparisonOp::Eq => field_value == Some(comp.right.clone()),
            ComparisonOp::Ne => field_value != Some(comp.right.clone()),
            ComparisonOp::Lt => self.compare_values(&field_value, &comp.right, |a, b| a < b),
            ComparisonOp::Gt => self.compare_values(&field_value, &comp.right, |a, b| a > b),
            ComparisonOp::Le => self.compare_values(&field_value, &comp.right, |a, b| a <= b),
            ComparisonOp::Ge => self.compare_values(&field_value, &comp.right, |a, b| a >= b),
            ComparisonOp::Like => self.matches_like(&field_value, &comp.right),
            ComparisonOp::In => self.matches_in(&field_value, &comp.right),
            ComparisonOp::ContainsAll => self.matches_contains_all(doc, &comp.left, &comp.right),
            ComparisonOp::ContainsAny => self.matches_contains_any(doc, &comp.left, &comp.right),
            ComparisonOp::IsNull => field_value.is_none(),
            ComparisonOp::IsNotNull => field_value.is_some(),
        }
    }

    /// Get a field value from a document.
    fn get_field_value(&self, doc: &Document, path: &FieldPath) -> Option<Value> {
        if path.segments.is_empty() {
            return None;
        }

        let first = match &path.segments[0] {
            PathSegment::Field(name) => name.as_str(),
            _ => return None,
        };

        // Handle top-level document fields
        match first {
            "id" => Some(Value::String(doc.id.clone())),
            "title" => Some(Value::String(doc.title.clone())),
            "table_id" => Some(Value::String(doc.table_id.clone())),
            "author" => doc.author.as_ref().map(|a| Value::String(a.clone())),
            "source_url" => doc.source_url.as_ref().map(|u| Value::String(u.clone())),
            "language" => doc.language.as_ref().map(|l| Value::String(l.clone())),
            "version" => doc.version.as_ref().map(|v| Value::String(v.clone())),
            "tags" => Some(Value::Array(
                doc.tags.iter().map(|t| Value::String(t.clone())).collect(),
            )),
            "metadata" => {
                // Handle metadata.field_name
                if path.segments.len() > 1 {
                    if let PathSegment::Field(key) = &path.segments[1] {
                        return doc.metadata.get(key).map(|v| json_to_value(v));
                    }
                }
                None
            }
            _ => None,
        }
    }

    /// Compare two values with a comparator.
    fn compare_values<F>(&self, left: &Option<Value>, right: &Value, cmp: F) -> bool
    where
        F: Fn(f64, f64) -> bool,
    {
        match (left, right) {
            (Some(Value::Number(a)), Value::Number(b)) => cmp(*a, *b),
            _ => false,
        }
    }

    /// Check if a value matches a LIKE pattern.
    fn matches_like(&self, value: &Option<Value>, pattern: &Value) -> bool {
        match (value, pattern) {
            (Some(Value::String(v)), Value::String(p)) => {
                // Simple LIKE implementation: % = any chars
                let regex_pattern = format!(
                    "^{}$",
                    regex::escape(p).replace(r"\%", ".*").replace(r"\_", ".")
                );
                regex::Regex::new(&regex_pattern)
                    .map(|re| re.is_match(v))
                    .unwrap_or(false)
            }
            _ => false,
        }
    }

    /// Check if a value is in a list.
    fn matches_in(&self, value: &Option<Value>, list: &Value) -> bool {
        match (value, list) {
            (Some(v), Value::Array(arr)) => arr.contains(v),
            _ => false,
        }
    }

    /// Check if document field contains all specified values.
    fn matches_contains_all(&self, doc: &Document, path: &FieldPath, values: &Value) -> bool {
        let field_name = path.first_field().unwrap_or("");
        match (field_name, values) {
            ("tags", Value::Array(required)) => {
                required.iter().all(|v| match v {
                    Value::String(tag) => doc.tags.contains(tag),
                    _ => false,
                })
            }
            _ => false,
        }
    }

    /// Check if document field contains any of the specified values.
    fn matches_contains_any(&self, doc: &Document, path: &FieldPath, values: &Value) -> bool {
        let field_name = path.first_field().unwrap_or("");
        match (field_name, values) {
            ("tags", Value::Array(candidates)) => {
                candidates.iter().any(|v| match v {
                    Value::String(tag) => doc.tags.contains(tag),
                    _ => false,
                })
            }
            _ => false,
        }
    }

    /// Sort documents by a field.
    fn sort_documents(&self, docs: &mut [Document], order_by: &OrderByClause) {
        let field = order_by.field.first_field().unwrap_or("");
        let desc = order_by.direction == SortDirection::Desc;

        docs.sort_by(|a, b| {
            let cmp = match field {
                "title" => a.title.cmp(&b.title),
                "created_at" => a.created_at.cmp(&b.created_at),
                "updated_at" => a.updated_at.cmp(&b.updated_at),
                "author" => a.author.cmp(&b.author),
                _ => std::cmp::Ordering::Equal,
            };
            if desc {
                cmp.reverse()
            } else {
                cmp
            }
        });
    }

    /// Resolve a table name to its ID.
    ///
    /// Accepts:
    /// - Table ID (e.g., "tbl_abc123") - returns as-is
    /// - Table slug (e.g., "legal_contracts") - looks up by slug
    /// - Table display name (e.g., "Legal Contracts") - converts to slug and looks up
    fn resolve_table_id(&self, name: &str) -> Result<String> {
        // If it looks like a table ID, return as-is
        if name.starts_with("tbl_") {
            return Ok(name.to_string());
        }

        // Try to look up by slug first
        if let Some(table) = self.get_table_by_slug(name)? {
            return Ok(table.id);
        }

        // Try to look up by name (will be converted to slug)
        if let Some(table) = self.get_table_by_name(name)? {
            return Ok(table.id);
        }

        // Table not found - return the name as-is (will result in empty results)
        // This matches SQL behavior where querying a non-existent table returns empty
        Ok(name.to_string())
    }

    /// Build a query execution plan for EXPLAIN queries.
    fn build_query_plan(&self, query: &Query, table_id: &str) -> QueryPlan {
        let mut steps = Vec::new();
        let mut indexes_used = Vec::new();

        // Step 1: Table access
        steps.push(PlanStep {
            step_type: "TableScan".to_string(),
            description: format!("Scan table '{}'", table_id),
            estimated_cost: 10,
        });
        indexes_used.push("idx_table_docs".to_string());

        // Step 2: Search if present
        if let Some(ref search) = query.search {
            steps.push(PlanStep {
                step_type: "BM25Search".to_string(),
                description: format!("Full-text search for '{}'", search.query),
                estimated_cost: 20,
            });
            indexes_used.push("bm25_full_text".to_string());
        }

        // Step 3: Reason if present
        if let Some(ref reason) = query.reason {
            steps.push(PlanStep {
                step_type: "LLMReason".to_string(),
                description: format!("LLM semantic search for '{}'", reason.query),
                estimated_cost: 80, // LLM is expensive
            });
        }

        // Step 4: WHERE filtering
        if query.where_clause.is_some() {
            steps.push(PlanStep {
                step_type: "Filter".to_string(),
                description: "Apply WHERE conditions".to_string(),
                estimated_cost: 5,
            });

            // Check for indexed fields in WHERE clause
            if let Some(ref wc) = query.where_clause {
                self.analyze_condition_indexes(&wc.condition, &mut indexes_used);
            }
        }

        // Step 5: GROUP BY
        if let Some(ref group_by) = query.group_by {
            let fields: Vec<_> = group_by.fields.iter()
                .filter_map(|f| f.first_field())
                .collect();
            steps.push(PlanStep {
                step_type: "GroupBy".to_string(),
                description: format!("Group by {}", fields.join(", ")),
                estimated_cost: 15,
            });
        }

        // Step 6: Aggregation
        if let SelectClause::Aggregates(ref aggs) = query.select {
            let agg_names: Vec<_> = aggs.iter()
                .map(|a| format!("{:?}", a.function))
                .collect();
            steps.push(PlanStep {
                step_type: "Aggregate".to_string(),
                description: format!("Compute {}", agg_names.join(", ")),
                estimated_cost: 5,
            });
        }

        // Step 7: ORDER BY
        if let Some(ref order_by) = query.order_by {
            let field = order_by.field.first_field().unwrap_or("?");
            let dir = if order_by.direction == SortDirection::Desc { "DESC" } else { "ASC" };
            steps.push(PlanStep {
                step_type: "Sort".to_string(),
                description: format!("Sort by {} {}", field, dir),
                estimated_cost: 10,
            });
        }

        // Step 8: LIMIT
        if let Some(ref limit) = query.limit {
            steps.push(PlanStep {
                step_type: "Limit".to_string(),
                description: format!("Return {} rows (offset {})", limit.count, limit.offset.unwrap_or(0)),
                estimated_cost: 1,
            });
        }

        // Estimate total rows (would be based on table stats in a real DB)
        let estimated_rows = 100; // Placeholder

        QueryPlan {
            steps,
            estimated_rows,
            indexes_used,
        }
    }

    /// Analyze a condition tree for index usage.
    fn analyze_condition_indexes(&self, condition: &Condition, indexes: &mut Vec<String>) {
        match condition {
            Condition::Comparison(comp) => {
                if let Some(field) = comp.left.first_field() {
                    match field {
                        "table_id" => indexes.push("idx_table_docs".to_string()),
                        "tags" => indexes.push("idx_tag_docs".to_string()),
                        "author" => indexes.push("idx_author_docs".to_string()),
                        _ if field.starts_with("metadata.") => {
                            indexes.push("idx_metadata".to_string());
                        }
                        _ => {}
                    }
                }
            }
            Condition::And(left, right) | Condition::Or(left, right) => {
                self.analyze_condition_indexes(left, indexes);
                self.analyze_condition_indexes(right, indexes);
            }
            Condition::Not(inner) => {
                self.analyze_condition_indexes(inner, indexes);
            }
        }
    }

    /// Compute aggregate results.
    fn compute_aggregates(
        &self,
        matches: &[DocumentMatch],
        aggs: &[AggregateExpr],
        group_by: Option<&GroupByClause>,
    ) -> Vec<AggregateResult> {
        use std::collections::HashMap;

        if let Some(group_by) = group_by {
            // GROUP BY query - compute aggregates per group
            let mut groups: HashMap<Vec<(String, serde_json::Value)>, Vec<&DocumentMatch>> = HashMap::new();

            for m in matches {
                let key: Vec<(String, serde_json::Value)> = group_by.fields.iter()
                    .filter_map(|f| {
                        let field_name = f.first_field()?;
                        let value = self.get_field_value(&m.document, f)?;
                        Some((field_name.to_string(), value_to_json(&value)))
                    })
                    .collect();
                groups.entry(key).or_default().push(m);
            }

            let mut results = Vec::new();
            for (group_key, group_docs) in groups {
                for agg in aggs {
                    let result = self.compute_single_aggregate(agg, &group_docs);
                    results.push(AggregateResult {
                        name: result.name,
                        value: result.value,
                        group_key: Some(group_key.clone()),
                    });
                }
            }
            results
        } else {
            // No GROUP BY - compute aggregates over all rows
            let doc_refs: Vec<&DocumentMatch> = matches.iter().collect();
            aggs.iter()
                .map(|agg| self.compute_single_aggregate(agg, &doc_refs))
                .collect()
        }
    }

    /// Compute a single aggregate function.
    fn compute_single_aggregate(&self, agg: &AggregateExpr, docs: &[&DocumentMatch]) -> AggregateResult {
        let name = agg.alias.clone().unwrap_or_else(|| {
            match &agg.function {
                AggregateFunction::Count(_) => "count".to_string(),
                AggregateFunction::Sum(f) => format!("sum_{}", f.first_field().unwrap_or("?")),
                AggregateFunction::Avg(f) => format!("avg_{}", f.first_field().unwrap_or("?")),
                AggregateFunction::Min(f) => format!("min_{}", f.first_field().unwrap_or("?")),
                AggregateFunction::Max(f) => format!("max_{}", f.first_field().unwrap_or("?")),
            }
        });

        let value = match &agg.function {
            AggregateFunction::Count(field) => {
                if let Some(f) = field {
                    // COUNT(field) - count non-null values
                    let count = docs.iter()
                        .filter(|m| self.get_field_value(&m.document, f).is_some())
                        .count();
                    AggregateValue::Count(count)
                } else {
                    // COUNT(*) - count all rows
                    AggregateValue::Count(docs.len())
                }
            }
            AggregateFunction::Sum(field) => {
                let sum: f64 = docs.iter()
                    .filter_map(|m| {
                        if let Some(Value::Number(n)) = self.get_field_value(&m.document, field) {
                            Some(n)
                        } else {
                            None
                        }
                    })
                    .sum();
                AggregateValue::Float(sum)
            }
            AggregateFunction::Avg(field) => {
                let values: Vec<f64> = docs.iter()
                    .filter_map(|m| {
                        if let Some(Value::Number(n)) = self.get_field_value(&m.document, field) {
                            Some(n)
                        } else {
                            None
                        }
                    })
                    .collect();
                if values.is_empty() {
                    AggregateValue::Null
                } else {
                    let sum: f64 = values.iter().sum();
                    AggregateValue::Float(sum / values.len() as f64)
                }
            }
            AggregateFunction::Min(field) => {
                let min = docs.iter()
                    .filter_map(|m| {
                        if let Some(Value::Number(n)) = self.get_field_value(&m.document, field) {
                            Some(n)
                        } else {
                            None
                        }
                    })
                    .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                match min {
                    Some(v) => AggregateValue::Float(v),
                    None => AggregateValue::Null,
                }
            }
            AggregateFunction::Max(field) => {
                let max = docs.iter()
                    .filter_map(|m| {
                        if let Some(Value::Number(n)) = self.get_field_value(&m.document, field) {
                            Some(n)
                        } else {
                            None
                        }
                    })
                    .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                match max {
                    Some(v) => AggregateValue::Float(v),
                    None => AggregateValue::Null,
                }
            }
        };

        AggregateResult {
            name,
            value,
            group_key: None,
        }
    }
}

/// Convert serde_json::Value to RQL Value.
fn json_to_value(json: &serde_json::Value) -> Value {
    match json {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Bool(*b),
        serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap_or(0.0)),
        serde_json::Value::String(s) => Value::String(s.clone()),
        serde_json::Value::Array(arr) => Value::Array(arr.iter().map(json_to_value).collect()),
        serde_json::Value::Object(_) => Value::Null, // Objects not supported as values
    }
}

/// Convert RQL Value to serde_json::Value.
fn value_to_json(value: &Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        Value::Number(n) => serde_json::json!(*n),
        Value::String(s) => serde_json::Value::String(s.clone()),
        Value::Array(arr) => serde_json::Value::Array(arr.iter().map(value_to_json).collect()),
    }
}
