import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AgentRegistry } from "./agent-registry.js";
import { WorldState } from "./world-state.js";
import { NostrWorld } from "./nostr-world.js";
import { WSBridge } from "./ws-bridge.js";
import { ClawhubStore } from "./clawhub-store.js";
import { SpatialGrid } from "./spatial-index.js";
import { CommandQueue } from "./command-queue.js";
import { ClientManager } from "./client-manager.js";
import { GameLoop, TICK_RATE } from "./game-loop.js";
import { loadRoomConfig } from "./room-config.js";
import { createRoomInfoGetter } from "./room-info.js";
import type { WorldMessage, JoinMessage, AgentSkillDeclaration } from "./types.js";

// ── Room configuration ────────────────────────────────────────

const config = loadRoomConfig();
const RELAYS = process.env.WORLD_RELAYS?.split(",") ?? undefined;

// ── Core services ──────────────────────────────────────────────

const registry = new AgentRegistry();
const state = new WorldState(registry);
const nostr = new NostrWorld(RELAYS, config.roomId, config.roomName);
const clawhub = new ClawhubStore();

// ── Game engine services ────────────────────────────────────────

const spatialGrid = new SpatialGrid(10);
const commandQueue = new CommandQueue();
const clientManager = new ClientManager();

commandQueue.setObstacles([
  { x: -20, z: -20, radius: 4 },  // Moltbook
  { x: 22, z: -22, radius: 6 },   // Clawhub
  { x: 0, z: -35, radius: 5 },    // Worlds Portal
]);

const gameLoop = new GameLoop(state, spatialGrid, commandQueue, clientManager, nostr);

// ── Room info ──────────────────────────────────────────────────

const getRoomInfo = createRoomInfoGetter(
  config,
  () => state.getActiveAgentIds().size,
  () => nostr.getChannelId(),
);

// ── Helper functions ────────────────────────────────────────────

function readBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk: Buffer | string) => {
      size += typeof chunk === "string" ? chunk.length : chunk.byteLength;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

// ── HTTP server ─────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // ── REST API: Room events (chat history for agent collaboration) ─
  if (url.startsWith("/api/events") && method === "GET") {
    const reqUrl = new URL(req.url ?? "/", "http://localhost");
    const since = Number(reqUrl.searchParams.get("since") || "0");
    const limit = Math.min(Number(reqUrl.searchParams.get("limit") || "50"), 200);
    return json(res, 200, { ok: true, events: state.getEvents(since, limit) });
  }

  // ── REST API: Room info ─────────────────────────────────────
  if (url === "/api/room" && method === "GET") {
    return json(res, 200, { ok: true, ...getRoomInfo() });
  }

  // ── REST API: Room invite (for sharing via Nostr) ────────────
  if (url === "/api/invite" && method === "GET") {
    const info = getRoomInfo();
    return json(res, 200, {
      ok: true,
      invite: {
        roomId: info.roomId,
        name: info.name,
        relays: nostr.getRelays(),
        channelId: nostr.getChannelId(),
        agents: info.agents,
        maxAgents: info.maxAgents,
      },
    });
  }

  // ── REST API: Moltbook feed (proxy to moltbook.com) ────────
  if (url.startsWith("/api/moltbook/feed") && method === "GET") {
    try {
      const feedUrl = "https://www.moltbook.com/posts?sort=hot&limit=20";
      const headers: Record<string, string> = { "Accept": "application/json" };
      const moltbookKey = process.env.MOLTBOOK_API_KEY;
      if (moltbookKey) {
        headers["Authorization"] = `Bearer ${moltbookKey}`;
      }
      const upstream = await fetch(feedUrl, { headers, signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) {
        return json(res, 502, { ok: false, error: `moltbook.com returned ${upstream.status}` });
      }
      const data = await upstream.json();
      return json(res, 200, { ok: true, posts: data });
    } catch (err) {
      return json(res, 502, { ok: false, error: `Could not reach moltbook.com: ${String(err)}` });
    }
  }

  // ── REST API: Clawhub marketplace proxy (clawhub.ai) ────────
  if (url.startsWith("/api/clawhub/browse") && method === "GET") {
    try {
      const reqUrl = new URL(req.url ?? "/", "http://localhost");
      const sort = reqUrl.searchParams.get("sort") || "trending";
      const query = reqUrl.searchParams.get("q") || "";
      const limit = reqUrl.searchParams.get("limit") || "50";

      let upstream: string;
      if (query) {
        upstream = `https://clawhub.ai/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      } else {
        upstream = `https://clawhub.ai/api/v1/skills?sort=${encodeURIComponent(sort)}&limit=${limit}`;
      }

      const response = await fetch(upstream, {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return json(res, 502, { ok: false, error: `clawhub.ai returned ${response.status}` });
      }
      const data = await response.json();
      return json(res, 200, { ok: true, data });
    } catch (err) {
      return json(res, 502, { ok: false, error: `Could not reach clawhub.ai: ${String(err)}` });
    }
  }

  // ── REST API: Clawhub (local plugins) ──────────────────────
  if (url === "/api/clawhub/skills" && method === "GET") {
    return json(res, 200, { ok: true, skills: clawhub.list() });
  }

  if (url === "/api/clawhub/skills" && method === "POST") {
    try {
      const body = (await readBody(req)) as {
        id?: string; name?: string; description?: string;
        author?: string; version?: string; tags?: string[];
      };
      if (!body.id || !body.name) {
        return json(res, 400, { ok: false, error: "id and name required" });
      }
      const skill = clawhub.publish({
        id: body.id,
        name: body.name,
        description: body.description ?? "",
        author: body.author ?? "unknown",
        version: body.version ?? "0.1.0",
        tags: body.tags ?? [],
      });
      return json(res, 201, { ok: true, skill });
    } catch (err) {
      return json(res, 400, { ok: false, error: String(err) });
    }
  }

  if (url === "/api/clawhub/install" && method === "POST") {
    try {
      const body = (await readBody(req)) as { skillId?: string };
      if (!body.skillId) {
        return json(res, 400, { ok: false, error: "skillId required" });
      }
      const record = clawhub.install(body.skillId);
      if (!record) return json(res, 404, { ok: false, error: "skill not found" });
      return json(res, 200, { ok: true, installed: record });
    } catch (err) {
      return json(res, 400, { ok: false, error: String(err) });
    }
  }

  if (url === "/api/clawhub/uninstall" && method === "POST") {
    try {
      const body = (await readBody(req)) as { skillId?: string };
      if (!body.skillId) {
        return json(res, 400, { ok: false, error: "skillId required" });
      }
      const ok = clawhub.uninstall(body.skillId);
      return json(res, ok ? 200 : 404, { ok });
    } catch (err) {
      return json(res, 400, { ok: false, error: String(err) });
    }
  }

  if (url === "/api/clawhub/installed" && method === "GET") {
    return json(res, 200, { ok: true, installed: clawhub.getInstalled() });
  }

  // ── IPC JSON API (agent commands — go through command queue) ─
  if (method === "POST" && (url === "/" || url === "/ipc")) {
    try {
      const parsed = await readBody(req);
      const result = await handleCommand(parsed as Record<string, unknown>);
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: String(err) });
    }
  }

  // ── Server info ─────────────────────────────────────────────
  if (method === "GET" && url === "/health") {
    return json(res, 200, {
      status: "ok",
      roomId: config.roomId,
      agents: registry.getOnline().length,
      clients: clientManager.size,
      tick: gameLoop.currentTick,
      tickRate: TICK_RATE,
    });
  }

  json(res, 404, { error: "Not found" });
});

// ── WebSocket bridge ───────────────────────────────────────────

new WSBridge(server, clientManager, {
  getProfiles: () => {
    // Only return profiles of agents currently in the world (with positions)
    const activeIds = state.getActiveAgentIds();
    return registry.getAll().filter((p) => activeIds.has(p.agentId));
  },
  getProfile: (id) => registry.get(id),
  getRoomInfo,
});

// ── Nostr integration (for room sharing via relay) ─────────────

nostr.setAgentValidator((agentId: string) => registry.get(agentId) !== undefined);
nostr.setMessageHandler((msg: WorldMessage) => {
  commandQueue.enqueue(msg);
});

// ── IPC command handler ────────────────────────────────────────

async function handleCommand(parsed: Record<string, unknown>): Promise<unknown> {
  const { command, args } = parsed as {
    command: string;
    args?: Record<string, unknown>;
  };

  // Commands that require a registered agentId
  const agentCommands = new Set([
    "world-move", "world-action", "world-chat", "world-emote", "world-leave",
  ]);
  if (agentCommands.has(command)) {
    const agentId = (args as { agentId?: string })?.agentId;
    if (!agentId || !registry.get(agentId)) {
      throw new Error("Unknown or unregistered agentId");
    }
  }

  switch (command) {
    case "register": {
      const onlineCount = state.getActiveAgentIds().size;
      if (onlineCount >= config.maxAgents) {
        return { ok: false, error: `Room is full (${config.maxAgents} max)` };
      }

      const a = args as {
        agentId: string;
        name?: string;
        pubkey?: string;
        bio?: string;
        capabilities?: string[];
        color?: string;
        skills?: AgentSkillDeclaration[];
      };
      if (!a?.agentId) throw new Error("agentId required");
      const profile = registry.register(a);

      const joinMsg: JoinMessage = {
        worldType: "join",
        agentId: profile.agentId,
        name: profile.name,
        color: profile.color,
        bio: profile.bio,
        capabilities: profile.capabilities,
        skills: profile.skills,
        timestamp: Date.now(),
      };
      commandQueue.enqueue(joinMsg);

      const previewUrl = `http://localhost:${process.env.VITE_PORT ?? "3000"}/?agent=${encodeURIComponent(profile.agentId)}`;
      return {
        ok: true,
        profile,
        previewUrl,
        ipcUrl: `http://127.0.0.1:${config.port}/ipc`,
      };
    }

    case "profiles":
      return { ok: true, profiles: registry.getAll() };

    case "profile": {
      const agentId = (args as { agentId?: string })?.agentId;
      if (!agentId) throw new Error("agentId required");
      const profile = registry.get(agentId);
      return profile ? { ok: true, profile } : { ok: false, error: "not found" };
    }

    case "world-move": {
      const a = args as { agentId: string; x: number; y: number; z: number; rotation?: number };
      if (!a?.agentId) throw new Error("agentId required");
      const x = Number(a.x ?? 0);
      const y = Number(a.y ?? 0);
      const z = Number(a.z ?? 0);
      const rotation = Number(a.rotation ?? 0);
      if (!isFinite(x) || !isFinite(y) || !isFinite(z) || !isFinite(rotation)) {
        throw new Error("x, y, z, rotation must be finite numbers");
      }
      const msg: WorldMessage = {
        worldType: "position",
        agentId: a.agentId,
        x,
        y,
        z,
        rotation,
        timestamp: Date.now(),
      };
      const result = commandQueue.enqueue(msg);
      if (!result.ok) return { ok: false, error: result.reason };
      return { ok: true };
    }

    case "world-action": {
      const a = args as { agentId: string; action: string; targetAgentId?: string };
      if (!a?.agentId) throw new Error("agentId required");
      const msg: WorldMessage = {
        worldType: "action",
        agentId: a.agentId,
        action: (a.action ?? "idle") as "walk" | "idle" | "wave" | "pinch" | "talk" | "dance" | "backflip" | "spin",
        targetAgentId: a.targetAgentId,
        timestamp: Date.now(),
      };
      commandQueue.enqueue(msg);
      return { ok: true };
    }

    case "world-chat": {
      const a = args as { agentId: string; text: string };
      if (!a?.agentId || !a?.text) throw new Error("agentId and text required");
      const msg: WorldMessage = {
        worldType: "chat",
        agentId: a.agentId,
        text: a.text.slice(0, 500),
        timestamp: Date.now(),
      };
      commandQueue.enqueue(msg);
      return { ok: true };
    }

    case "world-emote": {
      const a = args as { agentId: string; emote: string };
      if (!a?.agentId) throw new Error("agentId required");
      const msg: WorldMessage = {
        worldType: "emote",
        agentId: a.agentId,
        emote: (a.emote ?? "happy") as "happy" | "thinking" | "surprised" | "laugh",
        timestamp: Date.now(),
      };
      commandQueue.enqueue(msg);
      return { ok: true };
    }

    case "world-leave": {
      const a = args as { agentId: string };
      if (!a?.agentId) throw new Error("agentId required");
      const msg: WorldMessage = {
        worldType: "leave",
        agentId: a.agentId,
        timestamp: Date.now(),
      };
      commandQueue.enqueue(msg);
      return { ok: true };
    }

    // ── Clawhub IPC commands ──────────────────────────────────
    case "clawhub-list":
      return { ok: true, skills: clawhub.list() };

    case "clawhub-publish": {
      const a = args as {
        id?: string; name?: string; description?: string;
        author?: string; version?: string; tags?: string[];
      };
      if (!a?.id || !a?.name) throw new Error("id and name required");
      const skill = clawhub.publish({
        id: a.id,
        name: a.name,
        description: a.description ?? "",
        author: a.author ?? "unknown",
        version: a.version ?? "0.1.0",
        tags: a.tags ?? [],
      });
      return { ok: true, skill };
    }

    case "clawhub-install": {
      const a = args as { skillId?: string };
      if (!a?.skillId) throw new Error("skillId required");
      const record = clawhub.install(a.skillId);
      if (!record) throw new Error("skill not found");
      return { ok: true, installed: record };
    }

    case "clawhub-uninstall": {
      const a = args as { skillId?: string };
      if (!a?.skillId) throw new Error("skillId required");
      const ok = clawhub.uninstall(a.skillId);
      return { ok };
    }

    // ── Room management IPC commands ────────────────────────
    case "room-info":
      return { ok: true, ...getRoomInfo() };

    case "room-events": {
      const a = args as { since?: number; limit?: number };
      const since = Number(a?.since ?? 0);
      const limit = Math.min(Number(a?.limit ?? 50), 200);
      return { ok: true, events: state.getEvents(since, limit) };
    }

    case "room-invite": {
      const info = getRoomInfo();
      return {
        ok: true,
        invite: {
          roomId: info.roomId,
          name: info.name,
          relays: nostr.getRelays(),
          channelId: nostr.getChannelId(),
          agents: info.agents,
          maxAgents: info.maxAgents,
        },
      };
    }

    case "room-skills": {
      const allProfiles = registry.getAll();
      const directory: Record<string, { agentId: string; agentName: string; skill: AgentSkillDeclaration }[]> = {};
      for (const p of allProfiles) {
        for (const skill of p.skills ?? []) {
          if (!directory[skill.skillId]) directory[skill.skillId] = [];
          directory[skill.skillId].push({ agentId: p.agentId, agentName: p.name, skill });
        }
      }
      return { ok: true, directory };
    }

    case "describe": {
      const skillPath = resolve(import.meta.dirname, "../skills/world-room/skill.json");
      const schema = JSON.parse(readFileSync(skillPath, "utf-8"));
      return { ok: true, skill: schema };
    }

    case "open-preview": {
      const a = args as { agentId?: string };
      const vitePort = process.env.VITE_PORT ?? "3000";
      const serverUrl = `http://127.0.0.1:${config.port}`;
      const url = a?.agentId
        ? `http://localhost:${vitePort}/?agent=${encodeURIComponent(a.agentId)}&server=${encodeURIComponent(serverUrl)}`
        : `http://localhost:${vitePort}/?server=${encodeURIComponent(serverUrl)}`;

      const { execFile } = await import("node:child_process");
      const cmd = process.platform === "darwin" ? "open"
        : process.platform === "win32" ? "start"
        : "xdg-open";
      execFile(cmd, [url], (err) => {
        if (err) console.warn("[server] Failed to open browser:", err.message);
      });

      return { ok: true, url };
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// ── Startup ────────────────────────────────────────────────────

async function main() {
  console.log("🦞 OpenClaw Ocean World starting...");
  console.log(`[room] Room ID: ${config.roomId} | Name: "${config.roomName}"`);
  if (config.roomDescription) {
    console.log(`[room] Description: ${config.roomDescription}`);
  }
  console.log(`[room] Max agents: ${config.maxAgents} | Bind: ${config.host}:${config.port}`);
  console.log(`[engine] Tick rate: ${TICK_RATE}Hz | AOI radius: 40 units`);

  await nostr.init().catch((err) => {
    console.warn("[nostr] Init warning:", err.message ?? err);
    console.warn("[nostr] Running in local-only mode (no relay connection)");
  });

  server.listen(config.port, config.host, () => {
    console.log(`[server] IPC + WS listening on http://${config.host}:${config.port}`);
    console.log(`[server] Share Room ID "${config.roomId}" for others to join via Nostr`);
  });

  gameLoop.start();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  gameLoop.stop();
  nostr.close();
  server.close();
  process.exit(0);
});
