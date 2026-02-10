import type { NostrWorld } from "./nostr-world.js";
import type { RoomInfoMessage } from "./types.js";

const PUBLISH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DISCOVERY_TAG = "openclaw-world";

export interface WorldServerEntry {
  roomId: string;
  name: string;
  publicUrl: string | null;
  agents: number;
  maxAgents: number;
  nostrChannelId: string | null;
  publishedAt: number;
  pubkey: string;
}

/**
 * Nostr-based world server discovery.
 * In world mode, publishes server info as kind 30078 (replaceable) events.
 * Other clients can query these events to discover available world servers.
 */
export class NostrDiscovery {
  private nostr: NostrWorld;
  private getRoomInfo: () => RoomInfoMessage;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(nostr: NostrWorld, getRoomInfo: () => RoomInfoMessage) {
    this.nostr = nostr;
    this.getRoomInfo = getRoomInfo;
  }

  /** Start publishing world server info every 5 minutes */
  startPublishing(): void {
    // Publish immediately, then every 5 min
    this.publishOnce();
    this.timer = setInterval(() => this.publishOnce(), PUBLISH_INTERVAL);
  }

  /** Stop publishing */
  stopPublishing(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Query all published world servers from Nostr relays */
  async queryWorldServers(): Promise<WorldServerEntry[]> {
    const pool = this.nostr.getPool();
    const relays = this.nostr.getRelays();

    const events = await pool.querySync(relays, {
      kinds: [30078],
      "#d": [DISCOVERY_TAG],
      limit: 50,
    });

    const servers: WorldServerEntry[] = [];
    const seen = new Set<string>();

    for (const event of events) {
      try {
        const info = JSON.parse(event.content) as {
          roomId: string;
          name: string;
          publicUrl: string | null;
          agents: number;
          maxAgents: number;
          nostrChannelId: string | null;
        };

        // Deduplicate by pubkey (each server has unique keypair)
        if (seen.has(event.pubkey)) continue;
        seen.add(event.pubkey);

        // Skip entries older than 15 minutes (stale)
        const age = Date.now() / 1000 - event.created_at;
        if (age > 15 * 60) continue;

        servers.push({
          roomId: info.roomId,
          name: info.name,
          publicUrl: info.publicUrl,
          agents: info.agents,
          maxAgents: info.maxAgents,
          nostrChannelId: info.nostrChannelId,
          publishedAt: event.created_at * 1000,
          pubkey: event.pubkey,
        });
      } catch {
        // Skip malformed
      }
    }

    return servers;
  }

  private publishOnce(): void {
    const info = this.getRoomInfo();
    const pool = this.nostr.getPool();
    const relays = this.nostr.getRelays();
    const event = this.nostr.signEvent({
      kind: 30078,
      tags: [
        ["d", DISCOVERY_TAG],
      ],
      content: JSON.stringify({
        roomId: info.roomId,
        name: info.name,
        agents: info.agents,
        maxAgents: info.maxAgents,
        nostrChannelId: info.nostrChannelId,
      }),
      created_at: Math.floor(Date.now() / 1000),
    });

    Promise.any(pool.publish(relays, event)).catch(() => {
      // Best-effort publish
    });
  }
}
