import { WORLD_SIZE, type WorldMessage } from "./types.js";

/** Max agent commands per second (rate limit) */
const MAX_CMD_RATE = 20;
const RATE_WINDOW_MS = 1000;

/** World half-size (bounds check) */
const WORLD_HALF = WORLD_SIZE / 2;

/** Obstacle definitions for server-side collision */
export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

export class CommandQueue {
  /** Pending commands to be consumed by the game loop */
  private pending: WorldMessage[] = [];

  /** Rate limit tracking: agentId → timestamps of recent commands */
  private rateBuckets = new Map<string, number[]>();

  /** Known obstacles for collision validation */
  private obstacles: Obstacle[] = [];

  setObstacles(obs: Obstacle[]): void {
    this.obstacles = obs;
  }

  /**
   * Enqueue a command from an agent. Returns false if rate-limited or invalid.
   * The game loop drains the queue each tick.
   */
  enqueue(msg: WorldMessage): { ok: boolean; reason?: string } {
    // Rate limit
    if (!this.checkRate(msg.agentId)) {
      return { ok: false, reason: "rate_limited" };
    }

    // Validate position commands
    if (msg.worldType === "position") {
      // Bounds check
      if (Math.abs(msg.x) > WORLD_HALF || Math.abs(msg.z) > WORLD_HALF) {
        return { ok: false, reason: "out_of_bounds" };
      }

      // Obstacle collision check
      for (const obs of this.obstacles) {
        const dx = msg.x - obs.x;
        const dz = msg.z - obs.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < obs.radius + 1.0) {
          return { ok: false, reason: "collision" };
        }
      }
    }

    // Chat text length limit
    if (msg.worldType === "chat") {
      if (msg.text.length > 500) {
        return { ok: false, reason: "text_too_long" };
      }
    }

    this.pending.push(msg);
    return { ok: true };
  }

  /** Drain all pending commands (called by game loop each tick) */
  drain(): WorldMessage[] {
    const cmds = this.pending;
    this.pending = [];
    return cmds;
  }

  /** Check rate limit. Returns true if allowed. */
  private checkRate(agentId: string): boolean {
    const now = Date.now();
    let bucket = this.rateBuckets.get(agentId);
    if (!bucket) {
      bucket = [];
      this.rateBuckets.set(agentId, bucket);
    }

    // Remove old timestamps outside the window
    const cutoff = now - RATE_WINDOW_MS;
    while (bucket.length > 0 && bucket[0] < cutoff) {
      bucket.shift();
    }

    if (bucket.length >= MAX_CMD_RATE) {
      return false;
    }

    bucket.push(now);
    return true;
  }

  /** Remove rate-limit bucket for an agent that has left */
  pruneAgent(agentId: string): void {
    this.rateBuckets.delete(agentId);
  }
}
