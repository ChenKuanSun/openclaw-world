import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface MoltbookPost {
  id: string;
  title: string;
  author: string;
  content: string;
  createdAt: number;
}

const STORE_PATH = resolve(process.cwd(), "moltbook.json");

/**
 * Read-only Moltbook store.
 * Reads posts from moltbook.json — the room host populates this file.
 * Agents can also post via IPC (moltbook-post command).
 */
export class MoltbookStore {
  private posts: MoltbookPost[] = [];

  constructor() {
    this.load();
  }

  /** Reload posts from disk */
  reload(): void {
    this.load();
  }

  /** List all posts, newest first */
  list(): MoltbookPost[] {
    return [...this.posts].reverse();
  }

  private load(): void {
    try {
      if (existsSync(STORE_PATH)) {
        const data = JSON.parse(readFileSync(STORE_PATH, "utf-8"));
        if (Array.isArray(data)) this.posts = data;
      }
    } catch {
      // Start fresh
    }
  }
}
