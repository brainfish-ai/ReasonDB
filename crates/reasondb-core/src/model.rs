//! Data models for ReasonDB
//!
//! This module defines the core data structures:
//! - `PageNode`: The fundamental unit of the reasoning tree
//! - `Document`: Root-level document metadata
//! - `NodeMetadata`: Additional node attributes

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique identifier for nodes
pub type NodeId = String;

/// Unique identifier for documents
pub type DocumentId = String;

/// The fundamental unit of the reasoning tree.
///
/// A `PageNode` represents a section of a document at any level of the hierarchy.
/// Leaf nodes contain actual content, while internal nodes contain summaries
/// of their children.
///
/// # Example
///
/// ```rust
/// use reasondb_core::PageNode;
///
/// let node = PageNode::new(
///     "doc_123".to_string(),
///     "Introduction".to_string(),
///     Some("This chapter introduces the main concepts...".to_string()),
///     0,
/// );
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PageNode {
    /// Unique identifier for this node
    pub id: NodeId,

    /// Reference to the parent document
    pub document_id: DocumentId,

    /// Human-readable title (e.g., "Chapter 1", "Section 2.1")
    pub title: String,

    /// LLM-generated summary describing what this node contains.
    /// This is what the LLM reads during tree traversal.
    pub summary: String,

    /// Depth level in the tree (0 = root)
    pub depth: u8,

    /// Character offset where this section starts in the source document
    pub start_index: usize,

    /// Character offset where this section ends in the source document
    pub end_index: usize,

    /// Parent node ID (None for root nodes)
    pub parent_id: Option<NodeId>,

    /// IDs of child nodes
    pub children_ids: Vec<NodeId>,

    /// Actual content (only present for leaf nodes)
    pub content: Option<String>,

    /// Path to associated image (for vision-enabled reasoning)
    pub image_path: Option<String>,

    /// Additional metadata
    pub metadata: NodeMetadata,

    /// When this node was created
    pub created_at: DateTime<Utc>,

    /// When this node was last updated
    pub updated_at: DateTime<Utc>,
}

impl PageNode {
    /// Create a new PageNode with a generated ID
    pub fn new(
        document_id: DocumentId,
        title: String,
        summary: Option<String>,
        depth: u8,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            document_id,
            title,
            summary: summary.unwrap_or_default(),
            depth,
            start_index: 0,
            end_index: 0,
            parent_id: None,
            children_ids: Vec::new(),
            content: None,
            image_path: None,
            metadata: NodeMetadata::default(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Create a new root node for a document
    pub fn new_root(document_id: DocumentId, title: String) -> Self {
        Self::new(document_id, title, None, 0)
    }

    /// Create a new leaf node with content
    pub fn new_leaf(
        document_id: DocumentId,
        title: String,
        content: String,
        summary: String,
        depth: u8,
    ) -> Self {
        let mut node = Self::new(document_id, title, Some(summary), depth);
        node.content = Some(content);
        node
    }

    /// Check if this is a leaf node (has content, no children)
    pub fn is_leaf(&self) -> bool {
        self.children_ids.is_empty()
    }

    /// Check if this is the root node
    pub fn is_root(&self) -> bool {
        self.parent_id.is_none()
    }

    /// Add a child node ID
    pub fn add_child(&mut self, child_id: NodeId) {
        self.children_ids.push(child_id);
        self.updated_at = Utc::now();
    }

    /// Set the parent node ID
    pub fn set_parent(&mut self, parent_id: NodeId) {
        self.parent_id = Some(parent_id);
        self.updated_at = Utc::now();
    }

    /// Set the content and mark as leaf
    pub fn set_content(&mut self, content: String) {
        self.content = Some(content);
        self.updated_at = Utc::now();
    }

    /// Set the summary
    pub fn set_summary(&mut self, summary: String) {
        self.summary = summary;
        self.updated_at = Utc::now();
    }

    /// Generate a compact representation for LLM context during traversal
    pub fn to_llm_context(&self) -> String {
        format!(
            "ID: {}\nTitle: {}\nSummary: {}",
            self.id, self.title, self.summary
        )
    }

    /// Get the content or a placeholder if not a leaf
    pub fn get_content(&self) -> &str {
        self.content.as_deref().unwrap_or("[No content - internal node]")
    }
}

/// Additional metadata for a node
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct NodeMetadata {
    /// Page number in the source document (if applicable)
    pub page_number: Option<u32>,

    /// Type of section (e.g., "chapter", "section", "paragraph")
    pub section_type: Option<String>,

    /// Confidence score from summarization (0.0 - 1.0)
    pub confidence_score: Option<f32>,

    /// Approximate token count of the content
    pub token_count: Option<u32>,

    /// Custom key-value attributes
    pub attributes: std::collections::HashMap<String, String>,
}

impl NodeMetadata {
    /// Create metadata with a section type
    pub fn with_section_type(section_type: &str) -> Self {
        Self {
            section_type: Some(section_type.to_string()),
            ..Default::default()
        }
    }

    /// Set the page number
    pub fn with_page(mut self, page: u32) -> Self {
        self.page_number = Some(page);
        self
    }

    /// Add a custom attribute
    pub fn with_attribute(mut self, key: &str, value: &str) -> Self {
        self.attributes.insert(key.to_string(), value.to_string());
        self
    }
}

/// Root-level document metadata.
///
/// A `Document` represents a complete ingested document and contains
/// metadata about the tree structure without holding the actual nodes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Document {
    /// Unique identifier for this document
    pub id: DocumentId,

    /// Human-readable title
    pub title: String,

    /// ID of the root node in the tree
    pub root_node_id: NodeId,

    /// Total number of nodes in the tree
    pub total_nodes: usize,

    /// Maximum depth of the tree
    pub max_depth: u8,

    /// Original source file path or URL
    pub source_path: String,

    /// MIME type of the source document
    pub mime_type: Option<String>,

    /// File size in bytes (if applicable)
    pub file_size: Option<u64>,

    /// When this document was ingested
    pub created_at: DateTime<Utc>,

    /// When this document was last updated
    pub updated_at: DateTime<Utc>,

    /// Custom metadata
    pub metadata: std::collections::HashMap<String, String>,
}

impl Document {
    /// Create a new Document with generated ID
    pub fn new(title: String) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        Self {
            id: id.clone(),
            title,
            root_node_id: String::new(), // Set later during ingestion
            total_nodes: 0,
            max_depth: 0,
            source_path: String::new(),
            mime_type: None,
            file_size: None,
            created_at: now,
            updated_at: now,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Create a document from a file path
    pub fn from_path(title: String, path: &str) -> Self {
        let mut doc = Self::new(title);
        doc.source_path = path.to_string();
        doc
    }

    /// Set the root node ID
    pub fn set_root_node(&mut self, root_id: NodeId) {
        self.root_node_id = root_id;
        self.updated_at = Utc::now();
    }

    /// Update tree statistics
    pub fn update_stats(&mut self, total_nodes: usize, max_depth: u8) {
        self.total_nodes = total_nodes;
        self.max_depth = max_depth;
        self.updated_at = Utc::now();
    }

    /// Add custom metadata
    pub fn add_metadata(&mut self, key: &str, value: &str) {
        self.metadata.insert(key.to_string(), value.to_string());
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_page_node_creation() {
        let node = PageNode::new(
            "doc_1".to_string(),
            "Test Node".to_string(),
            Some("A test summary".to_string()),
            1,
        );

        assert!(!node.id.is_empty());
        assert_eq!(node.document_id, "doc_1");
        assert_eq!(node.title, "Test Node");
        assert_eq!(node.summary, "A test summary");
        assert_eq!(node.depth, 1);
        assert!(node.is_leaf()); // No children yet
    }

    #[test]
    fn test_page_node_leaf() {
        let node = PageNode::new_leaf(
            "doc_1".to_string(),
            "Leaf Node".to_string(),
            "This is the content".to_string(),
            "Summary of content".to_string(),
            2,
        );

        assert!(node.is_leaf());
        assert_eq!(node.content, Some("This is the content".to_string()));
    }

    #[test]
    fn test_page_node_hierarchy() {
        let mut parent = PageNode::new_root("doc_1".to_string(), "Root".to_string());
        let mut child = PageNode::new("doc_1".to_string(), "Child".to_string(), None, 1);

        child.set_parent(parent.id.clone());
        parent.add_child(child.id.clone());

        assert!(parent.is_root());
        assert!(!child.is_root());
        assert_eq!(parent.children_ids.len(), 1);
        assert_eq!(child.parent_id, Some(parent.id.clone()));
    }

    #[test]
    fn test_document_creation() {
        let doc = Document::new("Test Document".to_string());

        assert!(!doc.id.is_empty());
        assert_eq!(doc.title, "Test Document");
        assert_eq!(doc.total_nodes, 0);
    }

    #[test]
    fn test_node_serialization() {
        let node = PageNode::new(
            "doc_1".to_string(),
            "Test".to_string(),
            Some("Summary".to_string()),
            0,
        );

        // Test bincode serialization
        let encoded = bincode::serialize(&node).unwrap();
        let decoded: PageNode = bincode::deserialize(&encoded).unwrap();

        assert_eq!(node, decoded);
    }

    #[test]
    fn test_llm_context() {
        let node = PageNode::new(
            "doc_1".to_string(),
            "Introduction".to_string(),
            Some("This chapter covers basics".to_string()),
            0,
        );

        let context = node.to_llm_context();
        assert!(context.contains("Introduction"));
        assert!(context.contains("This chapter covers basics"));
    }
}
