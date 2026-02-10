type Handler = (data: unknown) => void;

/**
 * WebSocket client with auto-reconnection.
 * Connects to the world server's /ws endpoint.
 *
 * When serverUrl is provided, connects directly to that remote server.
 * Otherwise, uses the Vite proxy (same origin) for local development.
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Handler[]>();
  private reconnectDelay = 1000;
  private maxReconnectDelay = 10000;
  private url: string;
  private outboundQueue: string[] = [];

  constructor(serverUrl?: string) {
    if (serverUrl) {
      // Remote server: convert http(s) to ws(s)
      const wsUrl = serverUrl
        .replace(/^http:/, "ws:")
        .replace(/^https:/, "wss:");
      this.url = `${wsUrl}/ws`;
    } else {
      // Local: use Vite proxy (same origin)
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.url = `${proto}//${window.location.host}/ws`;
    }
  }

  /** Register an event handler */
  on(type: string, handler: Handler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** Connect to the world server */
  connect(): void {
    this.doConnect();
  }

  /** Send a message to the server (buffers if socket not open) */
  send(msg: Record<string, unknown>): void {
    const raw = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(raw);
    } else {
      this.outboundQueue.push(raw);
    }
  }

  /** Report camera viewport position for server-side AOI filtering */
  reportViewport(x: number, z: number): void {
    this.send({ type: "viewport", x, z });
  }

  /** Request full profiles list (not AOI-filtered) */
  requestProfiles(): void {
    this.send({ type: "requestProfiles" });
  }

  private doConnect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[ws] Connected to world server");
      this.reconnectDelay = 1000;
      // Flush any messages buffered while disconnected
      for (const raw of this.outboundQueue) {
        this.ws!.send(raw);
      }
      this.outboundQueue.length = 0;
      this.emit("connected", {});
    };

    this.ws.onmessage = (event) => {
      try {
        const raw = event.data;
        if (typeof raw !== "string" || raw.length > 1_000_000) return;
        const data = JSON.parse(raw);
        if (
          typeof data === "object" &&
          data !== null &&
          typeof data.type === "string" &&
          data.type.length > 0
        ) {
          this.emit(data.type, data);
        }
      } catch {
        // Ignore malformed
      }
    };

    this.ws.onclose = () => {
      console.log("[ws] Disconnected, reconnecting...");
      this.emit("disconnected", {});
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      this.doConnect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 1.5,
      this.maxReconnectDelay
    );
  }

  private emit(type: string, data: unknown): void {
    const list = this.handlers.get(type);
    if (list) {
      for (const handler of list) {
        handler(data);
      }
    }
  }
}
