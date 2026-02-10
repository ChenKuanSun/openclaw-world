import { describe, it, expect, beforeEach } from "vitest";
import { SpatialGrid } from "../spatial-index.js";
import type { AgentPosition } from "../types.js";

function pos(x: number, z: number): AgentPosition {
  return { x, y: 0, z, agentId: "", rotation: 0, timestamp: 0 };
}

function buildPositions(entries: Record<string, [number, number]>): Map<string, AgentPosition> {
  const map = new Map<string, AgentPosition>();
  for (const [id, [x, z]] of Object.entries(entries)) {
    map.set(id, pos(x, z));
  }
  return map;
}

describe("SpatialGrid", () => {
  let grid: SpatialGrid;

  beforeEach(() => {
    grid = new SpatialGrid(10);
  });

  it("returns empty set for empty grid", () => {
    const result = grid.queryRadius(0, 0, 50);
    expect(result.size).toBe(0);
  });

  it("finds agents within radius", () => {
    grid.rebuild(buildPositions({ a1: [5, 5], a2: [50, 50] }));

    const nearby = grid.queryRadius(0, 0, 15);
    expect(nearby.has("a1")).toBe(true);
    expect(nearby.has("a2")).toBe(false);
  });

  it("finds all agents with large radius", () => {
    grid.rebuild(buildPositions({ a1: [-40, -40], a2: [40, 40] }));

    const all = grid.queryRadius(0, 0, 100);
    expect(all.has("a1")).toBe(true);
    expect(all.has("a2")).toBe(true);
  });

  it("rebuild clears previous data", () => {
    grid.rebuild(buildPositions({ a1: [0, 0] }));
    grid.rebuild(buildPositions({ a2: [0, 0] }));

    const result = grid.queryRadius(0, 0, 50);
    expect(result.has("a1")).toBe(false);
    expect(result.has("a2")).toBe(true);
  });

  it("handles negative coordinates", () => {
    grid.rebuild(buildPositions({ a1: [-15, -20] }));

    const result = grid.queryRadius(-10, -15, 20);
    expect(result.has("a1")).toBe(true);
  });

  it("handles custom cell size", () => {
    const smallGrid = new SpatialGrid(5);
    smallGrid.rebuild(buildPositions({ a1: [3, 3], a2: [30, 30] }));

    const result = smallGrid.queryRadius(0, 0, 10);
    expect(result.has("a1")).toBe(true);
    expect(result.has("a2")).toBe(false);
  });
});
