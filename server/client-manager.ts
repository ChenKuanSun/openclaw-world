import type { WebSocket } from "ws";

/** AOI radius: clients only receive updates for agents within this distance */
export const AOI_RADIUS = 40;

export interface ClientState {
  id: string;
  ws: WebSocket;
  /** Camera center position — updated when client sends viewport info */
  viewX: number;
  viewZ: number;
  /** Which agent this client is following (for preview mode) */
  followAgent?: string;
  /** Last tick the client acknowledged */
  lastAckTick: number;
  connectedAt: number;
}

let nextClientId = 1;

export class ClientManager {
  private clients = new Map<string, ClientState>();
  private wsByClient = new Map<WebSocket, string>();
  /** Cached array of all clients — invalidated on add/remove */
  private cachedClients: ClientState[] | null = null;

  /** Register a new WebSocket client */
  addClient(ws: WebSocket): ClientState {
    const id = `c${nextClientId++}`;
    const state: ClientState = {
      id,
      ws,
      viewX: 0,
      viewZ: 0,
      lastAckTick: 0,
      connectedAt: Date.now(),
    };
    this.clients.set(id, state);
    this.wsByClient.set(ws, id);
    this.cachedClients = null;
    return state;
  }

  /** Remove a disconnected client */
  removeClient(ws: WebSocket): void {
    const id = this.wsByClient.get(ws);
    if (id) {
      this.clients.delete(id);
      this.wsByClient.delete(ws);
      this.cachedClients = null;
    }
  }

  /** Update client viewport position (for AOI filtering) */
  updateViewport(ws: WebSocket, x: number, z: number): void {
    const id = this.wsByClient.get(ws);
    if (id) {
      const state = this.clients.get(id);
      if (state) {
        state.viewX = x;
        state.viewZ = z;
      }
    }
  }

  /** Set which agent a client is following */
  setFollowAgent(ws: WebSocket, agentId: string): void {
    const id = this.wsByClient.get(ws);
    if (id) {
      const state = this.clients.get(id);
      if (state) state.followAgent = agentId;
    }
  }

  /** Update last acknowledged tick */
  ackTick(ws: WebSocket, tick: number): void {
    const id = this.wsByClient.get(ws);
    if (id) {
      const state = this.clients.get(id);
      if (state) state.lastAckTick = tick;
    }
  }

  /** Get state by WebSocket */
  getByWs(ws: WebSocket): ClientState | undefined {
    const id = this.wsByClient.get(ws);
    return id ? this.clients.get(id) : undefined;
  }

  /** Iterate all connected clients (cached; invalidated on add/remove) */
  getAllClients(): ClientState[] {
    if (!this.cachedClients) {
      this.cachedClients = Array.from(this.clients.values());
    }
    return this.cachedClients;
  }

  get size(): number {
    return this.clients.size;
  }
}
