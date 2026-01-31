# ACP UI

A modern, cross-platform desktop client for the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/). Connect to AI coding agents like GitHub Copilot, Claude Code, Gemini CLI, and Qwen Code from a unified interface.

## 📥 Installation

Download the latest release for your platform from [GitHub Releases](https://github.com/formulahendry/acp-ui/releases):

| Platform | Download |
|----------|----------|
| **Windows** | [.msi installer](https://github.com/formulahendry/acp-ui/releases/latest) or [.exe (NSIS)](https://github.com/formulahendry/acp-ui/releases/latest) |
| **macOS (Apple Silicon)** | [.dmg (ARM64)](https://github.com/formulahendry/acp-ui/releases/latest) |
| **macOS (Intel)** | [.dmg (x64)](https://github.com/formulahendry/acp-ui/releases/latest) |
| **Linux (x64)** | [.deb](https://github.com/formulahendry/acp-ui/releases/latest) or [.AppImage](https://github.com/formulahendry/acp-ui/releases/latest) or [.rpm](https://github.com/formulahendry/acp-ui/releases/latest) |
| **Linux (ARM64)** | [.deb](https://github.com/formulahendry/acp-ui/releases/latest) or [.AppImage](https://github.com/formulahendry/acp-ui/releases/latest) or [.rpm](https://github.com/formulahendry/acp-ui/releases/latest) |

## ✨ Features

- **Multi-Agent Support** — Connect to any ACP-compatible agent
- **Session Management** — Create, resume, and manage conversation sessions
- **Rich Chat Interface** — Markdown rendering, syntax highlighting, tool call visualization
- **Slash Commands** — Quick access to agent capabilities with `/command` syntax
- **File Operations** — Read and write files with permission controls
- **Session Modes** — Switch between agent modes (ask, code, architect, etc.)
- **Traffic Monitor** — Debug and inspect ACP protocol messages in real-time
- **Hot-Reload Config** — Edit agent configurations without restarting
- **Cross-Platform** — Windows, macOS (ARM/Intel), Linux (x64/ARM64)

## 🎯 Default Agents

ACP UI comes pre-configured with these agents:

| Agent | Package |
|-------|---------|
| GitHub Copilot | `@github/copilot-language-server` |
| Claude Code | `@zed-industries/claude-code-acp` |
| Gemini CLI | `@google/gemini-cli` |
| Qwen Code | `@qwen-code/qwen-code` |

## 🛠️ Configuration

Agent configurations are stored in:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\acp-ui\agents.json` |
| macOS | `~/Library/Application Support/acp-ui/agents.json` |
| Linux | `~/.config/acp-ui/agents.json` |

### Example Configuration

```json
{
  "agents": {
    "GitHub Copilot": {
      "command": "npx",
      "args": ["@github/copilot-language-server@latest", "--acp"]
    },
    "Claude Code": {
      "command": "npx",
      "args": ["@zed-industries/claude-code-acp@latest"]
    },
    "Gemini CLI": {
      "command": "npx",
      "args": ["@google/gemini-cli@latest", "--experimental-acp"]
    },
    "Qwen Code": {
      "command": "npx",
      "args": ["@qwen-code/qwen-code@latest", "--acp", "--experimental-skills"]
    }
  }
}
```

## 📖 Usage

1. **Select an Agent** — Choose from the dropdown in the sidebar
2. **Set Working Directory** — Click "Select Folder" to choose your project root
3. **Create Session** — Click "New Session" to start chatting
4. **Use Slash Commands** — Type `/` to see available commands
5. **Resume Sessions** — Click on saved sessions in the sidebar to resume

## 🚀 Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- Platform-specific build tools (see [Tauri Prerequisites](https://tauri.app/start/prerequisites/))

### Setup

```bash
# Clone the repository
git clone https://github.com/formulahendry/acp-ui.git
cd acp-ui

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

## 🔗 Links

- [Agent Client Protocol](https://agentclientprotocol.com/)
- [ACP Registry](https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json)
- [Tauri Documentation](https://tauri.app/)

## 📄 License

MIT License
