//! Dynamic hot-swappable reasoner
//!
//! Wraps separate ingestion and retrieval `Reasoner` instances behind
//! `ArcSwap` so they can be replaced at runtime without a server restart.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use arc_swap::ArcSwap;
use async_trait::async_trait;

use super::{
    ChunkGroupResult, DocumentRanking, DocumentSummary, NodeSummary, ReasoningEngine,
    SummarizationContext, TraversalDecision, VerificationResult,
};
use crate::error::Result;
use crate::llm::config::{LlmModelConfig, LlmSettings};
use crate::llm::provider::Reasoner;
use crate::llm::ReasoningConfig;
use crate::query_decomposer::{DomainContext, SubQuery};

/// How long an LLM role stays marked unhealthy before auto-recovering.
const UNHEALTHY_COOLDOWN: Duration = Duration::from_secs(60);

/// Tracks whether an LLM role (ingestion or retrieval) is currently healthy.
///
/// A role is healthy by default.  It becomes unhealthy when `mark_unhealthy`
/// is called (e.g. on a timeout).  It automatically recovers after
/// `UNHEALTHY_COOLDOWN`, or immediately when `mark_healthy` is called (e.g.
/// after a successful `/v1/config/llm/test`).
struct HealthTracker {
    unhealthy_since: Mutex<Option<Instant>>,
}

impl HealthTracker {
    fn new() -> Self {
        Self {
            unhealthy_since: Mutex::new(None),
        }
    }

    fn is_healthy(&self) -> bool {
        match *self.unhealthy_since.lock().unwrap() {
            None => true,
            Some(t) => t.elapsed() >= UNHEALTHY_COOLDOWN,
        }
    }

    fn mark_unhealthy(&self) {
        let mut guard = self.unhealthy_since.lock().unwrap();
        if guard.is_none() {
            *guard = Some(Instant::now());
        }
    }

    fn mark_healthy(&self) {
        *self.unhealthy_since.lock().unwrap() = None;
    }
}

/// Holds the two swappable reasoner instances and their health trackers.
struct Inner {
    ingestion: ArcSwap<Reasoner>,
    retrieval: ArcSwap<Reasoner>,
    ingestion_health: HealthTracker,
    retrieval_health: HealthTracker,
}

/// A reasoning engine that routes calls to either an ingestion or retrieval
/// `Reasoner`, each of which can be hot-swapped at runtime.
///
/// Methods related to ingestion (summarize, summarize_batch) use the
/// ingestion reasoner. All other methods (decide_next_step, verify_answer,
/// rank_documents) use the retrieval reasoner.
///
/// Cheaply clonable — all clones share the same `ArcSwap` instances.
#[derive(Clone)]
pub struct DynamicReasoner {
    inner: Arc<Inner>,
}

impl DynamicReasoner {
    /// Build from two separate Reasoner instances.
    pub fn new(ingestion: Reasoner, retrieval: Reasoner) -> Self {
        Self {
            inner: Arc::new(Inner {
                ingestion: ArcSwap::from_pointee(ingestion),
                retrieval: ArcSwap::from_pointee(retrieval),
                ingestion_health: HealthTracker::new(),
                retrieval_health: HealthTracker::new(),
            }),
        }
    }

    /// Build from a single Reasoner (used for both ingestion and retrieval).
    pub fn from_single(reasoner: Reasoner) -> Self {
        Self::new(reasoner.clone(), reasoner)
    }

    /// Build from `LlmSettings`, constructing the two Reasoner instances.
    pub fn from_settings(settings: &LlmSettings) -> Result<Self> {
        let ingestion = build_reasoner(&settings.ingestion)?;
        let retrieval = build_reasoner(&settings.retrieval)?;
        Ok(Self::new(ingestion, retrieval))
    }

    /// Hot-swap the ingestion reasoner.
    pub fn swap_ingestion(&self, reasoner: Reasoner) {
        self.inner.ingestion.store(Arc::new(reasoner));
    }

    /// Hot-swap the retrieval reasoner.
    pub fn swap_retrieval(&self, reasoner: Reasoner) {
        self.inner.retrieval.store(Arc::new(reasoner));
    }

    /// Hot-swap both reasoners from new settings.
    pub fn swap_all(&self, settings: &LlmSettings) -> Result<()> {
        let ingestion = build_reasoner(&settings.ingestion)?;
        let retrieval = build_reasoner(&settings.retrieval)?;
        self.inner.ingestion.store(Arc::new(ingestion));
        self.inner.retrieval.store(Arc::new(retrieval));
        Ok(())
    }

    fn ingestion(&self) -> arc_swap::Guard<Arc<Reasoner>> {
        self.inner.ingestion.load()
    }

    fn retrieval(&self) -> arc_swap::Guard<Arc<Reasoner>> {
        self.inner.retrieval.load()
    }
}

/// Build a `Reasoner` from a model config.
pub fn build_reasoner(cfg: &LlmModelConfig) -> Result<Reasoner> {
    let provider = cfg.to_provider()?;
    let reasoner = Reasoner::new(provider)
        .with_config(ReasoningConfig::default())
        .with_options(cfg.options.clone());
    Ok(reasoner)
}

#[async_trait]
impl ReasoningEngine for DynamicReasoner {
    async fn decide_next_step(
        &self,
        query: &str,
        current_context: &str,
        candidates: &[NodeSummary],
        max_selections: usize,
    ) -> Result<Vec<TraversalDecision>> {
        self.retrieval()
            .decide_next_step(query, current_context, candidates, max_selections)
            .await
    }

    async fn verify_answer(&self, query: &str, content: &str) -> Result<VerificationResult> {
        self.retrieval().verify_answer(query, content).await
    }

    async fn batch_verify_answers(
        &self,
        query: &str,
        candidates: &[crate::llm::BatchVerifyInput],
    ) -> Result<Vec<VerificationResult>> {
        self.retrieval()
            .batch_verify_answers(query, candidates)
            .await
    }

    async fn summarize(&self, content: &str, context: &SummarizationContext) -> Result<String> {
        self.ingestion().summarize(content, context).await
    }

    async fn summarize_batch(
        &self,
        items: &[(String, String, SummarizationContext)],
    ) -> Result<Vec<(String, String)>> {
        self.ingestion().summarize_batch(items).await
    }

    async fn summarize_batch_with_refs(
        &self,
        items: &[(String, String, SummarizationContext)],
    ) -> Result<Vec<(String, String, Vec<String>)>> {
        self.ingestion().summarize_batch_with_refs(items).await
    }

    async fn rank_documents(
        &self,
        query: &str,
        documents: &[DocumentSummary],
        top_k: usize,
    ) -> Result<Vec<DocumentRanking>> {
        self.retrieval()
            .rank_documents(query, documents, top_k)
            .await
    }

    async fn decompose_query(
        &self,
        query: &str,
        domain_context: Option<&DomainContext>,
    ) -> Result<Vec<SubQuery>> {
        self.retrieval()
            .decompose_query(query, domain_context)
            .await
    }

    async fn extract_domain_vocab(
        &self,
        document_summary: &str,
        existing_vocab: &[String],
    ) -> Result<Vec<String>> {
        self.ingestion()
            .extract_domain_vocab(document_summary, existing_vocab)
            .await
    }

    async fn chunk_document(
        &self,
        lines: &[String],
        window_offset: usize,
    ) -> Result<ChunkGroupResult> {
        self.ingestion().chunk_document(lines, window_offset).await
    }

    fn name(&self) -> &str {
        "dynamic"
    }

    fn is_ingestion_healthy(&self) -> bool {
        self.inner.ingestion_health.is_healthy()
    }

    fn is_retrieval_healthy(&self) -> bool {
        self.inner.retrieval_health.is_healthy()
    }

    fn mark_ingestion_unhealthy(&self) {
        tracing::warn!("LLM ingestion provider marked unhealthy — will auto-recover in 60s or on successful /v1/config/llm/test");
        self.inner.ingestion_health.mark_unhealthy();
    }

    fn mark_retrieval_unhealthy(&self) {
        tracing::warn!("LLM retrieval provider marked unhealthy — will auto-recover in 60s or on successful /v1/config/llm/test");
        self.inner.retrieval_health.mark_unhealthy();
    }

    fn mark_ingestion_healthy(&self) {
        self.inner.ingestion_health.mark_healthy();
    }

    fn mark_retrieval_healthy(&self) {
        self.inner.retrieval_health.mark_healthy();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::config::{LlmModelConfig, LlmOptions};

    fn dummy_openai_config() -> LlmModelConfig {
        LlmModelConfig {
            provider: "openai".into(),
            api_key: Some("sk-test".into()),
            model: Some("gpt-4o-mini".into()),
            base_url: None,
            region: None,
            options: LlmOptions::default(),
        }
    }

    #[test]
    fn test_build_reasoner() {
        let cfg = dummy_openai_config();
        let r = build_reasoner(&cfg);
        assert!(r.is_ok());
    }

    #[test]
    fn test_from_settings() {
        let settings = LlmSettings {
            ingestion: dummy_openai_config(),
            retrieval: dummy_openai_config(),
        };
        let dr = DynamicReasoner::from_settings(&settings);
        assert!(dr.is_ok());
    }

    #[test]
    fn test_swap_ingestion() {
        let settings = LlmSettings {
            ingestion: dummy_openai_config(),
            retrieval: dummy_openai_config(),
        };
        let dr = DynamicReasoner::from_settings(&settings).unwrap();
        let new_reasoner = build_reasoner(&dummy_openai_config()).unwrap();
        dr.swap_ingestion(new_reasoner);
    }
}
