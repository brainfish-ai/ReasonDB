//! # ReasonDB Core
//!
//! Core library for ReasonDB - a reasoning-native database for AI agents.
//!
//! This crate provides:
//! - Data models (`Table`, `Document`, `PageNode`)
//! - Storage engine (`NodeStore`)
//! - Reasoning engine trait (`ReasoningEngine`)
//! - Search engine with beam search
//! - Filtering with `SearchFilter`
//! - RQL query language
//!
//! ## Example
//!
//! ```rust,no_run
//! use reasondb_core::{NodeStore, PageNode, Document, Table, SearchFilter};
//!
//! # async fn example() -> anyhow::Result<()> {
//! // Open a database
//! let store = NodeStore::open("./my_database")?;
//!
//! // Create a table first (required for documents)
//! let table = Table::new("Legal Contracts".to_string());
//! store.insert_table(&table)?;
//!
//! // Create a document in the table
//! let mut doc = Document::new("NDA Agreement".to_string(), &table.id);
//! doc.tags = vec!["nda".to_string(), "confidential".to_string()];
//! store.insert_document(&doc)?;
//!
//! // Filter documents
//! let filter = SearchFilter::new()
//!     .with_table_id(&table.id)
//!     .with_tags(vec!["nda"]);
//! let docs = store.find_documents(&filter)?;
//!
//! // Or use RQL query language
//! use reasondb_core::rql::Query;
//! let query = Query::parse("SELECT * FROM legal_contracts WHERE author = 'Alice'")?;
//! let results = store.execute_rql(&query)?;
//! # Ok(())
//! # }
//! ```

pub mod engine;
pub mod error;
pub mod llm;
pub mod model;
pub mod rql;
pub mod store;
pub mod text_index;

// Re-export main types
pub use engine::{SearchConfig, SearchEngine, SearchResult};
pub use error::{ReasonError, Result};
pub use llm::{LLMProvider, MockReasoner, Reasoner, ReasoningEngine};
pub use model::{Document, DocumentId, NodeId, NodeMetadata, PageNode, SearchFilter, Table, TableId};
pub use store::{NodeStore, StoreStats};
pub use text_index::{TextIndex, TextSearchResult};
