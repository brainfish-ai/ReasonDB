//! RQL Query Executor
//!
//! Executes parsed RQL queries against the NodeStore.

use crate::model::{Document, NodeId};
use crate::store::NodeStore;
use crate::error::Result;

use super::ast::*;

/// Result of executing a query.
#[derive(Debug, Clone)]
pub struct QueryResult {
    /// Matched documents
    pub documents: Vec<DocumentMatch>,
    /// Total count (before pagination)
    pub total_count: usize,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
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
        filter.table_id = Some(table_id);

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

        // Apply pagination
        let paginated = if let Some(ref limit) = query.limit {
            let offset = limit.offset.unwrap_or(0);
            sorted.into_iter().skip(offset).take(limit.count).collect()
        } else {
            sorted
        };

        // Convert to DocumentMatch
        let matches: Vec<DocumentMatch> = paginated
            .into_iter()
            .map(|doc| DocumentMatch {
                document: doc,
                score: None,
                matched_nodes: Vec::new(),
                highlights: Vec::new(),
            })
            .collect();

        Ok(QueryResult {
            documents: matches,
            total_count,
            execution_time_ms: start.elapsed().as_millis() as u64,
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
