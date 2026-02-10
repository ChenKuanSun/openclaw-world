import { WebSocket } from "ws";
import type { WorldState } from "./world-state.js";
import type { SpatialGrid } from "./spatial-index.js";
import type { CommandQueue } from "./command-queue.js";
import { ClientManager, AOI_RADIUS } from "./client-manager.js";
import type { WorldMessage, AgentState, WSServerMessage } from "./types.js";
import type { NostrWorld } from "./nostr-world.js";

/** Server tick rate in Hz */
export const TICK_RATE = 20;
const TICK_MS = 1000 / TICK_RATE;

/** How often to send full snapshots (every N ticks = every 5 seconds) */
const FULL_SNAPSHOT_INTERVAL = TICK_RATE * 5;

export class GameLoop {
  private tickCount = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Events that happened this tick — broadcast to relevant clients */
  private tickEvents: WorldMessage[] = [];

  constructor(
    private worldState: WorldState,
    private spatialGrid: SpatialGrid,
    private commandQueue: CommandQueue,
    private clientManager: ClientManager,
    private nostr: NostrWorld,
  ) {}

  get currentTick(): number {
    return this.tickCount;
  }

  start(): void {
    console.log(`[game] Starting game loop at ${TICK_RATE}Hz (${TICK_MS}ms/tick)`);
    this.intervalId = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    try {
      this.tickCount++;
      this.tickEvents = [];

      // 1. Drain pending commands from the queue
      const commands = this.commandQueue.drain();

      // 2. Apply commands to world state, collect events
      for (const cmd of commands) {
        this.worldState.apply(cmd);
        this.tickEvents.push(cmd);

        // Clean up rate-limit bucket when agent leaves
        if (cmd.worldType === "leave") {
          this.commandQueue.pruneAgent(cmd.agentId);
        }

        // Publish to Nostr relay (non-blocking)
        this.nostr.publish(cmd).catch((err) => {
          console.warn("[game] Nostr publish error:", err);
        });
      }

      // 3. Rebuild spatial index from current positions
      this.spatialGrid.rebuild(this.worldState.getAllPositions());

      // 4. Update client viewports from followed agents
      for (const client of this.clientManager.getAllClients()) {
        if (client.followAgent) {
          const pos = this.worldState.getPosition(client.followAgent);
          if (pos) {
            client.viewX = pos.x;
            client.viewZ = pos.z;
          }
        }
      }

      // 5. Send updates to each client (AOI-filtered)
      const isFullSnapshotTick = this.tickCount % FULL_SNAPSHOT_INTERVAL === 0;

      for (const client of this.clientManager.getAllClients()) {
        if (client.ws.readyState !== WebSocket.OPEN) continue;

        const isFirstSnapshot = client.lastAckTick === 0;
        if (isFullSnapshotTick || isFirstSnapshot) {
          // First snapshot is unfiltered so client sees ALL agents
          this.sendSnapshot(client, isFirstSnapshot);
          if (isFirstSnapshot) {
            client.lastAckTick = this.tickCount;
          }
        } else {
          this.sendTickEvents(client);
        }
      }
    } catch (err) {
      console.error(`[game] Tick ${this.tickCount} error:`, err);
    }
  }

  /** Send snapshot to a client. First snapshot is unfiltered; subsequent are AOI-filtered. */
  private sendSnapshot(client: { ws: WebSocket; viewX: number; viewZ: number }, unfiltered = false): void {
    const allStates = this.worldState.snapshot();

    let agents: typeof allStates;
    if (unfiltered) {
      agents = allStates;
    } else {
      const nearbyAgents = this.spatialGrid.queryRadius(
        client.viewX,
        client.viewZ,
        AOI_RADIUS
      );
      agents = allStates.filter((s) => nearbyAgents.has(s.profile.agentId));
    }

    const msg: WSServerMessage = {
      type: "snapshot",
      agents,
    };
    this.safeSend(client.ws, msg);
  }

  /** Send only this tick's events that are within client's AOI */
  private sendTickEvents(client: { ws: WebSocket; viewX: number; viewZ: number }): void {
    if (this.tickEvents.length === 0) return;

    const nearbyAgents = this.spatialGrid.queryRadius(
      client.viewX,
      client.viewZ,
      AOI_RADIUS
    );

    for (const event of this.tickEvents) {
      // Events from join/leave/profile/chat/emote are always sent (global)
      const isGlobal =
        event.worldType === "join" ||
        event.worldType === "leave" ||
        event.worldType === "profile" ||
        event.worldType === "chat" ||
        event.worldType === "emote";

      if (isGlobal || nearbyAgents.has(event.agentId)) {
        const msg: WSServerMessage = { type: "world", message: event };
        this.safeSend(client.ws, msg);
      }
    }
  }

  /** Safe JSON send — never throws */
  private safeSend(ws: WebSocket, msg: WSServerMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    } catch (err) {
      console.warn("[game] Send error:", err);
    }
  }
}
