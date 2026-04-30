// Stdio transport — wraps the existing Tauri commands that spawn a local
// subprocess and pipe ACP JSON-RPC over its stdin/stdout. Desktop only.
//
// The historical `AcpClientBridge` talked to these helpers directly; this
// module isolates that wiring behind the shared `AcpTransport` interface
// so the bridge no longer has any subprocess-specific knowledge.
import {
  killAgent,
  onAgentClosed,
  onAgentMessage,
  sendToAgent,
  spawnAgent,
} from '../tauri';
import type { AgentInstance } from '../types';
import { TransportListeners, type AcpTransport, type Unsubscribe } from './types';

export class StdioTransport implements AcpTransport {
  private readonly messageListeners = new TransportListeners<string>();
  private readonly closeListeners = new TransportListeners<string | undefined>();
  private unlistenMessage: (() => void) | null = null;
  private unlistenClosed: (() => void) | null = null;
  private closed = false;

  constructor(private readonly agentInstance: AgentInstance) {}

  /** Spawn the subprocess and wire up event listeners. */
  static async spawn(agentName: string): Promise<StdioTransport> {
    const instance = await spawnAgent(agentName);
    const t = new StdioTransport(instance);
    await t.attach();
    return t;
  }

  /** Wire up Tauri event listeners for an already-running agent instance. */
  async attach(): Promise<void> {
    this.unlistenMessage = (await onAgentMessage((msg) => {
      if (msg.agent_id === this.agentInstance.id) {
        this.messageListeners.emit(msg.message);
      }
    })) as unknown as () => void;

    this.unlistenClosed = (await onAgentClosed((agentId) => {
      if (agentId === this.agentInstance.id && !this.closed) {
        this.closed = true;
        // Drop the global Tauri listeners as soon as we know the process is
        // gone. Without this, repeated unexpected exits would leak a
        // `tauri://event` subscription per agent lifetime.
        if (this.unlistenMessage) {
          this.unlistenMessage();
          this.unlistenMessage = null;
        }
        if (this.unlistenClosed) {
          this.unlistenClosed();
          this.unlistenClosed = null;
        }
        this.closeListeners.emit('agent process exited');
        this.messageListeners.clear();
        this.closeListeners.clear();
      }
    })) as unknown as () => void;
  }

  /** The underlying agent instance (id + name) — exposed for diagnostics. */
  get instance(): AgentInstance {
    return this.agentInstance;
  }

  async send(json: string): Promise<void> {
    if (this.closed) {
      throw new Error('StdioTransport is closed');
    }
    await sendToAgent(this.agentInstance.id, json);
  }

  onMessage(cb: (json: string) => void): Unsubscribe {
    return this.messageListeners.add(cb);
  }

  onClose(cb: (reason?: string) => void): Unsubscribe {
    return this.closeListeners.add(cb);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.unlistenMessage) {
      this.unlistenMessage();
      this.unlistenMessage = null;
    }
    if (this.unlistenClosed) {
      this.unlistenClosed();
      this.unlistenClosed = null;
    }
    try {
      await killAgent(this.agentInstance.id);
    } catch (e) {
      console.warn('Failed to kill agent on close:', e);
    }
    this.closeListeners.emit('closed by client');
    this.messageListeners.clear();
    this.closeListeners.clear();
  }
}
