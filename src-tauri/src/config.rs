use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtraPane {
    #[serde(default = "default_dir")]
    pub dir: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delay_ms: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wait_for_text: Option<String>,
}

fn default_dir() -> String {
    "h".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Button {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub icon: Option<String>,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub cwd: Option<String>,
    #[serde(default = "default_open_in")]
    pub open_in: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub extra_panes: Vec<ExtraPane>,
}

fn default_open_in() -> String {
    "tab".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub buttons: Vec<Button>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ButtonsConfig {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub groups: Vec<Group>,
}

fn default_version() -> u32 {
    1
}

impl Default for ButtonsConfig {
    fn default() -> Self {
        ButtonsConfig {
            version: 1,
            groups: vec![Group {
                id: "default".to_string(),
                label: "Default".to_string(),
                icon: Some("👋".to_string()),
                buttons: vec![Button {
                    id: "hello-world".to_string(),
                    label: "Hello world".to_string(),
                    icon: Some("🚀".to_string()),
                    command: "echo".to_string(),
                    args: vec!["hello world".to_string()],
                    cwd: None,
                    open_in: "split-h".to_string(),
                    extra_panes: vec![],
                }],
            }],
        }
    }
}

fn resolve_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;
    Ok(dir.join("buttons.json"))
}

#[tauri::command]
pub fn config_load(app: AppHandle) -> Result<ButtonsConfig, String> {
    let path = resolve_config_path(&app)?;
    if !path.exists() {
        let defaults = ButtonsConfig::default();
        let json = serde_json::to_string_pretty(&defaults)
            .map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())?;
        return Ok(defaults);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let config: ButtonsConfig =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
pub fn config_save(app: AppHandle, config: ButtonsConfig) -> Result<(), String> {
    let path = resolve_config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn config_path(app: AppHandle) -> Result<String, String> {
    let path = resolve_config_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}
