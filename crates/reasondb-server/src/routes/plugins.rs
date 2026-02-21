//! Plugin management API endpoints

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use reasondb_core::llm::ReasoningEngine;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Serialize)]
pub struct PluginInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub kind: String,
    pub formats: Vec<String>,
    pub handles_urls: bool,
    pub priority: u32,
}

#[derive(Serialize)]
pub struct PluginListResponse {
    pub plugins: Vec<PluginInfo>,
    pub count: usize,
    pub enabled: bool,
}

impl From<&reasondb_plugin::PluginManifest> for PluginInfo {
    fn from(m: &reasondb_plugin::PluginManifest) -> Self {
        Self {
            name: m.name.clone(),
            version: m.version.clone(),
            description: m.description.clone(),
            author: m.author.clone(),
            kind: m.capabilities.kind.to_string(),
            formats: m.capabilities.formats.clone(),
            handles_urls: m.capabilities.handles_urls,
            priority: m.capabilities.priority,
        }
    }
}

/// GET /v1/plugins - List all installed plugins
pub async fn list_plugins<R: ReasoningEngine>(
    State(state): State<Arc<AppState<R>>>,
) -> Json<PluginListResponse> {
    let plugins: Vec<PluginInfo> = state
        .plugin_manager
        .list_plugins()
        .iter()
        .map(PluginInfo::from)
        .collect();

    let count = plugins.len();
    Json(PluginListResponse {
        plugins,
        count,
        enabled: state.plugin_manager.is_enabled(),
    })
}

/// GET /v1/plugins/:name - Get details of a specific plugin
pub async fn get_plugin<R: ReasoningEngine>(
    State(state): State<Arc<AppState<R>>>,
    Path(name): Path<String>,
) -> Result<Json<PluginInfo>, StatusCode> {
    state
        .plugin_manager
        .get_plugin(&name)
        .map(|m| Json(PluginInfo::from(m)))
        .ok_or(StatusCode::NOT_FOUND)
}

#[derive(Deserialize)]
pub struct TestPluginRequest {
    pub operation: String,
    pub params: serde_json::Value,
}

#[derive(Serialize)]
pub struct TestPluginResponse {
    pub status: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// POST /v1/plugins/:name/test - Test a plugin with sample input (admin)
pub async fn test_plugin<R: ReasoningEngine>(
    State(state): State<Arc<AppState<R>>>,
    Path(name): Path<String>,
    Json(body): Json<TestPluginRequest>,
) -> Result<Json<TestPluginResponse>, StatusCode> {
    let manifest = state
        .plugin_manager
        .get_plugin(&name)
        .ok_or(StatusCode::NOT_FOUND)?;

    let request = reasondb_plugin::PluginRequest {
        version: reasondb_plugin::PROTOCOL_VERSION,
        operation: body.operation,
        params: body.params,
    };

    match reasondb_plugin::PluginRunner::invoke(manifest, &request) {
        Ok(response) => Ok(Json(TestPluginResponse {
            status: if response.is_ok() {
                "ok".to_string()
            } else {
                "error".to_string()
            },
            result: response.result,
            error: response.error,
        })),
        Err(e) => Ok(Json(TestPluginResponse {
            status: "error".to_string(),
            result: None,
            error: Some(e.to_string()),
        })),
    }
}
