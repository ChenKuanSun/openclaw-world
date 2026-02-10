import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import type {
  WSServerMessage,
  WSClientMessage,
  AgentProfile,
  RoomInfoMessage,
} from "./types.js";
import type { ClientManager } from "./client-manager.js";

/**
 * WebSocket bridge for browser clients.
 *
 * The game loop now owns broadcasting (AOI-filtered).
 * This bridge only handles:
 *   - Connection lifecycle (add/remove from ClientManager)
 *   - Client-initiated requests (profiles, viewport updates, room info)
 *   - Sending the initial snapshot on connect
 */
export class WSBridge {
  private wss: WebSocketServer;
  private clientManager: ClientManager;
  private getProfiles: () => AgentProfile[];
  private getProfile: (id: string) => AgentProfile | undefined;
  private getRoomInfo: (() => RoomInfoMessage) | null;

  constructor(
    server: Server,
    clientManager: ClientManager,
    opts: {
      getProfiles: () => AgentProfile[];
      getProfile: (id: string) => AgentProfile | undefined;
      getRoomInfo?: () => RoomInfoMessage;
    }
  ) {
    this.clientManager = clientManager;
    this.getProfiles = opts.getProfiles;
    this.getProfile = opts.getProfile;
    this.getRoomInfo = opts.getRoomInfo ?? null;

    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const client = this.clientManager.addClient(ws);
      console.log(`[ws] Client ${client.id} connected (${this.clientManager.size} total)`);

      // Parse ?agent= param for preview mode follow
      const url = new URL(req.url ?? "/", "http://localhost");
      const followAgent = url.searchParams.get("agent");
      if (followAgent) {
        this.clientManager.setFollowAgent(ws, followAgent);
      }

      // Send room info immediately on connect
      if (this.getRoomInfo) {
        this.send(ws, { type: "roomInfo", info: this.getRoomInfo() });
      }

      // Game loop will send the first snapshot on the next tick
      // (client.lastAckTick === 0 triggers full snapshot)

      ws.on("message", (raw) => {
        // Enforce message size limit (64KB) like the HTTP side
        const rawBuf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
        if (rawBuf.byteLength > 64 * 1024) {
          return; // Drop oversized messages
        }
        let msg: WSClientMessage;
        try {
          msg = JSON.parse(rawBuf.toString()) as WSClientMessage;
        } catch {
          return; // Ignore malformed JSON
        }
        try {
          this.handleClientMessage(ws, msg);
        } catch (err) {
          console.error("[ws] Error handling message:", err);
        }
      });

      ws.on("close", () => {
        this.clientManager.removeClient(ws);
        console.log(`[ws] Client disconnected (${this.clientManager.size} total)`);
      });
    });
  }

  private handleClientMessage(ws: WebSocket, msg: WSClientMessage): void {
    switch (msg.type) {
      case "subscribe":
        // Client wants a fresh snapshot — reset ack to trigger full snapshot next tick
        {
          const state = this.clientManager.getByWs(ws);
          if (state) state.lastAckTick = 0;
        }
        break;

      case "requestProfiles":
        this.send(ws, {
          type: "profiles",
          profiles: this.getProfiles(),
        });
        break;

      case "requestProfile":
        if (msg.agentId) {
          const profile = this.getProfile(msg.agentId);
          if (profile) {
            this.send(ws, { type: "profile", profile });
          }
        }
        break;

      case "viewport":
        // Client reports camera position for AOI filtering
        if ("x" in msg && "z" in msg) {
          const m = msg as unknown as { x: number; z: number };
          this.clientManager.updateViewport(ws, m.x, m.z);
        }
        break;

      case "follow":
        // Client wants to follow a specific agent
        if ("agentId" in msg) {
          this.clientManager.setFollowAgent(ws, (msg as unknown as { agentId: string }).agentId);
        }
        break;

      case "requestRoomInfo":
        if (this.getRoomInfo) {
          this.send(ws, { type: "roomInfo", info: this.getRoomInfo() });
        }
        break;
    }
  }

  private send(ws: WebSocket, msg: WSServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
