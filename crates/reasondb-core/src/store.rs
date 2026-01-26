//! Storage engine for ReasonDB
//!
//! This module provides persistent storage using redb, a fast embedded database.
//! It handles serialization with bincode and provides CRUD operations for
//! nodes and documents.

use std::path::Path;

use redb::{Database, ReadableTable, ReadableTableMetadata, TableDefinition};

use crate::error::{ReasonError, Result, StorageError};
use crate::model::{Document, DocumentId, NodeId, PageNode};

/// Table definition for nodes (NodeId -> bincode bytes)
const NODES_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("nodes");

/// Table definition for documents (DocumentId -> bincode bytes)
const DOCUMENTS_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("documents");

/// Table definition for document-to-nodes index (DocumentId -> node IDs as JSON)
const DOC_NODES_INDEX: TableDefinition<&str, &[u8]> = TableDefinition::new("doc_nodes_index");

/// Storage engine for ReasonDB.
///
/// Provides persistent storage for `PageNode` and `Document` objects using redb.
/// All data is serialized using bincode for efficient binary encoding.
///
/// # Example
///
/// ```rust,no_run
/// use reasondb_core::{NodeStore, PageNode, Document};
///
/// # fn main() -> anyhow::Result<()> {
/// let store = NodeStore::open("./my_database")?;
///
/// // Insert a document
/// let doc = Document::new("My Document".to_string());
/// store.insert_document(&doc)?;
///
/// // Insert nodes
/// let node = PageNode::new_root(doc.id.clone(), "Root".to_string());
/// store.insert_node(&node)?;
///
/// // Retrieve
/// let retrieved = store.get_node(&node.id)?;
/// # Ok(())
/// # }
/// ```
pub struct NodeStore {
    db: Database,
}

impl NodeStore {
    /// Open or create a database at the given path.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the database file
    ///
    /// # Errors
    ///
    /// Returns an error if the database cannot be opened or created.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let db = Database::create(path).map_err(StorageError::from)?;

        // Initialize tables
        let write_txn = db.begin_write().map_err(StorageError::from)?;
        {
            // Create tables if they don't exist
            let _ = write_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;
            let _ = write_txn.open_table(DOCUMENTS_TABLE).map_err(StorageError::from)?;
            let _ = write_txn.open_table(DOC_NODES_INDEX).map_err(StorageError::from)?;
        }
        write_txn.commit().map_err(StorageError::from)?;

        Ok(Self { db })
    }

    // ==================== Node Operations ====================

    /// Insert a new node into the database.
    ///
    /// # Arguments
    ///
    /// * `node` - The node to insert
    ///
    /// # Errors
    ///
    /// Returns an error if serialization fails or the database operation fails.
    pub fn insert_node(&self, node: &PageNode) -> Result<()> {
        let key = node.id.as_str();
        let value = bincode::serialize(node)?;

        let write_txn = self.db.begin_write().map_err(StorageError::from)?;
        {
            let mut table = write_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;
            table
                .insert(key, value.as_slice())
                .map_err(|e| StorageError::TableError(e.to_string()))?;

            // Update document-node index
            self.update_doc_node_index(&write_txn, &node.document_id, &node.id)?;
        }
        write_txn.commit().map_err(StorageError::from)?;

        Ok(())
    }

    /// Insert multiple nodes in a single transaction.
    ///
    /// More efficient than calling `insert_node` multiple times.
    pub fn insert_nodes(&self, nodes: &[PageNode]) -> Result<()> {
        if nodes.is_empty() {
            return Ok(());
        }

        let write_txn = self.db.begin_write().map_err(StorageError::from)?;
        {
            let mut table = write_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;

            for node in nodes {
                let key = node.id.as_str();
                let value = bincode::serialize(node)?;
                table
                    .insert(key, value.as_slice())
                    .map_err(|e| StorageError::TableError(e.to_string()))?;
            }

            // Update document-node indexes
            for node in nodes {
                self.update_doc_node_index(&write_txn, &node.document_id, &node.id)?;
            }
        }
        write_txn.commit().map_err(StorageError::from)?;

        Ok(())
    }

    /// Get a node by its ID.
    ///
    /// # Arguments
    ///
    /// * `id` - The node ID to look up
    ///
    /// # Returns
    ///
    /// Returns `Ok(Some(node))` if found, `Ok(None)` if not found.
    pub fn get_node(&self, id: &str) -> Result<Option<PageNode>> {
        let read_txn = self.db.begin_read().map_err(StorageError::from)?;
        let table = read_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;

        match table.get(id).map_err(|e| StorageError::TableError(e.to_string()))? {
            Some(value) => {
                let node: PageNode = bincode::deserialize(value.value())?;
                Ok(Some(node))
            }
            None => Ok(None),
        }
    }

    /// Get a node, returning an error if not found.
    pub fn get_node_required(&self, id: &str) -> Result<PageNode> {
        self.get_node(id)?.ok_or_else(|| ReasonError::NodeNotFound(id.to_string()))
    }

    /// Update an existing node.
    ///
    /// # Errors
    ///
    /// Returns `NodeNotFound` if the node doesn't exist.
    pub fn update_node(&self, node: &PageNode) -> Result<()> {
        // Check if exists
        if self.get_node(&node.id)?.is_none() {
            return Err(ReasonError::NodeNotFound(node.id.clone()));
        }

        let key = node.id.as_str();
        let value = bincode::serialize(node)?;

        let write_txn = self.db.begin_write().map_err(StorageError::from)?;
        {
            let mut table = write_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;
            table
                .insert(key, value.as_slice())
                .map_err(|e| StorageError::TableError(e.to_string()))?;
        }
        write_txn.commit().map_err(StorageError::from)?;

        Ok(())
    }

    /// Delete a node by its ID.
    ///
    /// # Returns
    ///
    /// Returns `true` if the node was deleted, `false` if it didn't exist.
    pub fn delete_node(&self, id: &str) -> Result<bool> {
        let write_txn = self.db.begin_write().map_err(StorageError::from)?;
        let deleted = {
            let mut table = write_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;
            let result = table
                .remove(id)
                .map_err(|e| StorageError::TableError(e.to_string()))?;
            result.is_some()
        };
        write_txn.commit().map_err(StorageError::from)?;

        Ok(deleted)
    }

    /// Get all children of a node.
    pub fn get_children(&self, node: &PageNode) -> Result<Vec<PageNode>> {
        let mut children = Vec::with_capacity(node.children_ids.len());

        for child_id in &node.children_ids {
            if let Some(child) = self.get_node(child_id)? {
                children.push(child);
            }
        }

        Ok(children)
    }

    /// Get the parent of a node, if it exists.
    pub fn get_parent(&self, node: &PageNode) -> Result<Option<PageNode>> {
        match &node.parent_id {
            Some(parent_id) => self.get_node(parent_id),
            None => Ok(None),
        }
    }

    /// Get all nodes for a document.
    pub fn get_nodes_for_document(&self, document_id: &str) -> Result<Vec<PageNode>> {
        let read_txn = self.db.begin_read().map_err(StorageError::from)?;
        let index_table = read_txn
            .open_table(DOC_NODES_INDEX)
            .map_err(StorageError::from)?;

        let node_ids: Vec<NodeId> =
            match index_table.get(document_id).map_err(|e| StorageError::TableError(e.to_string()))? {
                Some(value) => serde_json::from_slice(value.value())
                    .map_err(|e| ReasonError::Serialization(e.to_string()))?,
                None => return Ok(Vec::new()),
            };

        let nodes_table = read_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;
        let mut nodes = Vec::with_capacity(node_ids.len());

        for node_id in node_ids {
            if let Some(value) = nodes_table
                .get(node_id.as_str())
                .map_err(|e| StorageError::TableError(e.to_string()))?
            {
                let node: PageNode = bincode::deserialize(value.value())?;
                nodes.push(node);
            }
        }

        Ok(nodes)
    }

    // ==================== Document Operations ====================

    /// Insert a new document.
    pub fn insert_document(&self, doc: &Document) -> Result<()> {
        let key = doc.id.as_str();
        let value = bincode::serialize(doc)?;

        let write_txn = self.db.begin_write().map_err(StorageError::from)?;
        {
            let mut table = write_txn
                .open_table(DOCUMENTS_TABLE)
                .map_err(StorageError::from)?;
            table
                .insert(key, value.as_slice())
                .map_err(|e| StorageError::TableError(e.to_string()))?;
        }
        write_txn.commit().map_err(StorageError::from)?;

        Ok(())
    }

    /// Get a document by its ID.
    pub fn get_document(&self, id: &str) -> Result<Option<Document>> {
        let read_txn = self.db.begin_read().map_err(StorageError::from)?;
        let table = read_txn
            .open_table(DOCUMENTS_TABLE)
            .map_err(StorageError::from)?;

        match table.get(id).map_err(|e| StorageError::TableError(e.to_string()))? {
            Some(value) => {
                let doc: Document = bincode::deserialize(value.value())?;
                Ok(Some(doc))
            }
            None => Ok(None),
        }
    }

    /// Get a document, returning an error if not found.
    pub fn get_document_required(&self, id: &str) -> Result<Document> {
        self.get_document(id)?
            .ok_or_else(|| ReasonError::DocumentNotFound(id.to_string()))
    }

    /// Update an existing document.
    pub fn update_document(&self, doc: &Document) -> Result<()> {
        if self.get_document(&doc.id)?.is_none() {
            return Err(ReasonError::DocumentNotFound(doc.id.clone()));
        }

        let key = doc.id.as_str();
        let value = bincode::serialize(doc)?;

        let write_txn = self.db.begin_write().map_err(StorageError::from)?;
        {
            let mut table = write_txn
                .open_table(DOCUMENTS_TABLE)
                .map_err(StorageError::from)?;
            table
                .insert(key, value.as_slice())
                .map_err(|e| StorageError::TableError(e.to_string()))?;
        }
        write_txn.commit().map_err(StorageError::from)?;

        Ok(())
    }

    /// Delete a document and all its nodes.
    pub fn delete_document(&self, id: &str) -> Result<bool> {
        // First, get all node IDs for this document
        let node_ids = {
            let read_txn = self.db.begin_read().map_err(StorageError::from)?;
            let index_table = read_txn
                .open_table(DOC_NODES_INDEX)
                .map_err(StorageError::from)?;

            match index_table.get(id).map_err(|e| StorageError::TableError(e.to_string()))? {
                Some(value) => {
                    let ids: Vec<NodeId> = serde_json::from_slice(value.value())
                        .map_err(|e| ReasonError::Serialization(e.to_string()))?;
                    ids
                }
                None => Vec::new(),
            }
        };

        // Delete everything in a single transaction
        let write_txn = self.db.begin_write().map_err(StorageError::from)?;
        let deleted = {
            // Delete all nodes
            let mut nodes_table = write_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;
            for node_id in &node_ids {
                let _ = nodes_table
                    .remove(node_id.as_str())
                    .map_err(|e| StorageError::TableError(e.to_string()))?;
            }

            // Delete the document
            let mut docs_table = write_txn
                .open_table(DOCUMENTS_TABLE)
                .map_err(StorageError::from)?;
            let doc_result = docs_table
                .remove(id)
                .map_err(|e| StorageError::TableError(e.to_string()))?;
            let deleted = doc_result.is_some();

            // Delete the index entry
            let mut index_table = write_txn
                .open_table(DOC_NODES_INDEX)
                .map_err(StorageError::from)?;
            let _ = index_table
                .remove(id)
                .map_err(|e| StorageError::TableError(e.to_string()))?;

            deleted
        };
        write_txn.commit().map_err(StorageError::from)?;

        Ok(deleted)
    }

    /// List all documents.
    pub fn list_documents(&self) -> Result<Vec<Document>> {
        let read_txn = self.db.begin_read().map_err(StorageError::from)?;
        let table = read_txn
            .open_table(DOCUMENTS_TABLE)
            .map_err(StorageError::from)?;

        let mut documents = Vec::new();
        let iter = table.iter().map_err(|e| StorageError::TableError(e.to_string()))?;

        for result in iter {
            let (_, value) = result.map_err(|e| StorageError::TableError(e.to_string()))?;
            let doc: Document = bincode::deserialize(value.value())?;
            documents.push(doc);
        }

        Ok(documents)
    }

    /// Get the root node for a document.
    pub fn get_root_node(&self, document_id: &str) -> Result<Option<PageNode>> {
        let doc = match self.get_document(document_id)? {
            Some(d) => d,
            None => return Ok(None),
        };

        if doc.root_node_id.is_empty() {
            return Ok(None);
        }

        self.get_node(&doc.root_node_id)
    }

    // ==================== Helper Methods ====================

    /// Update the document-to-nodes index.
    fn update_doc_node_index(
        &self,
        write_txn: &redb::WriteTransaction,
        document_id: &DocumentId,
        node_id: &NodeId,
    ) -> Result<()> {
        let mut index_table = write_txn
            .open_table(DOC_NODES_INDEX)
            .map_err(StorageError::from)?;

        // Get existing node IDs for this document
        let mut node_ids: Vec<NodeId> = match index_table
            .get(document_id.as_str())
            .map_err(|e| StorageError::TableError(e.to_string()))?
        {
            Some(value) => serde_json::from_slice(value.value())
                .map_err(|e| ReasonError::Serialization(e.to_string()))?,
            None => Vec::new(),
        };

        // Add the new node ID if not already present
        if !node_ids.contains(node_id) {
            node_ids.push(node_id.clone());
            let value = serde_json::to_vec(&node_ids)
                .map_err(|e| ReasonError::Serialization(e.to_string()))?;
            index_table
                .insert(document_id.as_str(), value.as_slice())
                .map_err(|e| StorageError::TableError(e.to_string()))?;
        }

        Ok(())
    }

    /// Get database statistics.
    pub fn stats(&self) -> Result<StoreStats> {
        let read_txn = self.db.begin_read().map_err(StorageError::from)?;

        let nodes_table = read_txn.open_table(NODES_TABLE).map_err(StorageError::from)?;
        let docs_table = read_txn
            .open_table(DOCUMENTS_TABLE)
            .map_err(StorageError::from)?;

        Ok(StoreStats {
            total_nodes: nodes_table.len().map_err(|e| StorageError::TableError(e.to_string()))? as usize,
            total_documents: docs_table.len().map_err(|e| StorageError::TableError(e.to_string()))? as usize,
        })
    }
}

/// Database statistics
#[derive(Debug, Clone)]
pub struct StoreStats {
    pub total_nodes: usize,
    pub total_documents: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_store() -> (NodeStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let store = NodeStore::open(&db_path).unwrap();
        (store, dir)
    }

    #[test]
    fn test_node_crud() {
        let (store, _dir) = create_test_store();

        // Create
        let node = PageNode::new(
            "doc_1".to_string(),
            "Test Node".to_string(),
            Some("A summary".to_string()),
            0,
        );
        store.insert_node(&node).unwrap();

        // Read
        let retrieved = store.get_node(&node.id).unwrap().unwrap();
        assert_eq!(retrieved.title, "Test Node");

        // Update
        let mut updated = retrieved.clone();
        updated.set_summary("Updated summary".to_string());
        store.update_node(&updated).unwrap();

        let retrieved2 = store.get_node(&node.id).unwrap().unwrap();
        assert_eq!(retrieved2.summary, "Updated summary");

        // Delete
        let deleted = store.delete_node(&node.id).unwrap();
        assert!(deleted);

        let not_found = store.get_node(&node.id).unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn test_document_crud() {
        let (store, _dir) = create_test_store();

        // Create
        let doc = Document::new("Test Document".to_string());
        store.insert_document(&doc).unwrap();

        // Read
        let retrieved = store.get_document(&doc.id).unwrap().unwrap();
        assert_eq!(retrieved.title, "Test Document");

        // Update
        let mut updated = retrieved.clone();
        updated.add_metadata("key", "value");
        store.update_document(&updated).unwrap();

        let retrieved2 = store.get_document(&doc.id).unwrap().unwrap();
        assert_eq!(retrieved2.metadata.get("key"), Some(&"value".to_string()));

        // Delete
        let deleted = store.delete_document(&doc.id).unwrap();
        assert!(deleted);
    }

    #[test]
    fn test_batch_insert() {
        let (store, _dir) = create_test_store();

        let nodes: Vec<PageNode> = (0..10)
            .map(|i| {
                PageNode::new(
                    "doc_1".to_string(),
                    format!("Node {}", i),
                    Some(format!("Summary {}", i)),
                    0,
                )
            })
            .collect();

        store.insert_nodes(&nodes).unwrap();

        let stats = store.stats().unwrap();
        assert_eq!(stats.total_nodes, 10);
    }

    #[test]
    fn test_document_nodes_index() {
        let (store, _dir) = create_test_store();

        let doc = Document::new("Test Doc".to_string());
        store.insert_document(&doc).unwrap();

        let nodes: Vec<PageNode> = (0..5)
            .map(|i| {
                PageNode::new(
                    doc.id.clone(),
                    format!("Node {}", i),
                    None,
                    0,
                )
            })
            .collect();

        store.insert_nodes(&nodes).unwrap();

        let doc_nodes = store.get_nodes_for_document(&doc.id).unwrap();
        assert_eq!(doc_nodes.len(), 5);
    }

    #[test]
    fn test_tree_traversal() {
        let (store, _dir) = create_test_store();

        // Create a tree: root -> child1, child2
        let doc = Document::new("Test".to_string());
        store.insert_document(&doc).unwrap();

        let mut root = PageNode::new_root(doc.id.clone(), "Root".to_string());
        let mut child1 = PageNode::new(doc.id.clone(), "Child 1".to_string(), None, 1);
        let mut child2 = PageNode::new(doc.id.clone(), "Child 2".to_string(), None, 1);

        child1.set_parent(root.id.clone());
        child2.set_parent(root.id.clone());
        root.add_child(child1.id.clone());
        root.add_child(child2.id.clone());

        store.insert_node(&root).unwrap();
        store.insert_node(&child1).unwrap();
        store.insert_node(&child2).unwrap();

        // Test get_children
        let children = store.get_children(&root).unwrap();
        assert_eq!(children.len(), 2);

        // Test get_parent
        let parent = store.get_parent(&child1).unwrap().unwrap();
        assert_eq!(parent.id, root.id);
    }

    #[test]
    fn test_delete_document_cascades() {
        let (store, _dir) = create_test_store();

        let doc = Document::new("Test".to_string());
        store.insert_document(&doc).unwrap();

        let nodes: Vec<PageNode> = (0..3)
            .map(|i| PageNode::new(doc.id.clone(), format!("Node {}", i), None, 0))
            .collect();
        store.insert_nodes(&nodes).unwrap();

        // Verify nodes exist
        let stats_before = store.stats().unwrap();
        assert_eq!(stats_before.total_nodes, 3);

        // Delete document (should cascade to nodes)
        store.delete_document(&doc.id).unwrap();

        // Verify nodes are deleted
        let stats_after = store.stats().unwrap();
        assert_eq!(stats_after.total_nodes, 0);
        assert_eq!(stats_after.total_documents, 0);
    }

    #[test]
    fn test_list_documents() {
        let (store, _dir) = create_test_store();

        store.insert_document(&Document::new("Doc 1".to_string())).unwrap();
        store.insert_document(&Document::new("Doc 2".to_string())).unwrap();
        store.insert_document(&Document::new("Doc 3".to_string())).unwrap();

        let docs = store.list_documents().unwrap();
        assert_eq!(docs.len(), 3);
    }
}
