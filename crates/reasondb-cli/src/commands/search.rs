//! Search command

use crate::output::{self, OutputFormat};
use anyhow::Result;
use colored::Colorize;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct SearchRequest {
    query: String,
    table_id: Option<String>,
    top_k: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CrossRefSectionItem {
    node_id: String,
    title: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResult {
    content: String,
    #[serde(default)]
    title: Option<String>,
    confidence: f64,
    document_id: String,
    #[serde(default)]
    node_id: Option<String>,
    #[serde(default)]
    path: Option<Vec<PathNode>>,
    #[serde(default)]
    cross_ref_sections: Vec<CrossRefSectionItem>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PathNode {
    node_id: String,
    title: String,
    #[serde(default)]
    reasoning: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResponse {
    results: Vec<SearchResult>,
    stats: SearchStats,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchStats {
    nodes_visited: u64,
    llm_calls: u64,
    total_time_ms: u64,
}

pub async fn run(
    url: &str,
    query: String,
    table: Option<String>,
    top_k: usize,
    format: OutputFormat,
) -> Result<()> {
    let client = reqwest::Client::new();

    println!("Searching for: {}", query.cyan());
    println!();

    let request = SearchRequest {
        query,
        table_id: table,
        top_k: Some(top_k),
    };

    let response: SearchResponse = client
        .post(format!("{}/v1/search", url))
        .json(&request)
        .send()
        .await?
        .json()
        .await?;

    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(&response)?);
        }
        OutputFormat::Csv => {
            println!("document_id,confidence,title,content,cross_refs");
            for result in &response.results {
                let cross_refs = result
                    .cross_ref_sections
                    .iter()
                    .map(|s| s.title.as_str())
                    .collect::<Vec<_>>()
                    .join("|");
                println!(
                    "{},{:.2},{},\"{}\",\"{}\"",
                    result.document_id,
                    result.confidence,
                    result.title.as_deref().unwrap_or(""),
                    result.content.replace('"', "\"\""),
                    cross_refs.replace('"', "\"\"")
                );
            }
        }
        OutputFormat::Table => {
            if response.results.is_empty() {
                output::info("No results found");
            } else {
                for (i, result) in response.results.iter().enumerate() {
                    println!(
                        "{} {} (confidence: {:.0}%)",
                        format!("{}.", i + 1).yellow().bold(),
                        output::format_id(&result.document_id).dimmed(),
                        result.confidence * 100.0
                    );

                    if let Some(title) = &result.title {
                        println!("   {}", title.green());
                    }

                    // Truncate content for display
                    let content = if result.content.chars().count() > 200 {
                        let end = result
                            .content
                            .char_indices()
                            .nth(200)
                            .map(|(i, _)| i)
                            .unwrap_or(result.content.len());
                        format!("{}...", &result.content[..end])
                    } else {
                        result.content.clone()
                    };
                    println!("   {}", content.dimmed());

                    // Print cross-referenced sections if present
                    if !result.cross_ref_sections.is_empty() {
                        println!(
                            "   {} {}",
                            "→ References:".cyan(),
                            result
                                .cross_ref_sections
                                .iter()
                                .map(|s| s.title.as_str())
                                .collect::<Vec<_>>()
                                .join(", ")
                                .yellow()
                        );
                        for section in &result.cross_ref_sections {
                            let section_content = if section.content.chars().count() > 150 {
                                let end = section
                                    .content
                                    .char_indices()
                                    .nth(150)
                                    .map(|(i, _)| i)
                                    .unwrap_or(section.content.len());
                                format!("{}...", &section.content[..end])
                            } else {
                                section.content.clone()
                            };
                            println!("     {} {}", "•".cyan().dimmed(), section_content.dimmed());
                        }
                    }

                    println!();
                }
            }

            println!("{}", "Stats:".cyan().bold());
            println!(
                "  {} {}",
                "Nodes visited:".dimmed(),
                response.stats.nodes_visited
            );
            println!("  {} {}", "LLM calls:".dimmed(), response.stats.llm_calls);
            println!(
                "  {} {}",
                "Time:".dimmed(),
                output::format_duration_ms(response.stats.total_time_ms)
            );
        }
    }

    Ok(())
}
