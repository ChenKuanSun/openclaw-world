import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import type { WorldMessage } from "./types.js";

export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];

const CHANNEL_ABOUT = "OpenClaw Lobster World — agent visualization channel";

export class NostrWorld {
  private pool: SimplePool;
  private relays: string[];
  private privateKey: Uint8Array;
  private publicKey: string;
  private channelId: string | null = null;
  private channelName: string;
  private onMessage: ((msg: WorldMessage) => void) | null = null;
  private isKnownAgent: ((agentId: string) => boolean) | null = null;

  constructor(relays?: string[], roomId?: string, roomName?: string) {
    this.relays = relays ?? DEFAULT_RELAYS;
    this.pool = new SimplePool();
    this.privateKey = generateSecretKey();
    this.publicKey = getPublicKey(this.privateKey);
    this.channelName = roomId ? `openclaw-world-${roomId}` : "openclaw-world";
  }

  /** Set callback for incoming world messages */
  setMessageHandler(handler: (msg: WorldMessage) => void): void {
    this.onMessage = handler;
  }

  /** Set a validator to check if an agentId is registered */
  setAgentValidator(validator: (agentId: string) => boolean): void {
    this.isKnownAgent = validator;
  }

  /** Initialize: find or create the world channel, subscribe to messages */
  async init(): Promise<void> {
    // Try to find existing channel
    await this.findOrCreateChannel();

    // Subscribe to kind 42 messages on this channel
    this.subscribeToChannel();

    console.log(`[nostr] Connected, channel: ${this.channelId?.slice(0, 12)}...`);
    console.log(`[nostr] World pubkey: ${this.publicKey.slice(0, 16)}...`);
  }

  /** Publish a world message to the channel */
  async publish(msg: WorldMessage): Promise<void> {
    if (!this.channelId) return;

    const event = finalizeEvent(
      {
        kind: 42,
        tags: [
          ["e", this.channelId, this.relays[0], "root"],
        ],
        content: JSON.stringify(msg),
        created_at: Math.floor(Date.now() / 1000),
      },
      this.privateKey
    );

    await Promise.any(this.pool.publish(this.relays, event)).catch(() => {
      // Best-effort publish
    });
  }

  /** Close all relay connections */
  close(): void {
    this.pool.close(this.relays);
  }

  /** Get the underlying SimplePool instance */
  getPool(): SimplePool {
    return this.pool;
  }

  /** Get configured relays */
  getRelays(): string[] {
    return this.relays;
  }

  /** Sign and finalize a Nostr event (keeps private key encapsulated) */
  signEvent(unsignedEvent: { kind: number; tags: string[][]; content: string; created_at: number }) {
    return finalizeEvent(unsignedEvent, this.privateKey);
  }

  /** Get the Nostr channel ID */
  getChannelId(): string | null {
    return this.channelId;
  }

  private async findOrCreateChannel(): Promise<void> {
    // Query for existing channels (kind 40)
    const events = await this.pool.querySync(this.relays, {
      kinds: [40],
      limit: 20,
    });

    for (const event of events) {
      try {
        const meta = JSON.parse(event.content);
        if (meta.name === this.channelName) {
          this.channelId = event.id;
          return;
        }
      } catch {
        // Skip malformed
      }
    }

    // Create new channel
    const channelEvent = finalizeEvent(
      {
        kind: 40,
        tags: [],
        content: JSON.stringify({
          name: this.channelName,
          about: CHANNEL_ABOUT,
          picture: "",
        }),
        created_at: Math.floor(Date.now() / 1000),
      },
      this.privateKey
    );

    await Promise.any(this.pool.publish(this.relays, channelEvent)).catch(() => {});
    this.channelId = channelEvent.id;
  }

  private subscribeToChannel(): void {
    if (!this.channelId) return;

    this.pool.subscribeMany(
      this.relays,
      {
        kinds: [42],
        "#e": [this.channelId],
        since: Math.floor(Date.now() / 1000) - 300,
      },
      {
        onevent: (event) => {
          // Skip our own messages to prevent echo loops
          if (event.pubkey === this.publicKey) return;

          try {
            const msg = JSON.parse(event.content) as WorldMessage;
            if (msg.worldType && msg.agentId) {
              // Only accept messages from known registered agents
              if (this.isKnownAgent && !this.isKnownAgent(msg.agentId)) {
                return;
              }
              this.onMessage?.(msg);
            }
          } catch {
            // Skip malformed messages
          }
        },
        oneose: () => {
          // End of stored events
        },
      }
    );
  }
}
