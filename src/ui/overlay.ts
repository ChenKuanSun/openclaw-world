import type { AgentProfile } from "../../server/types.js";

interface OverlayAPI {
  updateAgentList(profiles: AgentProfile[]): void;
  addAgent(profile: AgentProfile): void;
  removeAgent(agentId: string): void;
  updateAgent(profile: AgentProfile): void;
  getAgent(agentId: string): AgentProfile | undefined;
}

/**
 * HUD overlay: connection status + scrollable agent list (top-right).
 * Shows ALL agents globally regardless of proximity.
 */
export function setupOverlay(): OverlayAPI {
  const container = document.getElementById("overlay")!;
  const agents = new Map<string, AgentProfile>();

  // Build DOM safely
  const header = document.createElement("div");
  header.className = "overlay-header";

  const dotEl = document.createElement("span");
  dotEl.className = "overlay-dot";
  header.appendChild(dotEl);

  const titleEl = document.createElement("span");
  titleEl.className = "overlay-title";
  titleEl.textContent = "OpenClaw Ocean World";
  header.appendChild(titleEl);

  const toggleEl = document.createElement("span");
  toggleEl.className = "overlay-toggle";
  toggleEl.textContent = "▾";
  header.appendChild(toggleEl);

  const countEl = document.createElement("div");
  countEl.className = "overlay-count";
  countEl.textContent = "0 agents online";

  const listEl = document.createElement("div");
  listEl.className = "overlay-list";

  container.appendChild(header);
  container.appendChild(countEl);
  container.appendChild(listEl);

  // Collapse / expand on header click
  let collapsed = false;
  header.style.cursor = "pointer";
  header.addEventListener("click", () => {
    collapsed = !collapsed;
    listEl.style.display = collapsed ? "none" : "";
    countEl.style.display = collapsed ? "none" : "";
    toggleEl.textContent = collapsed ? "▸" : "▾";
    container.classList.toggle("collapsed", collapsed);
  });

  // Connection status via custom events
  window.addEventListener("ws:connected", () => {
    dotEl.classList.add("connected");
    dotEl.classList.remove("disconnected");
  });
  window.addEventListener("ws:disconnected", () => {
    dotEl.classList.remove("connected");
    dotEl.classList.add("disconnected");
  });

  function render(): void {
    const sorted = Array.from(agents.values()).sort(
      (a, b) => b.lastSeen - a.lastSeen
    );
    countEl.textContent = `${sorted.length} agent${sorted.length !== 1 ? "s" : ""} online`;

    // Clear and rebuild list using safe DOM methods
    listEl.textContent = "";

    for (const a of sorted) {
      const item = document.createElement("div");
      item.className = "agent-item";
      item.dataset.agentId = a.agentId;

      const colorDot = document.createElement("span");
      colorDot.className = "agent-color";
      colorDot.style.background = a.color;
      item.appendChild(colorDot);

      const nameSpan = document.createElement("span");
      nameSpan.className = "agent-name";
      nameSpan.textContent = a.name;
      item.appendChild(nameSpan);

      const capsSpan = document.createElement("span");
      capsSpan.className = "agent-caps";
      capsSpan.textContent = a.capabilities.slice(0, 3).join(", ");
      item.appendChild(capsSpan);

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("agent:select", { detail: { agentId: a.agentId } })
        );
        // Highlight followed agent
        for (const el of listEl.children) {
          (el as HTMLElement).classList.remove("following");
        }
        item.classList.toggle("following");
      });

      listEl.appendChild(item);
    }
  }

  return {
    updateAgentList(profiles: AgentProfile[]) {
      agents.clear();
      for (const p of profiles) agents.set(p.agentId, p);
      render();
    },
    addAgent(profile: AgentProfile) {
      agents.set(profile.agentId, profile);
      render();
    },
    removeAgent(agentId: string) {
      agents.delete(agentId);
      render();
    },
    updateAgent(profile: AgentProfile) {
      agents.set(profile.agentId, profile);
      render();
    },
    getAgent(agentId: string) {
      return agents.get(agentId);
    },
  };
}
