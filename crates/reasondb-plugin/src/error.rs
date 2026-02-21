//! Plugin-specific error types

use thiserror::Error;

#[derive(Debug, Error)]
pub enum PluginError {
    #[error("Plugin not found: {0}")]
    NotFound(String),

    #[error("No plugin available for format: {0}")]
    NoHandler(String),

    #[error("Plugin manifest error: {0}")]
    Manifest(String),

    #[error("Plugin invocation failed: {0}")]
    Invocation(String),

    #[error("Plugin timed out after {0}s")]
    Timeout(u64),

    #[error("Plugin returned error: {0}")]
    PluginResponse(String),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, PluginError>;
