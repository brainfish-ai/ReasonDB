//! Tests for RQL

use tempfile::tempdir;

use crate::model::{Document, Table};
use crate::store::NodeStore;

use super::*;

fn create_test_store() -> (NodeStore, tempfile::TempDir) {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let store = NodeStore::open(&db_path).unwrap();
    (store, dir)
}

fn setup_test_data(store: &NodeStore) {
    // Create table
    let table = Table::with_id("legal".to_string(), "Legal Contracts".to_string());
    store.insert_table(&table).unwrap();

    // Create documents
    let mut doc1 = Document::new("Contract A".to_string(), "legal");
    doc1.tags = vec!["nda".to_string(), "active".to_string()];
    doc1.author = Some("Alice".to_string());
    doc1.set_metadata("status", serde_json::json!("active"));
    doc1.set_metadata("value", serde_json::json!(50000));
    store.insert_document(&doc1).unwrap();

    let mut doc2 = Document::new("Contract B".to_string(), "legal");
    doc2.tags = vec!["service".to_string(), "draft".to_string()];
    doc2.author = Some("Bob".to_string());
    doc2.set_metadata("status", serde_json::json!("draft"));
    doc2.set_metadata("value", serde_json::json!(25000));
    store.insert_document(&doc2).unwrap();

    let mut doc3 = Document::new("Contract C".to_string(), "legal");
    doc3.tags = vec!["nda".to_string(), "expired".to_string()];
    doc3.author = Some("Alice".to_string());
    doc3.set_metadata("status", serde_json::json!("expired"));
    doc3.set_metadata("value", serde_json::json!(100000));
    store.insert_document(&doc3).unwrap();
}

// ==================== Query Parsing Tests ====================

#[test]
fn test_parse_simple_select() {
    let query = Query::parse("SELECT * FROM legal").unwrap();
    assert_eq!(query.from.table, "legal");
    assert!(matches!(query.select, SelectClause::All));
}

#[test]
fn test_parse_select_count() {
    let query = Query::parse("SELECT COUNT(*) FROM legal").unwrap();
    assert!(matches!(query.select, SelectClause::Count));
}

#[test]
fn test_parse_where_string() {
    let query = Query::parse("SELECT * FROM legal WHERE author = 'Alice'").unwrap();
    assert!(query.where_clause.is_some());
}

#[test]
fn test_parse_where_number() {
    let query = Query::parse("SELECT * FROM legal WHERE metadata.value > 30000").unwrap();
    assert!(query.where_clause.is_some());
}

#[test]
fn test_parse_where_and_or() {
    let query = Query::parse(
        "SELECT * FROM legal WHERE status = 'active' AND value > 1000 OR author = 'Bob'",
    )
    .unwrap();
    assert!(query.where_clause.is_some());
}

#[test]
fn test_parse_tags_contains() {
    let query = Query::parse("SELECT * FROM legal WHERE tags CONTAINS ALL ('nda', 'active')")
        .unwrap();
    assert!(query.where_clause.is_some());
}

#[test]
fn test_parse_search() {
    let query = Query::parse("SELECT * FROM legal SEARCH 'liability clause'").unwrap();
    assert!(matches!(query.search, Some(SearchClause::FullText(_))));
}

#[test]
fn test_parse_reason() {
    let query =
        Query::parse("SELECT * FROM legal REASON 'What are the penalties?' WITH CONFIDENCE > 0.7")
            .unwrap();
    match query.search {
        Some(SearchClause::Semantic {
            min_confidence, ..
        }) => {
            assert_eq!(min_confidence, Some(0.7));
        }
        _ => panic!("Expected semantic search"),
    }
}

#[test]
fn test_parse_order_limit() {
    let query =
        Query::parse("SELECT * FROM legal ORDER BY created_at DESC LIMIT 10 OFFSET 5").unwrap();
    assert!(query.order_by.is_some());
    assert_eq!(query.limit.as_ref().unwrap().count, 10);
    assert_eq!(query.limit.as_ref().unwrap().offset, Some(5));
}

// ==================== Query Builder Tests ====================

#[test]
fn test_builder_simple() {
    let query = QueryBuilder::new().from("legal").build().unwrap();
    assert_eq!(query.from.table, "legal");
}

#[test]
fn test_builder_with_conditions() {
    let query = QueryBuilder::new()
        .from("legal")
        .where_eq("status", "active")
        .where_gt("value", 1000.0)
        .build()
        .unwrap();

    assert!(query.where_clause.is_some());
}

#[test]
fn test_builder_with_tags() {
    let query = QueryBuilder::new()
        .from("legal")
        .where_in_tags(&["nda", "active"])
        .build()
        .unwrap();

    assert!(query.where_clause.is_some());
}

#[test]
fn test_builder_with_search() {
    let query = QueryBuilder::new()
        .from("legal")
        .search("liability")
        .limit(10)
        .build()
        .unwrap();

    assert!(matches!(query.search, Some(SearchClause::FullText(_))));
    assert_eq!(query.limit.unwrap().count, 10);
}

// ==================== Query Execution Tests ====================

#[test]
fn test_execute_select_all() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query = Query::parse("SELECT * FROM legal").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 3);
    assert_eq!(result.documents.len(), 3);
}

#[test]
fn test_execute_where_author() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query = Query::parse("SELECT * FROM legal WHERE author = 'Alice'").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 2);
    for doc_match in &result.documents {
        assert_eq!(doc_match.document.author, Some("Alice".to_string()));
    }
}

#[test]
fn test_execute_where_metadata() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query = Query::parse("SELECT * FROM legal WHERE metadata.status = 'active'").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 1);
    assert_eq!(result.documents[0].document.title, "Contract A");
}

#[test]
fn test_execute_where_numeric() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query = Query::parse("SELECT * FROM legal WHERE metadata.value > 30000").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 2); // Contract A (50000) and Contract C (100000)
}

#[test]
fn test_execute_tags_contains_all() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query =
        Query::parse("SELECT * FROM legal WHERE tags CONTAINS ALL ('nda', 'active')").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 1);
    assert_eq!(result.documents[0].document.title, "Contract A");
}

#[test]
fn test_execute_tags_contains_any() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query =
        Query::parse("SELECT * FROM legal WHERE tags CONTAINS ANY ('draft', 'expired')").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 2); // Contract B and Contract C
}

#[test]
fn test_execute_order_by() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query = Query::parse("SELECT * FROM legal ORDER BY title ASC").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.documents[0].document.title, "Contract A");
    assert_eq!(result.documents[1].document.title, "Contract B");
    assert_eq!(result.documents[2].document.title, "Contract C");
}

#[test]
fn test_execute_limit_offset() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query = Query::parse("SELECT * FROM legal ORDER BY title ASC LIMIT 2 OFFSET 1").unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 3); // Total before pagination
    assert_eq!(result.documents.len(), 2); // After pagination
    assert_eq!(result.documents[0].document.title, "Contract B");
    assert_eq!(result.documents[1].document.title, "Contract C");
}

#[test]
fn test_execute_complex_query() {
    let (store, _dir) = create_test_store();
    setup_test_data(&store);

    let query = Query::parse(
        "SELECT * FROM legal \
         WHERE author = 'Alice' AND metadata.value > 40000 \
         ORDER BY title DESC \
         LIMIT 10",
    )
    .unwrap();
    let result = store.execute_rql(&query).unwrap();

    assert_eq!(result.total_count, 2); // Contract A (50000) and Contract C (100000)
    assert_eq!(result.documents[0].document.title, "Contract C"); // DESC order
}

// ==================== Error Handling Tests ====================

#[test]
fn test_parse_error_missing_from() {
    let result = Query::parse("SELECT *");
    assert!(result.is_err());
}

#[test]
fn test_parse_error_invalid_operator() {
    let result = Query::parse("SELECT * FROM t WHERE x == 1");
    assert!(result.is_err());
}

#[test]
fn test_builder_error_missing_from() {
    let result = QueryBuilder::new().where_eq("x", "y").build();
    assert!(result.is_err());
}
