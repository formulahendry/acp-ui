// Tauri IPC wrapper for ACP communication
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { AgentsConfig, AgentInstance, AgentMessage, AgentStderr } from './types';

export async function getConfig(): Promise<AgentsConfig> {
  return invoke<AgentsConfig>('get_config');
}

export async function reloadConfig(): Promise<AgentsConfig> {
  return invoke<AgentsConfig>('reload_config');
}

export async function getConfigPath(): Promise<string> {
  return invoke<string>('get_config_path');
}

export async function spawnAgent(name: string): Promise<AgentInstance> {
  return invoke<AgentInstance>('spawn_agent', { name });
}

export async function sendToAgent(agentId: string, message: string): Promise<void> {
  return invoke<void>('send_to_agent', { agentId, message });
}

export async function killAgent(agentId: string): Promise<void> {
  return invoke<void>('kill_agent', { agentId });
}

export async function listRunningAgents(): Promise<string[]> {
  return invoke<string[]>('list_running_agents');
}

/** Optional fields used when adding/updating a remote (websocket / http) agent. */
export interface RemoteAgentOptions {
  transport?: 'websocket' | 'http';
  url?: string;
  headers?: Record<string, string>;
}

export async function addAgent(
  name: string,
  command: string | null,
  args: string[],
  env: Record<string, string> = {},
  remote: RemoteAgentOptions = {}
): Promise<AgentsConfig> {
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

export async function removeAgent(name: string): Promise<AgentsConfig> {
  return invoke<AgentsConfig>('remove_agent', { name });
}

export async function updateAgent(
  name: string,
  command: string | null,
  args: string[],
  env: Record<string, string> = {},
  remote: RemoteAgentOptions = {}
): Promise<AgentsConfig> {
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

// Event listeners
export async function onAgentMessage(
  callback: (message: AgentMessage) => void
): Promise<UnlistenFn> {
  return listen<AgentMessage>('agent-message', (event) => {
    callback(event.payload);
  });
}

export async function onAgentClosed(
  callback: (agentId: string) => void
): Promise<UnlistenFn> {
  return listen<string>('agent-closed', (event) => {
    callback(event.payload);
  });
}

export async function onConfigChanged(
  callback: (config: AgentsConfig) => void
): Promise<UnlistenFn> {
  return listen<AgentsConfig>('config-changed', (event) => {
    callback(event.payload);
  });
}

export async function onAgentStderr(
  callback: (stderr: AgentStderr) => void
): Promise<UnlistenFn> {
  return listen<AgentStderr>('agent-stderr', (event) => {
    callback(event.payload);
  });
}

export async function getMachineId(): Promise<string> {
  return invoke<string>('get_machine_id');
}
