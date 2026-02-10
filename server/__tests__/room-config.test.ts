import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadRoomConfig } from "../room-config.js";

describe("loadRoomConfig", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = ["ROOM_ID", "ROOM_NAME", "ROOM_DESCRIPTION", "WORLD_HOST", "WORLD_PORT", "MAX_AGENTS"];

  beforeEach(() => {
    for (const k of envKeys) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("generates a 12-character roomId when not set", () => {
    const config = loadRoomConfig();
    expect(config.roomId).toHaveLength(12);
    expect(config.roomId).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["roomName", "Lobster Room"],
    ["roomDescription", ""],
    ["host", "127.0.0.1"],
    ["port", 18800],
    ["maxAgents", 50],
  ] as const)("defaults %s to %s", (field, expected) => {
    const config = loadRoomConfig();
    expect(config[field]).toBe(expected);
  });

  it.each([
    ["ROOM_ID", "custom-room-1", "roomId", "custom-room-1"],
    ["ROOM_NAME", "Test Room", "roomName", "Test Room"],
    ["ROOM_DESCRIPTION", "AI research lab", "roomDescription", "AI research lab"],
    ["WORLD_HOST", "0.0.0.0", "host", "0.0.0.0"],
    ["WORLD_PORT", "9999", "port", 9999],
    ["MAX_AGENTS", "10", "maxAgents", 10],
  ] as const)("uses %s from env", (envKey, envVal, field, expected) => {
    process.env[envKey] = envVal;
    const config = loadRoomConfig();
    expect(config[field]).toBe(expected);
  });

  it("generates different IDs on each call", () => {
    const id1 = loadRoomConfig().roomId;
    const id2 = loadRoomConfig().roomId;
    expect(id1).not.toBe(id2);
  });
});
