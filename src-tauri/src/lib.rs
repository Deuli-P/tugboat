mod config;
mod pty;
mod session;

use config::{config_load, config_path, config_save};
use pty::{pty_kill, pty_resize, pty_spawn, pty_write, PtyState};
use session::{session_clear, session_load, session_save};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(PtyState::default())
        .invoke_handler(tauri::generate_handler![
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            config_load,
            config_save,
            config_path,
            session_load,
            session_save,
            session_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
