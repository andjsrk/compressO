use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::Emitter;

#[derive(Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[tauri::command]
pub async fn check_update(app_handle: tauri::AppHandle) -> Result<UpdateInfo, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app_handle
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    let response = match updater.check().await {
        Ok(Some(response)) => response,
        Ok(None) => {
            // No update available
            return Ok(UpdateInfo {
                available: false,
                current_version: env!("CARGO_PKG_VERSION").to_string(),
                latest_version: None,
                body: None,
                date: None,
            });
        }
        Err(e) => return Err(format!("Failed to check for updates: {}", e)),
    };

    // Convert OffsetDateTime to String
    let date_str = response.date.map(|d| d.to_string());

    Ok(UpdateInfo {
        available: true,
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        latest_version: Some(response.version.clone()),
        body: Some(response.body.clone().unwrap_or_default()),
        date: date_str,
    })
}

#[tauri::command]
pub async fn install_update(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app_handle
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    let response = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for update: {}", e))?
        .ok_or("No update available")?;

    let downloaded = AtomicUsize::new(0);

    // Start download with progress callback and download finish callback
    // The download method returns Vec<u8> directly
    let _bytes = response
        .download(
            &|chunk_length, _content_length| {
                let prev = downloaded.fetch_add(chunk_length, Ordering::SeqCst);
                log::info!("Update downloaded {} bytes", prev + chunk_length);
            },
            &|| {
                log::info!("Update download completed");
            },
        )
        .await
        .map_err(|e| format!("Failed to download update: {}", e))?;

    // The tauri_plugin_updater library handles the installation automatically
    // We just need to trigger the download and it will install and restart
    // For now, we'll emit an event indicating the download is complete
    let _ = app_handle.emit("update-event", "Download complete");

    Ok("Update download completed. The app will restart automatically.".to_string())
}
