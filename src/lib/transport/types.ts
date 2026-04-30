// AcpTransport: abstraction over how a single ACP JSON-RPC stream is carried.
//
// All concrete transports (stdio subprocess, WebSocket, Streamable HTTP) MUST
// implement this interface so that `AcpClientBridge` does not need to care
// about the underlying byte plumbing.

/** Unsubscribe function returned by `onMessage` / `onClose`. */
export type Unsubscribe = () => void;

export interface AcpTransport {
  /** Send a single JSON-RPC frame (already JSON-encoded). */
  send(json: string): Promise<void>;

  /**
   * Register a listener for inbound JSON-RPC frames. Each frame is delivered
   * as a complete JSON string (no partial chunks).
   */
  onMessage(cb: (json: string) => void): Unsubscribe;

  /**
   * Register a listener that fires once when the transport closes — either
   * because the remote peer hung up, the local subprocess exited, or `close()`
   * was called. The optional reason describes why.
   */
  onClose(cb: (reason?: string) => void): Unsubscribe;

  /** Tear down the transport and release all resources. Idempotent. */
  close(): Promise<void>;
}

/**
 * Lightweight emitter helpers shared by transport implementations. Kept
 * here (instead of pulling in a dependency) because the per-transport state
 * is small and avoiding a third-party EventEmitter keeps tree-shaken bundles
 * small for mobile builds.
 */
export class TransportListeners<T> {
  private callbacks = new Set<(value: T) => void>();

  add(cb: (value: T) => void): Unsubscribe {
    this.callbacks.add(cb);
    return () => {
      this.callbacks.delete(cb);
    };
  }

  emit(value: T): void {
    // Snapshot to avoid mutation during iteration if a callback unsubscribes.
    for (const cb of [...this.callbacks]) {
      try {
        cb(value);
      } catch (e) {
        console.error('Transport listener threw:', e);
      }
    }
  }

  clear(): void {
    this.callbacks.clear();
  }
}
