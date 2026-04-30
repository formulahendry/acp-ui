use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher, EventKind};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use indexmap::IndexMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// Transport kind for an ACP agent.
///
/// `stdio` (default, desktop only) launches a subprocess and exchanges
/// JSON-RPC over stdin/stdout. `websocket` and `http` connect to a remote
/// endpoint advertised by an agent that natively speaks ACP over the wire,
/// and require the corresponding `url`/`headers` fields.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentTransport {
    #[default]
    Stdio,
    Websocket,
    Http,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    /// Transport kind. Defaults to `stdio` for backward compatibility with
    /// existing `agents.json` files that only contain `command`/`args`.
    #[serde(default, skip_serializing_if = "is_default_transport")]
    pub transport: AgentTransport,

    // ----- stdio-only fields (optional when transport != stdio) -----
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub env: std::collections::HashMap<String, String>,

    // ----- remote-only fields (optional, used when transport != stdio) -----
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headers: Option<std::collections::HashMap<String, String>>,
}

fn is_default_transport(t: &AgentTransport) -> bool {
    *t == AgentTransport::Stdio
}

impl AgentConfig {
    /// Build a stdio-transport agent config (used by defaults and
    /// backward-compatible callers).
    pub fn stdio(
        command: String,
        args: Vec<String>,
        env: std::collections::HashMap<String, String>,
    ) -> Self {
        Self {
            transport: AgentTransport::Stdio,
            command: Some(command),
            args: Some(args),
            env,
            url: None,
            headers: None,
        }
    }
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
            AgentConfig::stdio(
                "npx".to_string(),
                vec![
                    "@github/copilot-language-server@latest".to_string(),
                    "--acp".to_string(),
                ],
                std::collections::HashMap::new(),
            ),
        );
        agents.insert(
            "Claude Code".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec!["@zed-industries/claude-code-acp@latest".to_string()],
                std::collections::HashMap::new(),
            ),
        );
        agents.insert(
            "Gemini CLI".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec![
                    "@google/gemini-cli@latest".to_string(),
                    "--experimental-acp".to_string(),
                ],
                std::collections::HashMap::new(),
            ),
        );
        agents.insert(
            "Qwen Code".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec![
                    "@qwen-code/qwen-code@latest".to_string(),
                    "--acp".to_string(),
                    "--experimental-skills".to_string(),
                ],
                std::collections::HashMap::new(),
            ),
        );
        agents.insert(
            "Auggie CLI".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec![
                    "@augmentcode/auggie@latest".to_string(),
                    "--acp".to_string(),
                ],
                {
                    let mut env = std::collections::HashMap::new();
                    env.insert("AUGMENT_DISABLE_AUTO_UPDATE".to_string(), "1".to_string());
                    env
                },
            ),
        );
        agents.insert(
            "Qoder CLI".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec![
                    "@qoder-ai/qodercli@latest".to_string(),
                    "--acp".to_string(),
                ],
                std::collections::HashMap::new(),
            ),
        );
        agents.insert(
            "Codex CLI".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec!["@zed-industries/codex-acp@latest".to_string()],
                std::collections::HashMap::new(),
            ),
        );
        agents.insert(
            "OpenCode".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec!["opencode-ai@latest".to_string(), "acp".to_string()],
                std::collections::HashMap::new(),
            ),
        );
        agents.insert(
            "OpenClaw".to_string(),
            AgentConfig::stdio(
                "npx".to_string(),
                vec!["openclaw".to_string(), "acp".to_string()],
                std::collections::HashMap::new(),
            ),
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Old-format `agents.json` files only contain `command/args/env`. The
    /// new struct must still deserialize them as stdio agents so users
    /// don't lose their config on upgrade.
    #[test]
    fn deserializes_legacy_stdio_config() {
        let json = r#"{"agents":{"Legacy":{"command":"npx","args":["x"],"env":{}}}}"#;
        let cfg: AgentsConfig = serde_json::from_str(json).unwrap();
        let a = cfg.agents.get("Legacy").unwrap();
        assert_eq!(a.transport, AgentTransport::Stdio);
        assert_eq!(a.command.as_deref(), Some("npx"));
        assert_eq!(a.url, None);
    }

    /// New-format remote agents must round-trip through serde without losing
    /// the transport / url / headers fields.
    #[test]
    fn roundtrips_remote_websocket_config() {
        let json = r#"{"agents":{"Remote":{"transport":"websocket","url":"wss://x/v1","headers":{"Authorization":"Bearer abc"}}}}"#;
        let cfg: AgentsConfig = serde_json::from_str(json).unwrap();
        let a = cfg.agents.get("Remote").unwrap();
        assert_eq!(a.transport, AgentTransport::Websocket);
        assert_eq!(a.url.as_deref(), Some("wss://x/v1"));
        assert_eq!(a.command, None);
        let serialized = serde_json::to_string(&cfg).unwrap();
        // `transport: "stdio"` is omitted by skip_serializing_if; ensure
        // websocket is present in the round-trip output.
        assert!(serialized.contains("\"transport\":\"websocket\""));
    }

    #[test]
    fn defaults_keep_all_nine_stdio_agents() {
        let cfg = AgentsConfig::default();
        assert_eq!(cfg.agents.len(), 9);
        for (_, a) in &cfg.agents {
            assert_eq!(a.transport, AgentTransport::Stdio);
            assert!(a.command.is_some());
        }
    }
}
