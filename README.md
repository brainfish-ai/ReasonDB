# 🧠 ReasonDB

> **A database that thinks, not just calculates.**

ReasonDB is a reasoning-native database optimized for AI agent workflows. Unlike Vector DBs (mathematical similarity) or SQL DBs (relational algebra), ReasonDB optimizes for **tree traversal** and **LLM-driven context management**.

## 🎯 Key Features

- **Hierarchical Document Storage**: Documents stored as navigable trees, not flat chunks
- **LLM-Guided Retrieval**: AI reasons through the tree structure, not just similarity search
- **Parallel Branch Exploration**: Concurrent traversal using Rust's async runtime
- **Multi-Format Support**: PDFs, JSON, Markdown, HTML, source code, and more

## 📦 Project Structure

```
reasondb/
├── crates/
│   ├── reasondb-core/      # Core library (models, storage, engine)
│   ├── reasondb-ingest/    # Document ingestion pipeline
│   └── reasondb-server/    # HTTP API server
├── PLAN.md                 # Detailed architecture & implementation plan
└── USE_CASES.md            # Use cases & competitive analysis
```

## 🚀 Quick Start

### Build

```bash
cargo build --release
```

### Run Tests

```bash
cargo test
```

### Basic Usage

```rust
use reasondb_core::{NodeStore, PageNode, Document};

fn main() -> anyhow::Result<()> {
    // Open database
    let store = NodeStore::open("./my_database")?;

    // Create a document
    let doc = Document::new("Annual Report 2024".to_string());
    store.insert_document(&doc)?;

    // Create a hierarchical tree
    let mut root = PageNode::new_root(doc.id.clone(), "Report".to_string());
    let mut chapter1 = PageNode::new(
        doc.id.clone(),
        "Chapter 1: Financials".to_string(),
        Some("This chapter covers Q1-Q4 financial results...".to_string()),
        1,
    );
    
    // Build the tree
    chapter1.set_parent(root.id.clone());
    root.add_child(chapter1.id.clone());

    // Store nodes
    store.insert_node(&root)?;
    store.insert_node(&chapter1)?;

    // Retrieve and traverse
    let children = store.get_children(&root)?;
    println!("Root has {} children", children.len());

    Ok(())
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  ReasonDB                        │
├─────────────────────────────────────────────────┤
│  Ingestion Pipeline    │    Query Engine         │
│  (PDF → Tree)          │    (LLM Traversal)      │
├─────────────────────────────────────────────────┤
│              Storage Engine (redb)               │
│          Nodes Table │ Documents Table           │
└─────────────────────────────────────────────────┘
```

### How It Works

1. **Ingest**: Documents are parsed and converted into hierarchical trees
2. **Summarize**: LLM generates summaries for each node (bottom-up)
3. **Search**: LLM traverses tree, choosing branches based on summaries
4. **Return**: Only relevant leaf nodes returned with full path context

## 📊 Why ReasonDB?

| Approach | Best For | Limitation |
|----------|----------|------------|
| **Vector DB** | Simple factual queries | Loses structure, "similar" ≠ "relevant" |
| **SQL DB** | Structured data | Can't handle unstructured text |
| **Graph DB** | Relationships | Requires explicit entity extraction |
| **ReasonDB** | Complex reasoning | Optimized for AI agent workflows |

## 🛠️ Tech Stack

- **Storage**: `redb` - Pure Rust, ACID-compliant embedded database
- **Serialization**: `bincode` + `serde` - Fast binary encoding
- **Async Runtime**: `tokio` - Parallel branch exploration
- **HTTP Server**: `axum` (coming soon)

## 📅 Roadmap

- [x] **Phase 1**: Core storage (models, redb, CRUD) ✅
- [ ] **Phase 2**: Reasoning engine (LLM trait, beam search)
- [ ] **Phase 3**: Ingestion pipeline (PDF parsing, chunking)
- [ ] **Phase 4**: HTTP API (axum server)
- [ ] **Phase 5**: Optimizations (caching, hybrid retrieval)

## 📄 Documentation

- [PLAN.md](./PLAN.md) - Detailed architecture and implementation plan
- [USE_CASES.md](./USE_CASES.md) - Real-world use cases and competitive analysis

## 📜 License

MIT OR Apache-2.0
