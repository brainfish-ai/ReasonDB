//! Application state management
//!
//! Shared state accessible to all request handlers.

use reasondb_core::{
    auth::ApiKeyStore,
    cache::QueryCache,
    llm::{mock::MockReasoner, provider::Reasoner, ReasoningEngine},
    store::NodeStore,
    text_index::TextIndex,
};
use std::sync::Arc;

/// Application state shared across handlers
pub struct AppState<R: ReasoningEngine = Reasoner> {
    /// Database store
    pub store: Arc<NodeStore>,
    /// Full-text search index (BM25)
    pub text_index: Arc<TextIndex>,
    /// LLM reasoning engine
    pub reasoner: Arc<R>,
    /// Query result cache (saves LLM calls)
    pub query_cache: Arc<QueryCache>,
    /// API key store for authentication
    pub api_key_store: Arc<ApiKeyStore>,
    /// Server configuration
    pub config: ServerConfig,
}

impl<R: ReasoningEngine> AppState<R> {
    /// Create new app state
    pub fn new(
        store: NodeStore,
        text_index: TextIndex,
        reasoner: R,
        api_key_store: ApiKeyStore,
        config: ServerConfig,
    ) -> Self {
        Self {
            store: Arc::new(store),
            text_index: Arc::new(text_index),
            reasoner: Arc::new(reasoner),
            query_cache: Arc::new(QueryCache::new()),
            api_key_store: Arc::new(api_key_store),
            config,
        }
    }
}

/// Authentication configuration
#[derive(Debug, Clone)]
pub struct AuthConfig {
    /// Enable authentication (if false, all requests are allowed)
    pub enabled: bool,
    /// Master key that bypasses all checks (for admin/setup)
    pub master_key: Option<String>,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            enabled: false, // Disabled by default for backward compatibility
            master_key: None,
        }
    }
}

impl AuthConfig {
    /// Create config from environment
    pub fn from_env() -> Self {
        let enabled = std::env::var("REASONDB_AUTH_ENABLED")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);

        let master_key = std::env::var("REASONDB_MASTER_KEY").ok();

        Self {
            enabled,
            master_key,
        }
    }
}

/// Server configuration
#[derive(Debug, Clone)]
pub struct ServerConfig {
    /// Host to bind to
    pub host: String,
    /// Port to bind to
    pub port: u16,
    /// Database path
    pub db_path: String,
    /// Maximum upload size in bytes
    pub max_upload_size: usize,
    /// Enable CORS
    pub enable_cors: bool,
    /// Generate summaries during ingestion
    pub generate_summaries: bool,
    /// Authentication configuration
    pub auth: AuthConfig,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 3000,
            db_path: "reasondb.redb".to_string(),
            max_upload_size: 100 * 1024 * 1024, // 100MB
            enable_cors: true,
            generate_summaries: true,
            auth: AuthConfig::default(),
        }
    }
}

/// Type alias for state with mock reasoner (testing)
pub type MockAppState = AppState<MockReasoner>;

/// Type alias for state with real reasoner
pub type RealAppState = AppState<Reasoner>;
