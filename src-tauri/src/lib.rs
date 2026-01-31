mod agent;
mod config;

use agent::{AgentInstance, AgentManager};
use config::{AgentConfig, AgentsConfig, ConfigManager};
use parking_lot::RwLock;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

struct AppState {
    config_manager: Arc<RwLock<Option<ConfigManager>>>,
    agent_manager: AgentManager,
}

#[tauri::command]
fn get_config(state: State<AppState>) -> Result<AgentsConfig, String> {
    let config_manager = state.config_manager.read();
    config_manager
        .as_ref()
        .map(|cm| cm.get_config())
        .ok_or_else(|| "Config manager not initialized".to_string())
}

#[tauri::command]
fn reload_config(state: State<AppState>) -> Result<AgentsConfig, String> {
    let config_manager = state.config_manager.read();
    config_manager
        .as_ref()
        .map(|cm| cm.reload())
        .ok_or_else(|| "Config manager not initialized".to_string())?
}

#[tauri::command]
fn get_config_path(state: State<AppState>) -> Result<String, String> {
    let config_manager = state.config_manager.read();
    config_manager
        .as_ref()
        .map(|cm| cm.get_config_path().to_string_lossy().to_string())
        .ok_or_else(|| "Config manager not initialized".to_string())
}

#[tauri::command]
fn spawn_agent(
    name: String,
    state: State<AppState>,
    app_handle: AppHandle,
) -> Result<AgentInstance, String> {
    let config_manager = state.config_manager.read();
    let config = config_manager
        .as_ref()
        .ok_or_else(|| "Config manager not initialized".to_string())?
        .get_config();

    let agent_config = config
        .agents
        .get(&name)
        .ok_or_else(|| format!("Agent '{}' not found in config", name))?;

    state
        .agent_manager
        .spawn_agent(name, agent_config, app_handle)
}

#[tauri::command]
fn send_to_agent(agent_id: String, message: String, state: State<AppState>) -> Result<(), String> {
    state.agent_manager.send_message(&agent_id, &message)
}

#[tauri::command]
fn kill_agent(agent_id: String, state: State<AppState>) -> Result<(), String> {
    state.agent_manager.kill_agent(&agent_id)
}

#[tauri::command]
fn list_running_agents(state: State<AppState>) -> Vec<String> {
    state.agent_manager.list_running_agents()
}

#[tauri::command]
fn add_agent(
    name: String,
    command: String,
    args: Vec<String>,
    state: State<AppState>,
) -> Result<AgentsConfig, String> {
    let config_manager = state.config_manager.read();
    config_manager
        .as_ref()
        .ok_or_else(|| "Config manager not initialized".to_string())?
        .add_agent(name, AgentConfig { command, args })
}

#[tauri::command]
fn remove_agent(name: String, state: State<AppState>) -> Result<AgentsConfig, String> {
    let config_manager = state.config_manager.read();
    config_manager
        .as_ref()
        .ok_or_else(|| "Config manager not initialized".to_string())?
        .remove_agent(&name)
}

#[tauri::command]
fn update_agent(
    name: String,
    command: String,
    args: Vec<String>,
    state: State<AppState>,
) -> Result<AgentsConfig, String> {
    let config_manager = state.config_manager.read();
    config_manager
        .as_ref()
        .ok_or_else(|| "Config manager not initialized".to_string())?
        .update_agent(name, AgentConfig { command, args })
}

#[tauri::command]
fn get_machine_id() -> Result<String, String> {
    machine_uid::get().map_err(|e| format!("Failed to get machine ID: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        config_manager: Arc::new(RwLock::new(None)),
        agent_manager: AgentManager::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state: State<AppState> = app.state();

            // Initialize config manager
            match ConfigManager::new(&app_handle) {
                Ok(cm) => {
                    *state.config_manager.write() = Some(cm);
                }
                Err(e) => {
                    eprintln!("Failed to initialize config manager: {}", e);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            reload_config,
            get_config_path,
            spawn_agent,
            send_to_agent,
            kill_agent,
            list_running_agents,
            add_agent,
            remove_agent,
            update_agent,
            get_machine_id
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
