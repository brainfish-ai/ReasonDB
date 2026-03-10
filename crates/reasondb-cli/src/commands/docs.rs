//! Documents management commands

use crate::output::{self, OutputFormat};
use crate::DocsCommands;
use anyhow::Result;
use colored::Colorize;
use comfy_table::Cell;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct Document {
    id: String,
    title: String,
    #[serde(default)]
    table_id: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    author: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    total_nodes: Option<u64>,
    #[serde(default)]
    max_depth: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct IngestTextBody {
    title: String,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    generate_summaries: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<std::collections::HashMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    chunk_strategy: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct IngestResult {
    document_id: String,
    title: String,
    total_nodes: u64,
    max_depth: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
enum JobStatus {
    Queued,
    Processing {
        #[serde(default)]
        progress: Option<String>,
    },
    Completed {
        result: IngestResult,
    },
    Failed {
        error: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct JobStatusResponse {
    job_id: String,
    #[serde(flatten)]
    status: JobStatus,
}

#[derive(Debug, Serialize, Deserialize)]
struct MigrateResult {
    document_id: String,
    nodes_migrated: u64,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MigrateAllResponse {
    total_documents: u64,
    migrated_documents: u64,
    total_nodes_migrated: u64,
    failed: u64,
    results: Vec<MigrateResult>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ResyncResult {
    document_id: String,
    #[serde(default)]
    job_id: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ResyncAllResponse {
    total: u64,
    queued: u64,
    failed: u64,
    results: Vec<ResyncResult>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TreeResponse {
    document: Document,
    tree: serde_json::Value,
}

pub async fn run(url: &str, cmd: DocsCommands, format: OutputFormat) -> Result<()> {
    let client = reqwest::Client::new();

    match cmd {
        DocsCommands::List { table, limit } => {
            let mut request_url = format!("{}/v1/documents?limit={}", url, limit);
            if let Some(table_id) = &table {
                request_url.push_str(&format!("&table_id={}", table_id));
            }

            let documents: Vec<Document> = client.get(&request_url).send().await?.json().await?;

            match format {
                OutputFormat::Json => {
                    println!("{}", serde_json::to_string_pretty(&documents)?);
                }
                OutputFormat::Csv => {
                    println!("id,title,table_id,tags,author,created_at");
                    for doc in &documents {
                        println!(
                            "{},{},{},{},{},{}",
                            doc.id,
                            doc.title,
                            doc.table_id.as_deref().unwrap_or(""),
                            doc.tags.join(";"),
                            doc.author.as_deref().unwrap_or(""),
                            doc.created_at.as_deref().unwrap_or("")
                        );
                    }
                }
                OutputFormat::Table => {
                    if documents.is_empty() {
                        output::info(
                            "No documents found. Ingest one with: reasondb docs ingest <title>",
                        );
                    } else {
                        let mut t =
                            output::create_table(vec!["ID", "Title", "Tags", "Author", "Nodes"]);

                        for doc in &documents {
                            t.add_row(vec![
                                Cell::new(output::format_id(&doc.id)),
                                Cell::new(truncate(&doc.title, 40)),
                                Cell::new(truncate(&doc.tags.join(", "), 20)),
                                Cell::new(doc.author.as_deref().unwrap_or("-")),
                                Cell::new(
                                    doc.total_nodes
                                        .map(|n| n.to_string())
                                        .unwrap_or("-".to_string()),
                                ),
                            ]);
                        }

                        println!("\n{}\n", t);
                        println!(
                            "{} {} document(s)",
                            "Total:".dimmed(),
                            documents.len().to_string().green()
                        );
                    }
                }
            }
        }

        DocsCommands::Get { id, tree } => {
            if tree {
                let response: TreeResponse = client
                    .get(format!("{}/v1/documents/{}/tree", url, id))
                    .send()
                    .await?
                    .json()
                    .await?;

                println!("{}", serde_json::to_string_pretty(&response)?);
            } else {
                let response: Document = client
                    .get(format!("{}/v1/documents/{}", url, id))
                    .send()
                    .await?
                    .json()
                    .await?;

                match format {
                    OutputFormat::Json => {
                        println!("{}", serde_json::to_string_pretty(&response)?);
                    }
                    _ => {
                        println!();
                        println!("  {} {}", "ID:".dimmed(), response.id);
                        println!("  {} {}", "Title:".dimmed(), response.title.green());
                        println!(
                            "  {} {}",
                            "Table:".dimmed(),
                            response.table_id.as_deref().unwrap_or("-")
                        );
                        println!("  {} {}", "Tags:".dimmed(), response.tags.join(", "));
                        println!(
                            "  {} {}",
                            "Author:".dimmed(),
                            response.author.as_deref().unwrap_or("-")
                        );
                        if let Some(nodes) = response.total_nodes {
                            println!("  {} {}", "Nodes:".dimmed(), nodes);
                        }
                        if let Some(created) = &response.created_at {
                            println!("  {} {}", "Created:".dimmed(), created);
                        }
                        println!();
                    }
                }
            }
        }

        DocsCommands::Delete { id, force } => {
            if !force {
                println!(
                    "{} Are you sure you want to delete document '{}'? [y/N] ",
                    "Warning:".yellow().bold(),
                    id.cyan()
                );

                let mut input = String::new();
                std::io::stdin().read_line(&mut input)?;

                if !input.trim().eq_ignore_ascii_case("y") {
                    output::info("Cancelled");
                    return Ok(());
                }
            }

            client
                .delete(format!("{}/v1/documents/{}", url, id))
                .send()
                .await?;

            output::success(&format!("Deleted document '{}'", id));
        }

        DocsCommands::Ingest {
            title,
            content,
            file,
            table,
            tags,
            author,
        } => {
            let table = table.ok_or_else(|| {
                anyhow::anyhow!(
                    "--table is required for ingest. Use `reasondb tables list` to see available tables."
                )
            })?;

            let content = if let Some(file_path) = file {
                std::fs::read_to_string(&file_path)?
            } else if let Some(c) = content {
                c
            } else {
                return Err(anyhow::anyhow!(
                    "Either --content or --file must be provided"
                ));
            };

            let tags: Option<Vec<String>> =
                tags.map(|t| t.split(',').map(|s| s.trim().to_string()).collect());

            // Store author in metadata if provided
            let metadata: Option<std::collections::HashMap<String, serde_json::Value>> = author
                .map(|a| {
                    let mut m = std::collections::HashMap::new();
                    m.insert("author".to_string(), serde_json::Value::String(a));
                    m
                });

            let request = IngestTextBody {
                title: title.clone(),
                content,
                generate_summaries: None,
                tags,
                metadata,
                chunk_strategy: None,
            };

            let job: JobStatusResponse = client
                .post(format!("{}/v1/tables/{}/ingest/text", url, table))
                .json(&request)
                .send()
                .await?
                .json()
                .await?;

            let job_id = job.job_id.clone();
            output::info(&format!(
                "Ingestion queued (job: {})...",
                &job_id[..job_id.len().min(12)]
            ));

            // Poll until the job completes or fails
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

                let status: JobStatusResponse = client
                    .get(format!("{}/v1/jobs/{}", url, job_id))
                    .send()
                    .await?
                    .json()
                    .await?;

                match status.status {
                    JobStatus::Completed { result } => {
                        match format {
                            OutputFormat::Json => {
                                println!("{}", serde_json::to_string_pretty(&result)?);
                            }
                            _ => {
                                output::success(&format!("Ingested document '{}'", title.green()));
                                println!("  {} {}", "ID:".dimmed(), result.document_id);
                                println!("  {} {}", "Nodes:".dimmed(), result.total_nodes);
                                println!("  {} {}", "Depth:".dimmed(), result.max_depth);
                            }
                        }
                        break;
                    }
                    JobStatus::Failed { error } => {
                        return Err(anyhow::anyhow!("Ingestion failed: {}", error));
                    }
                    JobStatus::Processing { progress } => {
                        if let Some(p) = progress {
                            output::info(&p);
                        }
                    }
                    JobStatus::Queued => {}
                }
            }
        }

        DocsCommands::Migrate { id } => {
            if let Some(doc_id) = id {
                let result: MigrateResult = client
                    .post(format!("{}/v1/documents/{}/migrate", url, doc_id))
                    .send()
                    .await?
                    .json()
                    .await?;

                match format {
                    OutputFormat::Json => {
                        println!("{}", serde_json::to_string_pretty(&result)?);
                    }
                    _ => {
                        if let Some(ref err) = result.error {
                            eprintln!("{} {}", "Failed:".red().bold(), err);
                        } else {
                            output::success(&format!(
                                "Migrated {} nodes for document '{}'",
                                result.nodes_migrated, doc_id
                            ));
                        }
                    }
                }
            } else {
                let result: MigrateAllResponse = client
                    .post(format!("{}/v1/documents/migrate", url))
                    .send()
                    .await?
                    .json()
                    .await?;

                match format {
                    OutputFormat::Json => {
                        println!("{}", serde_json::to_string_pretty(&result)?);
                    }
                    _ => {
                        output::success(&format!(
                            "Migrated {}/{} documents ({} nodes total, {} failed)",
                            result.migrated_documents,
                            result.total_documents,
                            result.total_nodes_migrated,
                            result.failed
                        ));
                        for r in &result.results {
                            if let Some(ref err) = r.error {
                                println!(
                                    "  {} {} — {}",
                                    "x".red(),
                                    output::format_id(&r.document_id),
                                    err
                                );
                            }
                        }
                    }
                }
            }
        }

        DocsCommands::Resync { ids, table, force } => {
            if !ids.is_empty() && table.is_some() {
                return Err(anyhow::anyhow!(
                    "Cannot use both document IDs and --table at the same time"
                ));
            }

            if !force {
                let target = if ids.len() == 1 {
                    format!("document '{}'", ids[0])
                } else if ids.len() > 1 {
                    format!("{} documents", ids.len())
                } else if let Some(ref t) = table {
                    format!("all documents in table '{}'", t)
                } else {
                    "ALL documents".to_string()
                };
                println!(
                    "{} This will delete and re-ingest {} (including LLM summarization). Continue? [y/N] ",
                    "Warning:".yellow().bold(),
                    target.cyan(),
                );

                let mut input = String::new();
                std::io::stdin().read_line(&mut input)?;

                if !input.trim().eq_ignore_ascii_case("y") {
                    output::info("Cancelled");
                    return Ok(());
                }
            }

            // Single document — use dedicated endpoint for cleaner output
            if ids.len() == 1 {
                let doc_id = &ids[0];
                let result: ResyncResult = client
                    .post(format!("{}/v1/documents/{}/resync", url, doc_id))
                    .send()
                    .await?
                    .json()
                    .await?;

                match format {
                    OutputFormat::Json => {
                        println!("{}", serde_json::to_string_pretty(&result)?);
                    }
                    _ => {
                        if let Some(job_id) = &result.job_id {
                            output::success(&format!("Resync queued for document '{}'", doc_id));
                            println!("  {} {}", "Job ID:".dimmed(), job_id);
                        } else {
                            eprintln!(
                                "{} {}",
                                "Failed:".red().bold(),
                                result.error.as_deref().unwrap_or("unknown error")
                            );
                        }
                    }
                }
            } else {
                // Multiple IDs, table filter, or all documents
                let resync_url = if let Some(ref t) = table {
                    format!("{}/v1/documents/resync?table_id={}", url, t)
                } else {
                    format!("{}/v1/documents/resync", url)
                };

                let body = if ids.is_empty() {
                    serde_json::json!({})
                } else {
                    serde_json::json!({ "document_ids": ids })
                };

                let result: ResyncAllResponse = client
                    .post(resync_url)
                    .json(&body)
                    .send()
                    .await?
                    .json()
                    .await?;

                match format {
                    OutputFormat::Json => {
                        println!("{}", serde_json::to_string_pretty(&result)?);
                    }
                    _ => {
                        output::success(&format!(
                            "Resync queued for {}/{} documents ({} failed)",
                            result.queued, result.total, result.failed
                        ));
                        for r in &result.results {
                            if let Some(ref err) = r.error {
                                println!(
                                    "  {} {} — {}",
                                    "x".red(),
                                    output::format_id(&r.document_id),
                                    err
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() > max_len {
        format!("{}...", &s[..max_len - 3])
    } else {
        s.to_string()
    }
}
