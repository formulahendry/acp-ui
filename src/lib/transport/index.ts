// Transport factory: chooses a concrete `AcpTransport` for the given agent
// config, applying platform restrictions (mobile cannot use stdio).
import type { AgentConfig } from '../types';
import { getTransportKind } from '../types';
import { isMobile } from '../platform';
import type { AcpTransport } from './types';
import { StdioTransport } from './stdio';
import { WebSocketTransport } from './websocket';

/**
 * Create and connect a transport for the named agent.
 *
 * For stdio agents this spawns the local subprocess via Tauri; for remote
 * agents it opens a WebSocket / HTTP connection from the webview directly.
 *
 * @throws if the requested transport is not supported on the current
 *   platform (e.g. stdio on iOS / Android), or if the agent config is
 *   missing required fields.
 */
export async function createTransport(
  agentName: string,
  config: AgentConfig
): Promise<AcpTransport> {
  const kind = getTransportKind(config);

  switch (kind) {
    case 'stdio': {
      if (isMobile()) {
        throw new Error(
          `Agent '${agentName}' uses stdio transport, which is not supported on mobile. Configure a websocket or http transport instead.`
        );
      }
      return StdioTransport.spawn(agentName);
    }
    case 'websocket': {
      if (!config.url) {
        throw new Error(`Agent '${agentName}' is missing 'url' for websocket transport`);
      }
      return WebSocketTransport.connect({
        url: config.url,
        headers: config.headers,
      });
    }
    case 'http': {
      throw new Error(
        `HTTP transport is not yet implemented (agent '${agentName}')`
      );
    }
    default: {
      // Exhaustiveness check.
      const _never: never = kind;
      throw new Error(`Unknown transport kind: ${String(_never)}`);
    }
  }
}

export type { AcpTransport, Unsubscribe } from './types';
export { StdioTransport } from './stdio';
export { WebSocketTransport } from './websocket';
