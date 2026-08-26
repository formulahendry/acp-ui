// Host abstraction — the rest of the app talks to this module instead of
// `@tauri-apps/*` packages directly. There are three runtime hosts:
//
//   - Tauri desktop: full feature set (stdio agents, fs RPCs, plugin-store,
//     plugin-dialog, machine-uid).
//   - Tauri mobile:  websocket-only agents, plugin-store/dialog, machine-id
//     unsupported (already handled by call sites).
//   - Web (browser): websocket-only agents, no fs, no folder picker,
//     localStorage for persistence, no machine id.
//
// All functions live behind a runtime `isTauriHost()` switch; Tauri SDK
// imports are deferred via `await import(...)` so a web build can ship
// without the Tauri runtime in its bundle.

import type {
  AgentsConfig,
  AgentConfig,
  AgentInstance,
  AgentMessage,
  AgentStderr,
  AgentTransportKind,
} from '../types';
import { getTransportKind } from '../types';
import { isTauriHost, isDesktop } from '../platform';

export type Unlisten = () => void;

/** Optional fields used when adding/updating a remote (websocket / http) agent. */
export interface RemoteAgentOptions {
  transport?: 'websocket' | 'http';
  url?: string;
  headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Web-side state. The browser config is a pure in-memory object backed by
// `localStorage`; `onConfigChanged` is a no-op because nothing else can
// mutate it (the Tauri implementation watches a real file).
// ---------------------------------------------------------------------------

const WEB_CONFIG_KEY = 'acp-ui:agents';
const WEB_CONFIG_PATH_LABEL = '(browser local storage)';

function loadWebConfig(): AgentsConfig {
  if (typeof localStorage === 'undefined') return { agents: {} };
  const raw = localStorage.getItem(WEB_CONFIG_KEY);
  if (!raw) return { agents: {} };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.agents) {
      return parsed as AgentsConfig;
    }
  } catch (e) {
    console.warn('Failed to parse stored agents config:', e);
  }
  return { agents: {} };
}

function saveWebConfig(config: AgentsConfig): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(WEB_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to persist agents config:', e);
  }
}

/** Validate inputs and assemble an `AgentConfig`, mirroring the Rust
 * `build_agent_config` helper in src-tauri/src/lib.rs. Used only on web. */
function buildAgentConfig(
  command: string | null,
  args: string[],
  env: Record<string, string>,
  remote: RemoteAgentOptions
): AgentConfig {
  const transport: AgentTransportKind = remote.transport ?? 'stdio';

  if (transport === 'stdio') {
    // Web cannot spawn subprocesses; reject defensively even though the UI
    // already hides the option.
    throw new Error('stdio agents are not supported on this platform');
  }

  const url = remote.url?.trim();
  if (!url) throw new Error('remote agent requires a url');
  const lower = url.toLowerCase();
  if (transport === 'websocket' && !(lower.startsWith('ws://') || lower.startsWith('wss://'))) {
    throw new Error(`URL scheme does not match transport 'websocket': ${url}`);
  }
  if (transport === 'http' && !(lower.startsWith('http://') || lower.startsWith('https://'))) {
    throw new Error(`URL scheme does not match transport 'http': ${url}`);
  }
  // The stdio fields are not relevant for remote agents but the function
  // signature mirrors the Tauri command for consistency.
  void command;
  void args;
  void env;
  return {
    transport,
    url,
    headers: remote.headers && Object.keys(remote.headers).length > 0 ? remote.headers : undefined,
  };
}

// ---------------------------------------------------------------------------
// Config CRUD
// ---------------------------------------------------------------------------

export async function getConfig(): Promise<AgentsConfig> {
  if (isTauriHost()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AgentsConfig>('get_config');
  }
  return loadWebConfig();
}

export async function reloadConfig(): Promise<AgentsConfig> {
  if (isTauriHost()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AgentsConfig>('reload_config');
  }
  return loadWebConfig();
}

export async function getConfigPath(): Promise<string> {
  if (isTauriHost()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('get_config_path');
  }
  return WEB_CONFIG_PATH_LABEL;
}

export async function addAgent(
  name: string,
  command: string | null,
  args: string[],
  env: Record<string, string> = {},
  remote: RemoteAgentOptions = {}
): Promise<AgentsConfig> {
  if (isTauriHost()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AgentsConfig>('add_agent', {
      name,
      command,
      args,
      env,
      transport: remote.transport,
      url: remote.url,
      headers: remote.headers,
    });
  }
  const config = loadWebConfig();
  if (config.agents[name]) {
    throw new Error(`Agent '${name}' already exists`);
  }
  config.agents[name] = buildAgentConfig(command, args, env, remote);
  saveWebConfig(config);
  return config;
}

export async function updateAgent(
  name: string,
  command: string | null,
  args: string[],
  env: Record<string, string> = {},
  remote: RemoteAgentOptions = {}
): Promise<AgentsConfig> {
  if (isTauriHost()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AgentsConfig>('update_agent', {
      name,
      command,
      args,
      env,
      transport: remote.transport,
      url: remote.url,
      headers: remote.headers,
    });
  }
  const config = loadWebConfig();
  config.agents[name] = buildAgentConfig(command, args, env, remote);
  saveWebConfig(config);
  return config;
}

export async function removeAgent(name: string): Promise<AgentsConfig> {
  if (isTauriHost()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<AgentsConfig>('remove_agent', { name });
  }
  const config = loadWebConfig();
  delete config.agents[name];
  saveWebConfig(config);
  return config;
}

// ---------------------------------------------------------------------------
// Stdio agent lifecycle (Tauri desktop only — throws elsewhere)
// ---------------------------------------------------------------------------

function throwNoStdio(): never {
  throw new Error('stdio agents are not supported on this platform');
}

export async function spawnAgent(name: string): Promise<AgentInstance> {
  if (!isTauriHost()) throwNoStdio();
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<AgentInstance>('spawn_agent', { name });
}

export async function sendToAgent(agentId: string, message: string): Promise<void> {
  if (!isTauriHost()) throwNoStdio();
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<void>('send_to_agent', { agentId, message });
}

export async function killAgent(agentId: string): Promise<void> {
  if (!isTauriHost()) throwNoStdio();
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<void>('kill_agent', { agentId });
}

export async function listRunningAgents(): Promise<string[]> {
  if (!isTauriHost()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string[]>('list_running_agents');
}

export async function onAgentMessage(
  callback: (message: AgentMessage) => void
): Promise<Unlisten> {
  if (!isTauriHost()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen<AgentMessage>('agent-message', (event) => callback(event.payload)) as Promise<Unlisten>;
}

export async function onAgentClosed(
  callback: (agentId: string) => void
): Promise<Unlisten> {
  if (!isTauriHost()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen<string>('agent-closed', (event) => callback(event.payload)) as Promise<Unlisten>;
}

export async function onAgentStderr(
  callback: (stderr: AgentStderr) => void
): Promise<Unlisten> {
  if (!isTauriHost()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  return listen<AgentStderr>('agent-stderr', (event) => callback(event.payload)) as Promise<Unlisten>;
}

export async function onConfigChanged(
  callback: (config: AgentsConfig) => void
): Promise<Unlisten> {
  if (!isTauriHost()) {
    // No external mutator on web — call sites already update Pinia state
    // synchronously when they invoke addAgent/updateAgent/removeAgent.
    void callback;
    return () => {};
  }
  const { listen } = await import('@tauri-apps/api/event');
  return listen<AgentsConfig>('config-changed', (event) => callback(event.payload)) as Promise<Unlisten>;
}

// ---------------------------------------------------------------------------
// Misc capability helpers
// ---------------------------------------------------------------------------

export async function getMachineId(): Promise<string> {
  if (!isTauriHost()) {
    throw new Error('machine id is not available on this platform');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('get_machine_id');
}

const FALLBACK_VERSION = '0.0.0-web';

export async function getAppVersion(): Promise<string> {
  if (isTauriHost()) {
    const { getVersion } = await import('@tauri-apps/api/app');
    return getVersion();
  }
  // Injected by Vite (see vite.config.ts).
  const v = (import.meta.env as Record<string, string | undefined>).VITE_APP_VERSION;
  return v ?? FALLBACK_VERSION;
}

/**
 * Open a URL in the user's default external browser.
 *
 * In a Tauri webview `window.open()` / `<a target="_blank">` do NOT reach the
 * system browser (they no-op or try to navigate the webview), so we go through
 * the opener plugin. On the plain web build we fall back to `window.open`,
 * which runs synchronously here to stay inside the click's user-gesture and
 * avoid popup blocking.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriHost()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** True when the host can present a native folder picker. */
export function canPickFolder(): boolean {
  return isDesktop();
}

/** Open the platform folder picker. Returns the absolute path the user
 * selected, or `null` if cancelled / unsupported. */
export async function pickFolder(title?: string): Promise<string | null> {
  if (!canPickFolder()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({
    directory: true,
    multiple: false,
    title: title ?? 'Select Folder',
  });
  return typeof result === 'string' ? result : null;
}

// ---------------------------------------------------------------------------
// Filesystem RPC handlers (Tauri desktop only)
// ---------------------------------------------------------------------------

export async function readTextFile(path: string): Promise<string> {
  if (!isTauriHost()) {
    throw new Error('readTextFile is not supported on this platform');
  }
  const { readTextFile: rtf } = await import('@tauri-apps/plugin-fs');
  return rtf(path);
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isTauriHost()) {
    throw new Error('writeTextFile is not supported on this platform');
  }
  const { writeTextFile: wtf } = await import('@tauri-apps/plugin-fs');
  await wtf(path, content);
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { loadKvStore } from './storage';
export type { KVStore } from './storage';

// Re-export `getTransportKind` for convenience so call sites that already
// pull from `host` don't need a second import.
export { getTransportKind };
