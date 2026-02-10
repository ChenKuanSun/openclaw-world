import type { AgentPosition, AgentState, WorldMessage } from "./types.js";
import type { AgentRegistry } from "./agent-registry.js";

/** Max events kept in history ring buffer */
const EVENT_HISTORY_SIZE = 200;

export class WorldState {
  private positions = new Map<string, AgentPosition>();
  private actions = new Map<string, string>();
  private registry: AgentRegistry;

  /** Fixed-size circular buffer of recent world events */
  private eventBuf: (WorldMessage | null)[] = new Array(EVENT_HISTORY_SIZE).fill(null);
  /** Write pointer — wraps around the buffer */
  private eventWriteIdx = 0;
  /** Total number of events ever written (used to compute readable range) */
  private eventCount = 0;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  /** Apply a validated world message and update state */
  apply(msg: WorldMessage): void {
    // Record non-position events in history (positions are too frequent)
    if (msg.worldType !== "position" && msg.worldType !== "action") {
      this.eventBuf[this.eventWriteIdx] = msg;
      this.eventWriteIdx = (this.eventWriteIdx + 1) % EVENT_HISTORY_SIZE;
      this.eventCount++;
    }

    switch (msg.worldType) {
      case "position":
        this.positions.set(msg.agentId, {
          agentId: msg.agentId,
          x: msg.x,
          y: msg.y,
          z: msg.z,
          rotation: msg.rotation,
          timestamp: msg.timestamp,
        });
        this.registry.touch(msg.agentId);
        break;

      case "action":
        this.actions.set(msg.agentId, msg.action);
        this.registry.touch(msg.agentId);
        break;

      case "join": {
        this.registry.register({
          agentId: msg.agentId,
          name: msg.name,
          color: msg.color,
          bio: msg.bio,
          capabilities: msg.capabilities,
        });
        // Assign random start position if none
        if (!this.positions.has(msg.agentId)) {
          this.positions.set(msg.agentId, {
            agentId: msg.agentId,
            x: (Math.random() - 0.5) * 60,
            y: 0,
            z: (Math.random() - 0.5) * 60,
            rotation: Math.random() * Math.PI * 2,
            timestamp: msg.timestamp,
          });
        }
        this.actions.set(msg.agentId, "idle");
        break;
      }

      case "leave":
        this.positions.delete(msg.agentId);
        this.actions.delete(msg.agentId);
        break;

      case "profile":
        this.registry.register({
          agentId: msg.agentId,
          name: msg.name,
          bio: msg.bio,
          capabilities: msg.capabilities,
          color: msg.color,
        });
        break;

      case "chat":
      case "emote":
        this.registry.touch(msg.agentId);
        break;
    }
  }

  /** Get all current positions (for spatial index rebuild) */
  getAllPositions(): Map<string, AgentPosition> {
    return this.positions;
  }

  /** Get full snapshot of all agent states */
  snapshot(): AgentState[] {
    const result: AgentState[] = [];
    for (const profile of this.registry.getOnline()) {
      const position = this.positions.get(profile.agentId);
      if (!position) continue;
      result.push({
        profile,
        position,
        action: this.actions.get(profile.agentId) ?? "idle",
      });
    }
    return result;
  }

  /** Get position of a specific agent */
  getPosition(agentId: string): AgentPosition | undefined {
    return this.positions.get(agentId);
  }

  /** Check if agent exists in the world */
  hasAgent(agentId: string): boolean {
    return this.positions.has(agentId);
  }

  /** Get IDs of all agents currently in the world (have positions) */
  getActiveAgentIds(): Set<string> {
    return new Set(this.positions.keys());
  }

  /** Get recent events, optionally filtered by timestamp */
  getEvents(sinceTs = 0, limit = 50): WorldMessage[] {
    const stored = Math.min(this.eventCount, EVENT_HISTORY_SIZE);
    // Read from oldest to newest
    const startIdx =
      (this.eventWriteIdx - stored + EVENT_HISTORY_SIZE) % EVENT_HISTORY_SIZE;
    const result: WorldMessage[] = [];
    for (let i = 0; i < stored && result.length < limit; i++) {
      const ev = this.eventBuf[(startIdx + i) % EVENT_HISTORY_SIZE];
      if (ev && (sinceTs <= 0 || ev.timestamp > sinceTs)) {
        result.push(ev);
      }
    }
    // Return only the last `limit` entries
    return result.length > limit ? result.slice(-limit) : result;
  }
}
