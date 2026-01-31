use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher, EventKind};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use indexmap::IndexMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentsConfig {
    pub agents: IndexMap<String, AgentConfig>,
}

impl Default for AgentsConfig {
    fn default() -> Self {
        let mut agents = IndexMap::new();
        agents.insert(
            "GitHub Copilot".to_string(),
            AgentConfig {
                command: "npx".to_string(),
                args: vec![
                    "@github/copilot-language-server@latest".to_string(),
                    "--acp".to_string(),
                ],
            },
        );
        agents.insert(
            "Claude Code".to_string(),
            AgentConfig {
                command: "npx".to_string(),
                args: vec![
                    "@zed-industries/claude-code-acp@latest".to_string(),
                ],
            },
        );
        agents.insert(
            "Gemini CLI".to_string(),
            AgentConfig {
                command: "npx".to_string(),
                args: vec![
                    "@google/gemini-cli@latest".to_string(),
                    "--experimental-acp".to_string(),
                ],
            },
        );
        agents.insert(
            "Qwen Code".to_string(),
            AgentConfig {
                command: "npx".to_string(),
                args: vec![
                    "@qwen-code/qwen-code@latest".to_string(),
                    "--acp".to_string(),
                    "--experimental-skills".to_string(),
                ],
            },
        );
        AgentsConfig { agents }
    }
}

pub struct ConfigManager {
    config: Arc<RwLock<AgentsConfig>>,
    config_path: PathBuf,
    #[allow(dead_code)]
    watcher: Option<RecommendedWatcher>,
}

impl ConfigManager {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let config_path = get_config_path()?;
        
        // Create config directory if it doesn't exist
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        // Load initial config or create default
        let config = if config_path.exists() {
            load_config(&config_path)?
        } else {
            let default_config = AgentsConfig::default();
            save_config(&config_path, &default_config)?;
            default_config
        };

        let config = Arc::new(RwLock::new(config));
        let config_clone = Arc::clone(&config);
        let config_path_clone = config_path.clone();
        let app_handle = app.clone();

        // Set up file watcher
        let watcher = setup_watcher(config_clone, config_path_clone, app_handle)?;

        Ok(Self {
            config,
            config_path,
            watcher: Some(watcher),
        })
    }

    pub fn get_config(&self) -> AgentsConfig {
        self.config.read().clone()
    }

    pub fn reload(&self) -> Result<AgentsConfig, String> {
        let new_config = load_config(&self.config_path)?;
        *self.config.write() = new_config.clone();
        Ok(new_config)
    }

    pub fn get_config_path(&self) -> PathBuf {
        self.config_path.clone()
    }

    pub fn save(&self) -> Result<(), String> {
        let config = self.config.read();
        save_config(&self.config_path, &config)
    }

    pub fn add_agent(&self, name: String, config: AgentConfig) -> Result<AgentsConfig, String> {
        {
            let mut agents_config = self.config.write();
            agents_config.agents.insert(name, config);
        }
        self.save()?;
        Ok(self.get_config())
    }

    pub fn remove_agent(&self, name: &str) -> Result<AgentsConfig, String> {
        {
            let mut agents_config = self.config.write();
            agents_config.agents.shift_remove(name);
        }
        self.save()?;
        Ok(self.get_config())
    }

    pub fn update_agent(&self, name: String, config: AgentConfig) -> Result<AgentsConfig, String> {
        {
            let mut agents_config = self.config.write();
            if agents_config.agents.contains_key(&name) {
                agents_config.agents.insert(name, config);
            } else {
                return Err(format!("Agent '{}' not found", name));
            }
        }
        self.save()?;
        Ok(self.get_config())
    }
}

fn get_config_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        dirs::config_dir()
            .map(|p| p.join("acp-ui").join("agents.json"))
            .ok_or_else(|| "Could not find config directory".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        dirs::config_dir()
            .map(|p| p.join("acp-ui").join("agents.json"))
            .ok_or_else(|| "Could not find config directory".to_string())
    }
}

fn load_config(path: &PathBuf) -> Result<AgentsConfig, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_config(path: &PathBuf, config: &AgentsConfig) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn setup_watcher(
    config: Arc<RwLock<AgentsConfig>>,
    config_path: PathBuf,
    app_handle: AppHandle,
) -> Result<RecommendedWatcher, String> {
    let config_path_for_watcher = config_path.clone();
    
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) => {
                        if event.paths.iter().any(|p| p == &config_path_for_watcher) {
                            if let Ok(new_config) = load_config(&config_path_for_watcher) {
                                *config.write() = new_config.clone();
                                let _ = app_handle.emit("config-changed", new_config);
                            }
                        }
                    }
                    _ => {}
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    // Watch the config directory
    if let Some(parent) = config_path.parent() {
        watcher
            .watch(parent, RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;
    }

    Ok(watcher)
}
