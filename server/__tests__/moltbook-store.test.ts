import { describe, it, expect, beforeEach, vi } from "vitest";
import { MoltbookStore } from "../moltbook-store.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from "node:fs";

describe("MoltbookStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty list when no file exists", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const store = new MoltbookStore();
    expect(store.list()).toEqual([]);
  });

  it("loads posts from JSON file", () => {
    const posts = [
      { id: "mb_1", title: "Post 1", author: "alice", content: "Hello", createdAt: 1000 },
      { id: "mb_2", title: "Post 2", author: "bob", content: "World", createdAt: 2000 },
    ];
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(posts));
    const store = new MoltbookStore();
    const result = store.list();
    expect(result).toHaveLength(2);
    // Newest first
    expect(result[0].title).toBe("Post 2");
    expect(result[1].title).toBe("Post 1");
  });

  it("handles malformed JSON gracefully", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("not json");
    const store = new MoltbookStore();
    expect(store.list()).toEqual([]);
  });

  it("handles non-array JSON gracefully", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ foo: "bar" }));
    const store = new MoltbookStore();
    expect(store.list()).toEqual([]);
  });

  it("reload re-reads from disk", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const store = new MoltbookStore();
    expect(store.list()).toEqual([]);

    // Simulate file appearing
    const posts = [{ id: "mb_1", title: "New", author: "a", content: "c", createdAt: 1000 }];
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(posts));
    store.reload();
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].title).toBe("New");
  });
});
