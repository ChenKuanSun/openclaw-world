import type { RoomConfig } from "./room-config.js";

export interface RoomInfo {
  roomId: string;
  name: string;
  description: string;
  agents: number;
  maxAgents: number;
  nostrChannelId: string | null;
}

export function createRoomInfoGetter(
  config: RoomConfig,
  getAgentCount: () => number,
  getChannelId: () => string | null,
): () => RoomInfo {
  return () => ({
    roomId: config.roomId,
    name: config.roomName,
    description: config.roomDescription,
    agents: getAgentCount(),
    maxAgents: config.maxAgents,
    nostrChannelId: getChannelId(),
  });
}
