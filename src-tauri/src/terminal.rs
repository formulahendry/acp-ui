// Terminal capability (ACP `terminal/*`) — desktop only.
//
// Lets an agent run commands on the user's machine and read their output,
// mirroring the ACP terminal RPCs. Processes are spawned through the user's
// login shell (like `agent.rs`) so PATH resolves tools such as `git`/`node`.
//
// SECURITY: this grants the connected agent arbitrary command execution on the
// user's machine. It is gated to desktop and to clients that advertise the
// `terminal` capability; consider a user-facing opt-in before exposing it to
// untrusted agents.

use serde::{Deserialize, Serialize};

#[cfg(desktop)]
use std::collections::HashMap;
#[cfg(desktop)]
use std::io::{BufReader, Read};
#[cfg(desktop)]
use std::process::{Child, Command, Stdio};
#[cfg(desktop)]
use std::sync::{Arc, Condvar, Mutex};
#[cfg(desktop)]
use std::thread;
#[cfg(desktop)]
use std::time::Duration;
#[cfg(desktop)]
use uuid::Uuid;

#[cfg(all(desktop, target_os = "windows"))]
use std::os::windows::process::CommandExt;
#[cfg(all(desktop, not(target_os = "windows")))]
use shell_escape;

/// One environment variable for a spawned terminal (ACP `EnvVariable`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVar {
    pub name: String,
    pub value: String,
}

/// Exit status of a terminal process (ACP `TerminalExitStatus`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitStatus {
    #[serde(rename = "exitCode", skip_serializing_if = "Option::is_none")]
    pub exit_code: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signal: Option<String>,
}

/// Response for `terminal/output` (ACP `TerminalOutputResponse`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub output: String,
    pub truncated: bool,
    #[serde(rename = "exitStatus", skip_serializing_if = "Option::is_none")]
    pub exit_status: Option<TerminalExitStatus>,
}

#[cfg(desktop)]
struct BufState {
    data: Vec<u8>,
    truncated: bool,
    limit: Option<usize>,
}

#[cfg(desktop)]
struct Shared {
    buffer: Mutex<BufState>,
    exit: Mutex<Option<TerminalExitStatus>>,
    exit_cv: Condvar,
}

#[cfg(desktop)]
struct RunningTerminal {
    child: Arc<Mutex<Child>>,
    shared: Arc<Shared>,
}

#[cfg(desktop)]
pub struct TerminalManager {
    terminals: Arc<Mutex<HashMap<String, RunningTerminal>>>,
}

#[cfg(not(desktop))]
pub struct TerminalManager {
    _phantom: std::marker::PhantomData<()>,
}

#[cfg(desktop)]
fn append_output(shared: &Shared, chunk: &[u8]) {
    let mut b = shared.buffer.lock().unwrap();
    b.data.extend_from_slice(chunk);
    if let Some(limit) = b.limit {
        if b.data.len() > limit {
            // Truncate from the beginning to stay within the byte limit, then
            // advance to the next UTF-8 char boundary so `output` stays valid.
            let excess = b.data.len() - limit;
            b.data.drain(0..excess);
            let mut start = 0;
            while start < b.data.len() && (b.data[start] & 0xC0) == 0x80 {
                start += 1;
            }
            if start > 0 {
                b.data.drain(0..start);
            }
            b.truncated = true;
        }
    }
}

#[cfg(desktop)]
fn to_exit_status(st: std::process::ExitStatus) -> TerminalExitStatus {
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        TerminalExitStatus {
            exit_code: st.code(),
            signal: st.signal().map(|s| s.to_string()),
        }
    }
    #[cfg(not(unix))]
    {
        TerminalExitStatus {
            exit_code: st.code(),
            signal: None,
        }
    }
}

#[cfg(desktop)]
impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create(
        &self,
        command: String,
        args: Vec<String>,
        env: Vec<EnvVar>,
        cwd: Option<String>,
        output_byte_limit: Option<usize>,
    ) -> Result<String, String> {
        // Build the child through the user's shell so PATH resolves like a real
        // terminal (mirrors agent.rs). Command + args are quoted into one line.
        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("cmd");
            c.arg("/C").arg(&command).args(&args);
            c.creation_flags(0x08000000); // CREATE_NO_WINDOW
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            use std::borrow::Cow;
            let escaped_command = shell_escape::escape(Cow::Borrowed(command.as_str()));
            let shell_command = if args.is_empty() {
                escaped_command.to_string()
            } else {
                let quoted: Vec<String> = args
                    .iter()
                    .map(|a| shell_escape::escape(Cow::Borrowed(a.as_str())).to_string())
                    .collect();
                format!("{} {}", escaped_command, quoted.join(" "))
            };

            let user_shell = std::env::var("SHELL").unwrap_or_default();
            let shell_name = std::path::Path::new(&user_shell)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            let (shell, use_login) = match shell_name {
                "bash" | "zsh" | "ksh" => (user_shell.as_str(), true),
                "fish" => (user_shell.as_str(), false),
                _ => {
                    if std::path::Path::new("/bin/bash").exists() {
                        ("/bin/bash", true)
                    } else if std::path::Path::new("/usr/bin/bash").exists() {
                        ("/usr/bin/bash", true)
                    } else {
                        ("/bin/sh", false)
                    }
                }
            };
            let mut c = Command::new(shell);
            if use_login {
                c.arg("-l");
            }
            c.arg("-c").arg(&shell_command);
            c
        };

        for e in &env {
            cmd.env(&e.name, &e.value);
        }
        if let Some(dir) = &cwd {
            cmd.current_dir(dir);
        }
        cmd.stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn terminal: {}", e))?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let shared = Arc::new(Shared {
            buffer: Mutex::new(BufState {
                data: Vec::new(),
                truncated: false,
                limit: output_byte_limit,
            }),
            exit: Mutex::new(None),
            exit_cv: Condvar::new(),
        });

        // Reader threads: combine stdout + stderr into the single output buffer.
        if let Some(out) = stdout {
            let sh = Arc::clone(&shared);
            thread::spawn(move || {
                let mut reader = BufReader::new(out);
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => append_output(&sh, &buf[..n]),
                    }
                }
            });
        }
        if let Some(err) = stderr {
            let sh = Arc::clone(&shared);
            thread::spawn(move || {
                let mut reader = BufReader::new(err);
                let mut buf = [0u8; 4096];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) | Err(_) => break,
                        Ok(n) => append_output(&sh, &buf[..n]),
                    }
                }
            });
        }

        let child = Arc::new(Mutex::new(child));

        // Waiter thread: poll try_wait so kill() can still lock the child.
        let waiter_child = Arc::clone(&child);
        let waiter_shared = Arc::clone(&shared);
        thread::spawn(move || loop {
            let status = { waiter_child.lock().unwrap().try_wait() };
            match status {
                Ok(Some(st)) => {
                    *waiter_shared.exit.lock().unwrap() = Some(to_exit_status(st));
                    waiter_shared.exit_cv.notify_all();
                    break;
                }
                Ok(None) => thread::sleep(Duration::from_millis(100)),
                Err(_) => {
                    *waiter_shared.exit.lock().unwrap() = Some(TerminalExitStatus {
                        exit_code: None,
                        signal: None,
                    });
                    waiter_shared.exit_cv.notify_all();
                    break;
                }
            }
        });

        let id = Uuid::new_v4().to_string();
        self.terminals
            .lock()
            .unwrap()
            .insert(id.clone(), RunningTerminal { child, shared });
        Ok(id)
    }

    fn shared_for(&self, id: &str) -> Result<Arc<Shared>, String> {
        self.terminals
            .lock()
            .unwrap()
            .get(id)
            .map(|t| Arc::clone(&t.shared))
            .ok_or_else(|| format!("Terminal not found: {}", id))
    }

    pub fn output(&self, id: &str) -> Result<TerminalOutput, String> {
        let shared = self.shared_for(id)?;
        let b = shared.buffer.lock().unwrap();
        let output = String::from_utf8_lossy(&b.data).to_string();
        let truncated = b.truncated;
        drop(b);
        let exit_status = shared.exit.lock().unwrap().clone();
        Ok(TerminalOutput {
            output,
            truncated,
            exit_status,
        })
    }

    pub fn wait_for_exit(&self, id: &str) -> Result<TerminalExitStatus, String> {
        let shared = self.shared_for(id)?;
        let mut ex = shared.exit.lock().unwrap();
        while ex.is_none() {
            ex = shared.exit_cv.wait(ex).unwrap();
        }
        Ok(ex.clone().unwrap())
    }

    pub fn kill(&self, id: &str) -> Result<(), String> {
        if let Some(t) = self.terminals.lock().unwrap().get(id) {
            let _ = t.child.lock().unwrap().kill();
        }
        Ok(())
    }

    pub fn release(&self, id: &str) -> Result<(), String> {
        if let Some(t) = self.terminals.lock().unwrap().remove(id) {
            let _ = t.child.lock().unwrap().kill();
        }
        Ok(())
    }
}

#[cfg(not(desktop))]
impl TerminalManager {
    pub fn new() -> Self {
        Self {
            _phantom: std::marker::PhantomData,
        }
    }

    pub fn create(
        &self,
        _command: String,
        _args: Vec<String>,
        _env: Vec<EnvVar>,
        _cwd: Option<String>,
        _output_byte_limit: Option<usize>,
    ) -> Result<String, String> {
        Err("terminal is not supported on this platform".to_string())
    }

    pub fn output(&self, _id: &str) -> Result<TerminalOutput, String> {
        Err("terminal is not supported on this platform".to_string())
    }

    pub fn wait_for_exit(&self, _id: &str) -> Result<TerminalExitStatus, String> {
        Err("terminal is not supported on this platform".to_string())
    }

    pub fn kill(&self, _id: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn release(&self, _id: &str) -> Result<(), String> {
        Ok(())
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new()
    }
}
