// ACP Client Bridge - Adapts a generic AcpTransport to the ACP SDK's
// Client interface. The bridge is transport-agnostic: it neither knows
// nor cares whether the underlying byte stream is a local subprocess
// (stdio), a WebSocket, or a Streamable HTTP connection.
import type {
  Client,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  ReadTextFileRequest,
  ReadTextFileResponse,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,
  AuthenticateRequest,
  AuthenticateResponse,
} from '@agentclientprotocol/sdk';
import { readTextFile as tauriReadTextFile, writeTextFile as tauriWriteTextFile } from '@tauri-apps/plugin-fs';
import type { AcpTransport, Unsubscribe } from './transport/types';
import { createTransport, StdioTransport } from './transport';
import type { AgentConfig, AgentInstance, PermissionRequest as LocalPermissionRequest } from './types';
import { isMobile } from './platform';
import { ref, type Ref } from 'vue';
import { useTrafficStore } from '../stores/traffic';

// Event emitter for permission requests
type PermissionResolver = (response: RequestPermissionResponse) => void;

// Traffic store instance (lazily initialized)
let trafficStore: ReturnType<typeof useTrafficStore> | null = null;
function getTrafficStore() {
  if (!trafficStore) {
    trafficStore = useTrafficStore();
  }
  return trafficStore;
}

/** JSON-RPC method-not-found error code. */
const JSONRPC_METHOD_NOT_FOUND = -32601;

export class AcpClientBridge implements Client {
  private transport: AcpTransport;
  /**
   * Local filesystem RPCs (`fs/read_text_file`, `fs/write_text_file`) are
   * handled by the Tauri fs plugin on desktop. On mobile builds the plugin is
   * not available and these handlers respond with a method-not-found error
   * so a misbehaving remote agent can't hang waiting for a response.
   */
  private fsAvailable: boolean;
  private messageResolvers: Map<number, (response: unknown) => void> = new Map();
  private messageRejecters: Map<number, (error: Error) => void> = new Map();
  private pendingMethods: Map<number, string> = new Map(); // Track method names for responses
  private nextRequestId = 0;
  private unlistenMessage: Unsubscribe | null = null;
  private unlistenClose: Unsubscribe | null = null;

  // Permission request handling
  public pendingPermissionRequest: Ref<LocalPermissionRequest | null> = ref(null);
  private permissionResolver: PermissionResolver | null = null;

  // Session update callback
  public onSessionUpdate: ((notification: SessionNotification) => void) | null = null;

  /** Optional callback for when the underlying transport closes unexpectedly. */
  public onTransportClose: ((reason?: string) => void) | null = null;

  constructor(transport: AcpTransport, options?: { fsAvailable?: boolean }) {
    this.transport = transport;
    // Default: fs is available iff we are on desktop. Callers (e.g. remote
    // agents that trust the host fs) can override.
    this.fsAvailable = options?.fsAvailable ?? !isMobile();
    this.unlistenMessage = this.transport.onMessage((msg) => this.handleMessage(msg));
    this.unlistenClose = this.transport.onClose((reason) => {
      // Reject all in-flight requests so callers stop hanging.
      const err = new Error(`transport closed: ${reason ?? 'unknown reason'}`);
      for (const reject of this.messageRejecters.values()) {
        try {
          reject(err);
        } catch {
          /* ignore */
        }
      }
      this.messageResolvers.clear();
      this.messageRejecters.clear();
      this.pendingMethods.clear();
      if (this.onTransportClose) {
        this.onTransportClose(reason);
      }
    });
  }

  /**
   * Backwards-compatible no-op. Connection setup now happens in the factory
   * (`createAcpClient`) before the bridge is constructed.
   */
  async connect(): Promise<void> {
    // No-op: transport is already connected when handed to the bridge.
  }

  async disconnect(): Promise<void> {
    // Unlisten first so the transport's close handler (which would re-reject
    // pending requests and fire `onTransportClose`) doesn't run for a
    // voluntary disconnect — `onTransportClose` is reserved for unexpected
    // closes. Then explicitly reject any in-flight requests here so callers
    // don't hang waiting for responses that will never arrive, and finally
    // close the transport.
    if (this.unlistenMessage) {
      this.unlistenMessage();
      this.unlistenMessage = null;
    }
    if (this.unlistenClose) {
      this.unlistenClose();
      this.unlistenClose = null;
    }
    if (this.messageRejecters.size > 0) {
      const err = new Error('transport closed: client disconnected');
      for (const reject of this.messageRejecters.values()) {
        try {
          reject(err);
        } catch {
          /* ignore */
        }
      }
      this.messageResolvers.clear();
      this.messageRejecters.clear();
      this.pendingMethods.clear();
    }
    await this.transport.close();
  }

  private handleMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);
      const store = getTrafficStore();

      // Handle JSON-RPC response (has id and result/error, no method)
      if ('id' in parsed && parsed.id !== undefined && !('method' in parsed)) {
        // Track incoming response
        store.addEntry({
          direction: 'in',
          type: 'response',
          method: this.pendingMethods.get(parsed.id) || 'unknown',
          requestId: parsed.id,
          payload: parsed,
          error: !!parsed.error,
        });
        this.pendingMethods.delete(parsed.id);

        const resolver = this.messageResolvers.get(parsed.id);
        const rejecter = this.messageRejecters.get(parsed.id);
        if (resolver && rejecter) {
          this.messageResolvers.delete(parsed.id);
          this.messageRejecters.delete(parsed.id);
          if (parsed.error) {
            console.error('JSON-RPC error:', parsed.error);
            rejecter(new Error(parsed.error.message || 'Unknown error'));
          } else {
            resolver(parsed.result);
          }
        }
      }

      // Handle JSON-RPC request from agent (has id and method)
      if ('id' in parsed && parsed.id !== undefined && 'method' in parsed) {
        // Track incoming request from agent
        store.addEntry({
          direction: 'in',
          type: 'request',
          method: parsed.method,
          requestId: parsed.id,
          payload: parsed,
        });
        this.handleRequest(parsed.id, parsed.method, parsed.params);
      }

      // Handle JSON-RPC notification (no id, has method)
      if (!('id' in parsed) && parsed.method) {
        // Track incoming notification
        store.addEntry({
          direction: 'in',
          type: 'notification',
          method: parsed.method,
          payload: parsed,
        });
        this.handleNotification(parsed.method, parsed.params);
      }
    } catch (e) {
      console.error('Failed to parse message:', message, e);
    }
  }

  private async handleRequest(id: number | string, method: string, params: unknown): Promise<void> {
    let result: unknown;
    let error: { code: number; message: string } | undefined;

    try {
      switch (method) {
        case 'fs/read_text_file':
          if (!this.fsAvailable) {
            error = { code: JSONRPC_METHOD_NOT_FOUND, message: 'fs/read_text_file not available on this client' };
          } else {
            result = await this.readTextFile(params as ReadTextFileRequest);
          }
          break;
        case 'fs/write_text_file':
          if (!this.fsAvailable) {
            error = { code: JSONRPC_METHOD_NOT_FOUND, message: 'fs/write_text_file not available on this client' };
          } else {
            result = await this.writeTextFile(params as WriteTextFileRequest);
          }
          break;
        case 'session/request_permission':
          result = await this.requestPermission(params as RequestPermissionRequest);
          break;
        default:
          error = { code: JSONRPC_METHOD_NOT_FOUND, message: `Method not found: ${method}` };
      }
    } catch (e) {
      error = { code: -32603, message: e instanceof Error ? e.message : String(e) };
    }

    // Send response back to agent
    const response = error
      ? { jsonrpc: '2.0', id, error }
      : { jsonrpc: '2.0', id, result };

    // Track outgoing response
    const store = getTrafficStore();
    store.addEntry({
      direction: 'out',
      type: 'response',
      method,
      requestId: id,
      payload: response,
      error: !!error,
    });

    await this.transport.send(JSON.stringify(response));
  }

  private handleNotification(method: string, params: unknown): void {
    if (method === 'session/update') {
      if (this.onSessionUpdate) {
        this.onSessionUpdate(params as SessionNotification);
      }
    }
  }

  private async sendRequest<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextRequestId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params: params || {},
    };

    // Track outgoing request
    const store = getTrafficStore();
    store.addEntry({
      direction: 'out',
      type: 'request',
      method,
      requestId: id,
      payload: request,
    });
    this.pendingMethods.set(id, method);

    console.log('Sending request:', request);

    return new Promise((resolve, reject) => {
      this.messageResolvers.set(id, (response) => {
        resolve(response as T);
      });
      this.messageRejecters.set(id, reject);

      this.transport.send(JSON.stringify(request)).catch((e) => {
        this.messageResolvers.delete(id);
        this.messageRejecters.delete(id);
        this.pendingMethods.delete(id);
        reject(e);
      });

      // Timeout after 60 seconds (increased for auth flows)
      setTimeout(() => {
        if (this.messageResolvers.has(id)) {
          this.messageResolvers.delete(id);
          this.messageRejecters.delete(id);
          this.pendingMethods.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 60000);
    });
  }

  private async sendNotification(method: string, params?: unknown): Promise<void> {
    const notification = {
      jsonrpc: '2.0',
      method,
      params: params || {},
    };

    // Track outgoing notification
    const store = getTrafficStore();
    store.addEntry({
      direction: 'out',
      type: 'notification',
      method,
      payload: notification,
    });

    await this.transport.send(JSON.stringify(notification));
  }

  // ACP Agent methods (client calls these to talk to agent)
  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    return this.sendRequest<InitializeResponse>('initialize', params);
  }

  async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
    return this.sendRequest<NewSessionResponse>('session/new', params);
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    return this.sendRequest<LoadSessionResponse>('session/load', params);
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    return this.sendRequest<PromptResponse>('session/prompt', params);
  }

  async cancel(params: CancelNotification): Promise<void> {
    await this.sendNotification('session/cancel', params);
  }

  async setMode(params: { sessionId: string; modeId: string }): Promise<void> {
    await this.sendRequest('session/set_mode', params);
  }

  async unstable_setSessionModel(params: { sessionId: string; modelId: string }): Promise<void> {
    await this.sendRequest('session/set_model', params);
  }

  async authenticate(params: AuthenticateRequest): Promise<AuthenticateResponse> {
    return this.sendRequest<AuthenticateResponse>('authenticate', params);
  }

  // ACP Client interface methods (agent calls these)
  async requestPermission(
    params: RequestPermissionRequest
  ): Promise<RequestPermissionResponse> {
    return new Promise((resolve) => {
      this.pendingPermissionRequest.value = {
        sessionId: params.sessionId,
        toolCall: {
          toolCallId: params.toolCall.toolCallId,
          title: params.toolCall.title ?? '',
          kind: params.toolCall.kind ?? 'other',
          status: (params.toolCall.status as 'pending' | 'in_progress' | 'completed' | 'failed') ?? 'pending',
          locations: params.toolCall.locations ?? undefined,
        },
        options: params.options.map((opt) => ({
          kind: opt.kind,
          name: opt.name,
          optionId: opt.optionId,
        })),
      };
      this.permissionResolver = resolve;
    });
  }

  resolvePermission(optionId: string): void {
    if (this.permissionResolver) {
      this.permissionResolver({
        outcome: {
          outcome: 'selected',
          optionId,
        },
      });
      this.permissionResolver = null;
      this.pendingPermissionRequest.value = null;
    }
  }

  cancelPermission(): void {
    if (this.permissionResolver) {
      this.permissionResolver({
        outcome: {
          outcome: 'cancelled',
        },
      });
      this.permissionResolver = null;
      this.pendingPermissionRequest.value = null;
    }
  }

  async sessionUpdate(_params: SessionNotification): Promise<void> {
    // This is called by the agent, we handle it in handleNotification
  }

  async writeTextFile(
    params: WriteTextFileRequest
  ): Promise<WriteTextFileResponse> {
    try {
      await tauriWriteTextFile(params.path, params.content);
      console.log('writeTextFile completed:', params.path);
      return {};
    } catch (e) {
      console.error('writeTextFile failed:', params.path, e);
      throw e;
    }
  }

  async readTextFile(
    params: ReadTextFileRequest
  ): Promise<ReadTextFileResponse> {
    try {
      let content = await tauriReadTextFile(params.path);

      // Handle line/limit parameters if specified
      if (params.line !== undefined || params.limit !== undefined) {
        const lines = content.split('\n');
        const startLine = params.line ? params.line - 1 : 0; // 1-based to 0-based
        const endLine = params.limit ? startLine + params.limit : lines.length;
        content = lines.slice(startLine, endLine).join('\n');
      }

      console.log('readTextFile completed:', params.path);
      return { content };
    } catch (e) {
      console.error('readTextFile failed:', params.path, e);
      throw e;
    }
  }
}

/**
 * Factory: connect a transport for the given agent and wrap it in an
 * `AcpClientBridge`.
 *
 * For backward compatibility, the legacy single-argument form (passing an
 * `AgentInstance` for an already-spawned stdio process) is still accepted and
 * routes through a freshly attached `StdioTransport`.
 */
export async function createAcpClient(
  arg: AgentInstance | { name: string; config: AgentConfig },
  options?: { fsAvailable?: boolean }
): Promise<AcpClientBridge> {
  if ('config' in arg) {
    const transport = await createTransport(arg.name, arg.config);
    return new AcpClientBridge(transport, options);
  }
  // Legacy path: caller already invoked spawnAgent and just wants us to wire
  // up the events.
  const transport = new StdioTransport(arg);
  await transport.attach();
  return new AcpClientBridge(transport, options);
}
