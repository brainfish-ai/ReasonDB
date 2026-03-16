use futures_util::StreamExt;
use serde_json::Value;
use tauri::ipc::Channel;

/// Execute a streaming RQL query via reqwest, bypassing the WKWebView HTTP stack.
///
/// WKWebView (used by Tauri on macOS) has an internal resource timeout that
/// fires on long-running requests regardless of SSE keep-alive heartbeats.
/// REASON queries can take 30–120 s, so they are routed through this native
/// Rust command which uses a dedicated reqwest client with a 5-minute timeout.
///
/// Progress events are forwarded to the frontend via the `on_progress`
/// Channel<Value>; the final QueryServerResponse is returned as the Ok value.
#[tauri::command]
async fn execute_reason_stream(
    base_url: String,
    query: String,
    api_key: Option<String>,
    on_progress: Channel<Value>,
) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}/v1/query/stream", base_url);

    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "query": query }));

    if let Some(key) = api_key {
        req = req.header("X-API-Key", key);
    }

    let response = req.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        // Try to pull out a JSON "message" field; fall back to raw body.
        let message = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(String::from))
            .unwrap_or(body);
        return Err(format!("HTTP {}: {}", status, message));
    }

    let mut byte_stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut event_type = String::new();
    let mut event_data = String::new();

    while let Some(chunk) = byte_stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        // Consume all complete lines from the buffer.
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim_end_matches('\r').to_string();
            buffer = buffer[pos + 1..].to_string();

            if line.starts_with(':') {
                // SSE comment (": heartbeat") — keep-alive, ignore.
                continue;
            } else if let Some(rest) = line.strip_prefix("event:") {
                event_type = rest.trim().to_string();
            } else if let Some(rest) = line.strip_prefix("data:") {
                event_data = rest.trim().to_string();
            } else if line.is_empty() {
                if event_type.is_empty() || event_data.is_empty() {
                    // Blank separator without a complete event — skip.
                    event_type.clear();
                    event_data.clear();
                    continue;
                }
                match event_type.as_str() {
                    "progress" => {
                        if let Ok(data) = serde_json::from_str::<Value>(&event_data) {
                            // Best-effort send — ignore if the frontend closed the channel.
                            let _ = on_progress.send(data);
                        }
                    }
                    "complete" => {
                        return serde_json::from_str::<Value>(&event_data)
                            .map_err(|e| e.to_string());
                    }
                    "error" => {
                        return Err(event_data);
                    }
                    _ => {}
                }
                event_type.clear();
                event_data.clear();
            }
        }
    }

    // The byte stream ended — check if a final event is still in the buffer
    // (server omitted the trailing blank line).
    if !event_type.is_empty() && !event_data.is_empty() {
        match event_type.as_str() {
            "complete" => {
                return serde_json::from_str::<Value>(&event_data).map_err(|e| e.to_string());
            }
            "error" => return Err(event_data),
            _ => {}
        }
    }

    Err("Stream ended without results".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![execute_reason_stream])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
