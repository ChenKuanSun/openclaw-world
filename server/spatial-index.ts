import type { AgentPosition } from "./types.js";

/**
 * Grid-based spatial index for fast AOI (Area of Interest) queries.
 * Divides the 100x100 world into 10x10 cells (each 10 units).
 */
export class SpatialGrid {
  private readonly cellSize: number;
  private cells = new Map<string, Set<string>>();

  constructor(cellSize = 10) {
    this.cellSize = cellSize;
  }

  /** Rebuild the entire grid from current positions */
  rebuild(positions: Map<string, AgentPosition>): void {
    this.cells.clear();
    for (const [agentId, pos] of positions) {
      const key = this.cellKey(pos.x, pos.z);
      let cell = this.cells.get(key);
      if (!cell) {
        cell = new Set();
        this.cells.set(key, cell);
      }
      cell.add(agentId);
    }
  }

  /** Query all agent IDs within a radius of (x, z) */
  queryRadius(x: number, z: number, radius: number): Set<string> {
    const result = new Set<string>();
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const cell = this.cells.get(`${cx},${cz}`);
        if (cell) {
          for (const id of cell) result.add(id);
        }
      }
    }
    return result;
  }

  /** Get which cell an agent is in */
  private cellKey(x: number, z: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }
}
