import type { AgentProfile } from "../../server/types.js";

interface ProfilePanelAPI {
  show(profile: AgentProfile): void;
  hide(): void;
}

/**
 * Slide-in profile panel (right side).
 * Click a lobster → shows agent details.
 */
export function setupProfilePanel(
  onFocusAgent: (agentId: string) => void
): ProfilePanelAPI {
  const container = document.getElementById("profile-panel")!;
  let currentProfile: AgentProfile | null = null;

  function render(profile: AgentProfile): void {
    // Clear previous content safely
    container.textContent = "";

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "profile-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", () => hide());
    container.appendChild(closeBtn);

    // Color swatch + name
    const headerEl = document.createElement("div");
    headerEl.className = "profile-header";

    const swatchEl = document.createElement("div");
    swatchEl.className = "profile-swatch";
    swatchEl.style.background = profile.color;
    headerEl.appendChild(swatchEl);

    const nameEl = document.createElement("h2");
    nameEl.className = "profile-name";
    nameEl.textContent = profile.name;
    headerEl.appendChild(nameEl);

    container.appendChild(headerEl);

    // Agent ID
    const idEl = document.createElement("div");
    idEl.className = "profile-id";
    idEl.textContent = `ID: ${profile.agentId}`;
    container.appendChild(idEl);

    // Pubkey (truncated)
    if (profile.pubkey) {
      const pkEl = document.createElement("div");
      pkEl.className = "profile-pubkey";
      pkEl.textContent = `Pubkey: ${profile.pubkey.slice(0, 16)}...`;
      container.appendChild(pkEl);
    }

    // Bio
    if (profile.bio) {
      const bioLabel = document.createElement("div");
      bioLabel.className = "profile-label";
      bioLabel.textContent = "Bio";
      container.appendChild(bioLabel);

      const bioEl = document.createElement("p");
      bioEl.className = "profile-bio";
      bioEl.textContent = profile.bio;
      container.appendChild(bioEl);
    }

    // Capabilities
    if (profile.capabilities.length > 0) {
      const capLabel = document.createElement("div");
      capLabel.className = "profile-label";
      capLabel.textContent = "Capabilities";
      container.appendChild(capLabel);

      const capsEl = document.createElement("div");
      capsEl.className = "profile-caps";
      for (const cap of profile.capabilities) {
        const tag = document.createElement("span");
        tag.className = "cap-tag";
        tag.textContent = cap;
        capsEl.appendChild(tag);
      }
      container.appendChild(capsEl);
    }

    // Timestamps
    const timeEl = document.createElement("div");
    timeEl.className = "profile-times";
    timeEl.textContent = `Joined: ${new Date(profile.joinedAt).toLocaleDateString()} · Last seen: ${new Date(profile.lastSeen).toLocaleTimeString()}`;
    container.appendChild(timeEl);

    // Focus button
    const focusBtn = document.createElement("button");
    focusBtn.className = "profile-focus-btn";
    focusBtn.textContent = "Focus Camera";
    focusBtn.addEventListener("click", () => onFocusAgent(profile.agentId));
    container.appendChild(focusBtn);

    container.classList.add("visible");
    window.addEventListener("keydown", handleEscapeKey);
  }

  function handleEscapeKey(e: KeyboardEvent): void {
    if (e.key === "Escape") hide();
  }

  function hide(): void {
    container.classList.remove("visible");
    currentProfile = null;
    window.removeEventListener("keydown", handleEscapeKey);
  }

  // Listen for overlay agent:select events
  window.addEventListener("agent:select", ((e: CustomEvent) => {
    const agentId = e.detail?.agentId;
    if (agentId) onFocusAgent(agentId);
  }) as EventListener);

  return {
    show(profile: AgentProfile) {
      currentProfile = profile;
      render(profile);
    },
    hide,
  };
}
