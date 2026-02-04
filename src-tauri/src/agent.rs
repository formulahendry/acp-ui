use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(not(target_os = "windows"))]
use shell_escape;

use crate::config::AgentConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInstance {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub agent_id: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStderr {
    pub agent_id: String,
    pub line: String,
}

struct RunningAgent {
    #[allow(dead_code)]
    child: Child,
    stdin: Arc<RwLock<std::process::ChildStdin>>,
}

pub struct AgentManager {
    agents: Arc<RwLock<HashMap<String, RunningAgent>>>,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn spawn_agent(
        &self,
        name: String,
        config: &AgentConfig,
        app_handle: AppHandle,
    ) -> Result<AgentInstance, String> {
        let agent_id = Uuid::new_v4().to_string();

        // On Windows, we need to use cmd.exe to properly resolve .cmd/.bat files like npx
        #[cfg(target_os = "windows")]
        let mut child = {
            let mut cmd = Command::new("cmd");
            cmd.arg("/C")
                .arg(&config.command)
                .args(&config.args)
                .envs(&config.env)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .creation_flags(0x08000000); // CREATE_NO_WINDOW
            cmd.spawn()
                .map_err(|e| format!("Failed to spawn agent: {}", e))?
        };

        // On macOS/Unix, we need to use /bin/sh -c to properly resolve commands in PATH
        #[cfg(not(target_os = "windows"))]
        let mut child = {
            use std::borrow::Cow;

            // Build shell command with proper quoting for command and arguments
            let escaped_command = shell_escape::escape(Cow::Borrowed(config.command.as_str()));
            let shell_command = if config.args.is_empty() {
                escaped_command.to_string()
            } else {
                let quoted_args: Vec<String> = config
                    .args
                    .iter()
                    .map(|arg| shell_escape::escape(Cow::Borrowed(arg.as_str())).to_string())
                    .collect();
                format!("{} {}", escaped_command, quoted_args.join(" "))
            };

            Command::new("/bin/sh")
                .arg("-c")
                .arg(&shell_command)
                .envs(&config.env)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn agent: {}", e))?
        };

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to get stdin".to_string())?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to get stdout".to_string())?;

        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to get stderr".to_string())?;

        let stdin = Arc::new(RwLock::new(stdin));

        // Spawn a thread to read stdout and emit events
        let agent_id_clone = agent_id.clone();
        let app_handle_clone = app_handle.clone();
        let agents_clone = Arc::clone(&self.agents);

        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(message) => {
                        let agent_message = AgentMessage {
                            agent_id: agent_id_clone.clone(),
                            message,
                        };
                        let _ = app_handle_clone.emit("agent-message", agent_message);
                    }
                    Err(_) => break,
                }
            }
            // Agent process ended, remove from map
            agents_clone.write().remove(&agent_id_clone);
            let _ = app_handle_clone.emit("agent-closed", agent_id_clone);
        });

        // Spawn a thread to read stderr and emit events (for startup progress)
        let agent_id_clone2 = agent_id.clone();
        let app_handle_clone2 = app_handle.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line_content) => {
                        let stderr_msg = AgentStderr {
                            agent_id: agent_id_clone2.clone(),
                            line: line_content,
                        };
                        let _ = app_handle_clone2.emit("agent-stderr", stderr_msg);
                    }
                    Err(_) => break,
                }
            }
        });

        let running_agent = RunningAgent { child, stdin };
        self.agents.write().insert(agent_id.clone(), running_agent);

        Ok(AgentInstance { id: agent_id, name })
    }

    pub fn send_message(&self, agent_id: &str, message: &str) -> Result<(), String> {
        let agents = self.agents.read();
        let agent = agents
            .get(agent_id)
            .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

        let mut stdin = agent.stdin.write();
        writeln!(stdin, "{}", message).map_err(|e| format!("Failed to write to stdin: {}", e))?;
        stdin
            .flush()
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;

        Ok(())
    }

    pub fn kill_agent(&self, agent_id: &str) -> Result<(), String> {
        let mut agents = self.agents.write();
        if let Some(mut agent) = agents.remove(agent_id) {
            agent
                .child
                .kill()
                .map_err(|e| format!("Failed to kill agent: {}", e))?;
        }
        Ok(())
    }

    pub fn list_running_agents(&self) -> Vec<String> {
        self.agents.read().keys().cloned().collect()
    }
}

impl Default for AgentManager {
    fn default() -> Self {
        Self::new()
    }
}
