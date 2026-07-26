use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn resolve_session_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create data dir: {}", e))?;
    Ok(dir.join("session.json"))
}

#[tauri::command]
pub fn session_load(app: AppHandle) -> Result<Option<String>, String> {
    let path = resolve_session_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(Some(content))
}

#[tauri::command]
pub fn session_save(app: AppHandle, json: String) -> Result<(), String> {
    let path = resolve_session_path(&app)?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn session_clear(app: AppHandle) -> Result<(), String> {
    let path = resolve_session_path(&app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
