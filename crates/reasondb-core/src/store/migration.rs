//! Schema migration helpers for backward-compatible deserialization.
//!
//! When the on-disk serialization format changes (e.g. adding a new field),
//! the shadow structs here capture the *previous* schema so that old records
//! can still be read and promoted to the current schema.
//!
//! # Pattern
//!
//! Each versioned struct (e.g. `DocumentV1`, `PageNodeV1`) mirrors the exact
//! field layout of a model at a prior schema version.  A `From<VN> for Current`
//! impl maps old fields to new ones, filling missing fields with sensible
//! defaults.  The `deserialize_*` helpers try the current format first (JSON or
//! rmp-serde) and fall back to bincode + the shadow struct for old records.
//!
//! # Adding a future migration
//!
//! 1. Add a new `FooV2` struct that mirrors the current `Foo` fields.
//! 2. Implement `From<FooV2> for Foo` with defaults for any new fields.
//! 3. Update `deserialize_foo` to chain: JSON/rmp-serde → bincode/V2 → bincode/V1
//!    → error.

use std::collections::HashMap;

use serde::Deserialize;
use serde_json::Value;

use crate::error::{ReasonError, Result};
use crate::model::{Document, NodeMetadata, PageNode};

// ============================================================
// Document: V1 → current
// ============================================================
//
// Change that broke bincode: `source_content: Option<String>` was appended.
// bincode is positional, so it tries to read bytes for the new field and hits
// EOF on records written before the field existed.

/// Document schema before `source_content` was added.
#[derive(Debug, Deserialize)]
pub(super) struct DocumentV1 {
    pub id: String,
    pub title: String,
    pub root_node_id: String,
    pub total_nodes: usize,
    pub max_depth: u8,
    pub source_path: String,
    pub mime_type: Option<String>,
    pub file_size: Option<u64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub table_id: String,
    /// bincode serializes metadata as a JSON string via the json_metadata module
    #[serde(with = "crate::model::json_metadata")]
    pub metadata: HashMap<String, Value>,
    pub tags: Vec<String>,
    pub source_url: Option<String>,
    pub language: Option<String>,
    pub version: Option<String>,
}

impl From<DocumentV1> for Document {
    fn from(v1: DocumentV1) -> Self {
        Document {
            id: v1.id,
            title: v1.title,
            root_node_id: v1.root_node_id,
            total_nodes: v1.total_nodes,
            max_depth: v1.max_depth,
            source_path: v1.source_path,
            mime_type: v1.mime_type,
            file_size: v1.file_size,
            created_at: v1.created_at,
            updated_at: v1.updated_at,
            table_id: v1.table_id,
            metadata: v1.metadata,
            tags: v1.tags,
            source_url: v1.source_url,
            language: v1.language,
            version: v1.version,
            source_content: None,
        }
    }
}

/// Deserialize a `Document` from bytes.
///
/// Tries rmp-serde (current format) first, then falls back to bincode via
/// `DocumentV1` for records written before `source_content` was added.
pub(super) fn deserialize_document(bytes: &[u8]) -> Result<Document> {
    if let Ok(doc) = rmp_serde::from_slice::<Document>(bytes) {
        return Ok(doc);
    }
    if let Ok(v1) = bincode::deserialize::<DocumentV1>(bytes) {
        return Ok(Document::from(v1));
    }
    Err(ReasonError::Serialization(
        "failed to deserialize Document: not a valid rmp-serde or bincode record".to_string(),
    ))
}

// ============================================================
// PageNode / NodeMetadata: V1 → current
// ============================================================
//
// Change that broke bincode: `cross_ref_node_ids: Vec<String>` was appended
// to `NodeMetadata`.

/// `NodeMetadata` schema before `cross_ref_node_ids` was added.
#[derive(Debug, Deserialize)]
pub(super) struct NodeMetadataV1 {
    pub page_number: Option<u32>,
    pub section_type: Option<String>,
    pub confidence_score: Option<f32>,
    pub token_count: Option<u32>,
    pub attributes: HashMap<String, String>,
}

/// `PageNode` schema before `NodeMetadata` gained `cross_ref_node_ids`.
#[derive(Debug, Deserialize)]
pub(super) struct PageNodeV1 {
    pub id: String,
    pub document_id: String,
    pub title: String,
    pub summary: String,
    pub depth: u8,
    pub start_index: usize,
    pub end_index: usize,
    pub parent_id: Option<String>,
    pub children_ids: Vec<String>,
    pub content: Option<String>,
    pub image_path: Option<String>,
    pub metadata: NodeMetadataV1,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<PageNodeV1> for PageNode {
    fn from(v1: PageNodeV1) -> Self {
        PageNode {
            id: v1.id,
            document_id: v1.document_id,
            title: v1.title,
            summary: v1.summary,
            depth: v1.depth,
            start_index: v1.start_index,
            end_index: v1.end_index,
            parent_id: v1.parent_id,
            children_ids: v1.children_ids,
            content: v1.content,
            image_path: v1.image_path,
            metadata: NodeMetadata {
                page_number: v1.metadata.page_number,
                section_type: v1.metadata.section_type,
                confidence_score: v1.metadata.confidence_score,
                token_count: v1.metadata.token_count,
                attributes: v1.metadata.attributes,
                cross_ref_node_ids: vec![],
            },
            created_at: v1.created_at,
            updated_at: v1.updated_at,
        }
    }
}

/// Deserialize a `PageNode` from bytes.
///
/// Tries rmp-serde (current format) first, then falls back to bincode via
/// `PageNodeV1` for records written before `cross_ref_node_ids` was added.
pub(super) fn deserialize_node(bytes: &[u8]) -> Result<PageNode> {
    if let Ok(node) = rmp_serde::from_slice::<PageNode>(bytes) {
        return Ok(node);
    }
    let v1: PageNodeV1 =
        bincode::deserialize(bytes).map_err(|e| ReasonError::Serialization(e.to_string()))?;
    Ok(PageNode::from(v1))
}
