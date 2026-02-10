/**
 * Interactive popup panels for buildings in the world.
 * - Moltbook: embedded moltbook.com (the social network for AI agents)
 * - Clawhub: skill marketplace from clawhub.ai
 */

interface BuildingPanelAPI {
  showMoltbook(): void;
  showClawhub(): void;
  showWorlds(): void;
  hide(): void;
  isVisible(): boolean;
}

interface WorldServerEntry {
  roomId: string;
  name: string;
  publicUrl: string | null;
  agents: number;
  maxAgents: number;
  publishedAt: number;
}

export function setupBuildingPanel(serverUrl?: string | null): BuildingPanelAPI {
  const apiBase = serverUrl ?? "";
  const overlay = document.createElement("div");
  overlay.id = "building-overlay";
  overlay.className = "building-overlay";
  document.body.appendChild(overlay);

  const panel = document.createElement("div");
  panel.className = "building-panel";
  overlay.appendChild(panel);

  let visible = false;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hide();
  });

  function handleEscapeKey(e: KeyboardEvent): void {
    if (e.key === "Escape" && visible) hide();
  }

  function hide(): void {
    overlay.classList.remove("visible");
    visible = false;
    window.removeEventListener("keydown", handleEscapeKey);
  }

  function show(): void {
    overlay.classList.add("visible");
    visible = true;
    window.addEventListener("keydown", handleEscapeKey);
  }

  // ── Moltbook (feed from moltbook.com via server proxy) ────

  interface MoltbookPost {
    id?: string;
    title?: string;
    content?: string;
    agent_name?: string;
    agent_display_name?: string;
    upvotes?: number;
    comment_count?: number;
    created_at?: string;
    // Accept any shape from the API
    [key: string]: unknown;
  }

  function showMoltbook(): void {
    panel.textContent = "";
    panel.className = "building-panel moltbook-panel";

    // Header
    const header = document.createElement("div");
    header.className = "bp-header";

    const title = document.createElement("h2");
    title.textContent = "Moltbook";
    header.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "bp-subtitle";
    subtitle.textContent = "The front page of the agent internet \u2014 AI agents share, discuss, and upvote";
    header.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "bp-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", hide);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Post list
    const list = document.createElement("div");
    list.className = "moltbook-list";
    const loading = document.createElement("div");
    loading.className = "bp-loading";
    loading.textContent = "Loading feed from moltbook.com...";
    list.appendChild(loading);
    panel.appendChild(list);

    function createPostCard(post: MoltbookPost): HTMLElement {
      const card = document.createElement("div");
      card.className = "moltbook-card";
      card.style.cursor = "pointer";
      if (post.id) {
        card.addEventListener("click", () => {
          window.open(`https://www.moltbook.com/post/${post.id}`, "_blank", "noopener");
        });
      }

      const cardTitle = document.createElement("div");
      cardTitle.className = "moltbook-card-title";
      cardTitle.textContent = post.title || post.content?.slice(0, 80) || "Untitled";
      card.appendChild(cardTitle);

      if (post.content && post.title) {
        const content = document.createElement("p");
        content.className = "moltbook-card-content";
        content.textContent = post.content.slice(0, 200);
        card.appendChild(content);
      }

      const meta = document.createElement("div");
      meta.className = "moltbook-card-meta";
      const parts: string[] = [];
      const name = post.agent_display_name || post.agent_name;
      if (name) parts.push(`by ${name}`);
      if (post.upvotes != null) parts.push(`\u2b06 ${post.upvotes}`);
      if (post.comment_count != null) parts.push(`\ud83d\udcac ${post.comment_count}`);
      meta.textContent = parts.join(" \u00b7 ");
      card.appendChild(meta);

      return card;
    }

    async function loadFeed(): Promise<void> {
      list.textContent = "";
      try {
        const res = await fetch(`${apiBase}/api/moltbook/feed`);
        const data = (await res.json()) as { ok: boolean; posts: MoltbookPost[] | MoltbookPost; error?: string };
        if (!data.ok) {
          throw new Error(data.error || "Failed to load");
        }

        const posts = Array.isArray(data.posts) ? data.posts : [data.posts];
        if (posts.length === 0) {
          const empty = document.createElement("div");
          empty.className = "bp-empty";
          empty.textContent = "No posts available. Set MOLTBOOK_API_KEY to fetch from moltbook.com.";
          list.appendChild(empty);
          return;
        }

        for (const post of posts.slice(0, 20)) {
          list.appendChild(createPostCard(post));
        }
      } catch {
        const err = document.createElement("div");
        err.className = "bp-error";
        err.textContent = "Could not load Moltbook feed. Check server logs.";
        list.appendChild(err);

        const hint = document.createElement("div");
        hint.className = "bp-empty";
        hint.textContent = "Tip: Set MOLTBOOK_API_KEY env var to enable the feed proxy.";
        list.appendChild(hint);
      }
    }

    // Footer link
    const footer = document.createElement("div");
    footer.className = "clawhub-footer";
    const link = document.createElement("a");
    link.href = "https://www.moltbook.com";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open moltbook.com in new tab";
    link.style.color = "#4fc3f7";
    footer.appendChild(link);
    panel.appendChild(footer);

    loadFeed();
    show();
  }

  // ── Clawhub (clawhub.ai marketplace) ─────────────────────

  /** ClawHub API response item */
  interface ClawHubSkill {
    slug: string;
    displayName: string;
    summary: string;
    owner?: { handle: string; displayName?: string };
    latestVersion?: { version: string };
    tags?: string[];
    stats?: { downloads?: number; stars?: number };
  }

  function showClawhub(): void {
    panel.textContent = "";
    panel.className = "building-panel clawhub-panel";

    // Header
    const header = document.createElement("div");
    header.className = "bp-header";

    const title = document.createElement("h2");
    title.textContent = "ClawHub";
    header.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "bp-subtitle";
    subtitle.textContent = "Browse Skills & Plugins from the OpenClaw marketplace";
    header.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "bp-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", hide);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Search bar
    const searchBar = document.createElement("div");
    searchBar.className = "clawhub-search";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search skills on clawhub.ai...";
    searchInput.className = "clawhub-search-input";
    searchBar.appendChild(searchInput);
    panel.appendChild(searchBar);

    // Sort selector
    const sortBar = document.createElement("div");
    sortBar.className = "clawhub-sort";
    for (const opt of ["trending", "downloads", "updated", "stars"] as const) {
      const btn = document.createElement("button");
      btn.className = "clawhub-sort-btn" + (opt === "trending" ? " active" : "");
      btn.textContent = opt;
      btn.addEventListener("click", () => {
        sortBar.querySelectorAll(".clawhub-sort-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        loadSkills(opt, "");
      });
      sortBar.appendChild(btn);
    }
    panel.appendChild(sortBar);

    // Skill list
    const list = document.createElement("div");
    list.className = "clawhub-list";
    const loading = document.createElement("div");
    loading.className = "bp-loading";
    loading.textContent = "Loading skills from clawhub.ai...";
    list.appendChild(loading);
    panel.appendChild(list);

    function createSkillCard(skill: ClawHubSkill): HTMLElement {
      const card = document.createElement("div");
      card.className = "clawhub-card";
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        window.open(`https://clawhub.ai/skills/${skill.slug}`, "_blank", "noopener");
      });

      const cardHeader = document.createElement("div");
      cardHeader.className = "clawhub-card-header";

      const nameEl = document.createElement("span");
      nameEl.className = "clawhub-card-name";
      nameEl.textContent = skill.displayName || skill.slug;
      cardHeader.appendChild(nameEl);

      if (skill.latestVersion?.version) {
        const versionEl = document.createElement("span");
        versionEl.className = "clawhub-card-version";
        versionEl.textContent = `v${skill.latestVersion.version}`;
        cardHeader.appendChild(versionEl);
      }

      card.appendChild(cardHeader);

      if (skill.summary) {
        const descEl = document.createElement("p");
        descEl.className = "clawhub-card-desc";
        descEl.textContent = skill.summary;
        card.appendChild(descEl);
      }

      const footer = document.createElement("div");
      footer.className = "clawhub-card-footer";

      if (skill.tags && skill.tags.length > 0) {
        const tagsEl = document.createElement("div");
        tagsEl.className = "clawhub-card-tags";
        for (const tag of skill.tags.slice(0, 4)) {
          const tagEl = document.createElement("span");
          tagEl.className = "clawhub-tag";
          tagEl.textContent = tag;
          tagsEl.appendChild(tagEl);
        }
        footer.appendChild(tagsEl);
      }

      if (skill.stats) {
        const statsEl = document.createElement("span");
        statsEl.className = "clawhub-card-version";
        const parts: string[] = [];
        if (skill.stats.downloads) parts.push(`${skill.stats.downloads} installs`);
        if (skill.stats.stars) parts.push(`${skill.stats.stars} stars`);
        statsEl.textContent = parts.join(" \u00b7 ");
        footer.appendChild(statsEl);
      }

      card.appendChild(footer);

      if (skill.owner) {
        const authorEl = document.createElement("div");
        authorEl.className = "clawhub-card-author";
        authorEl.textContent = `by ${skill.owner.displayName || skill.owner.handle}`;
        card.appendChild(authorEl);
      }

      return card;
    }

    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadSkills(sort = "trending", query = ""): Promise<void> {
      list.textContent = "";
      const loadingEl = document.createElement("div");
      loadingEl.className = "bp-loading";
      loadingEl.textContent = "Loading...";
      list.appendChild(loadingEl);

      try {
        const params = new URLSearchParams({ sort, limit: "50" });
        if (query) params.set("q", query);
        const proxyUrl = `${apiBase}/api/clawhub/browse?${params}`;

        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { ok: boolean; data: { items?: ClawHubSkill[] } | ClawHubSkill[]; error?: string };
        if (!json.ok) throw new Error(json.error || "Failed to load");

        const raw = json.data;
        const items = Array.isArray(raw) ? raw : (raw.items ?? []);
        list.textContent = "";

        if (items.length === 0) {
          const empty = document.createElement("div");
          empty.className = "bp-empty";
          empty.textContent = query ? "No skills match your search." : "No skills available.";
          list.appendChild(empty);
          return;
        }

        for (const skill of items) {
          list.appendChild(createSkillCard(skill));
        }
      } catch {
        list.textContent = "";
        const err = document.createElement("div");
        err.className = "bp-error";
        err.textContent = "Could not load skills from clawhub.ai.";
        list.appendChild(err);
      }
    }

    searchInput.addEventListener("input", () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = searchInput.value.trim();
        const activeSort = sortBar.querySelector(".active")?.textContent ?? "trending";
        loadSkills(activeSort, q);
      }, 400);
    });

    // Footer link
    const footerEl = document.createElement("div");
    footerEl.className = "clawhub-footer";
    const footerLink = document.createElement("a");
    footerLink.href = "https://clawhub.ai";
    footerLink.target = "_blank";
    footerLink.rel = "noopener";
    footerLink.textContent = "Browse all 5700+ skills on clawhub.ai";
    footerLink.style.color = "#4fc3f7";
    footerEl.appendChild(footerLink);
    panel.appendChild(footerEl);

    loadSkills("trending", "");
    show();
  }

  // ── Worlds Portal ──────────────────────────────────────────

  function showWorlds(): void {
    panel.textContent = "";
    panel.className = "building-panel worlds-panel";

    // Header
    const header = document.createElement("div");
    header.className = "bp-header";

    const title = document.createElement("h2");
    title.textContent = "Worlds Portal";
    header.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "bp-subtitle";
    subtitle.textContent = "Join other rooms via Room ID or discover public worlds";
    header.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "bp-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", hide);
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Join by Room ID section
    const joinSection = document.createElement("div");
    joinSection.className = "worlds-join-section";

    const joinLabel = document.createElement("div");
    joinLabel.className = "worlds-join-label";
    joinLabel.textContent = "Join by Room ID";
    joinSection.appendChild(joinLabel);

    const joinDesc = document.createElement("div");
    joinDesc.style.fontSize = "10px";
    joinDesc.style.color = "#95a5a6";
    joinDesc.style.marginBottom = "8px";
    joinDesc.textContent = "Enter a Room ID to connect via Nostr relay (no direct connection needed)";
    joinSection.appendChild(joinDesc);

    const joinRow = document.createElement("div");
    joinRow.className = "worlds-join-row";

    const roomIdInput = document.createElement("input");
    roomIdInput.type = "text";
    roomIdInput.placeholder = "Room ID (e.g. V1StGXR8_Z5j)";
    roomIdInput.className = "clawhub-search-input";
    roomIdInput.maxLength = 20;
    joinRow.appendChild(roomIdInput);

    const joinBtn = document.createElement("button");
    joinBtn.className = "clawhub-btn";
    joinBtn.textContent = "Join";
    joinBtn.addEventListener("click", () => {
      const roomId = roomIdInput.value.trim();
      if (roomId) {
        window.location.href = `${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
      }
    });
    joinRow.appendChild(joinBtn);

    roomIdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") joinBtn.click();
    });

    joinSection.appendChild(joinRow);

    // Or join by direct server URL
    const urlLabel = document.createElement("div");
    urlLabel.className = "worlds-join-label";
    urlLabel.style.marginTop = "12px";
    urlLabel.textContent = "Or join by server URL";
    joinSection.appendChild(urlLabel);

    const urlRow = document.createElement("div");
    urlRow.className = "worlds-join-row";

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.placeholder = "http://server-address:18800";
    urlInput.className = "clawhub-search-input";
    urlRow.appendChild(urlInput);

    const urlJoinBtn = document.createElement("button");
    urlJoinBtn.className = "clawhub-btn";
    urlJoinBtn.textContent = "Join";
    urlJoinBtn.addEventListener("click", () => {
      const url = urlInput.value.trim();
      if (url) {
        window.location.href = `${window.location.pathname}?server=${encodeURIComponent(url.replace(/\/+$/, ""))}`;
      }
    });
    urlRow.appendChild(urlJoinBtn);

    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") urlJoinBtn.click();
    });

    joinSection.appendChild(urlRow);
    panel.appendChild(joinSection);

    // Discovered worlds list
    const listHeader = document.createElement("div");
    listHeader.className = "worlds-list-header";
    listHeader.textContent = "Public Worlds";
    panel.appendChild(listHeader);

    const list = document.createElement("div");
    list.className = "clawhub-list";
    const loading = document.createElement("div");
    loading.className = "bp-loading";
    loading.textContent = "Searching for worlds...";
    list.appendChild(loading);
    panel.appendChild(list);

    async function loadWorlds(): Promise<void> {
      list.textContent = "";
      try {
        const res = await fetch(`${apiBase}/api/worlds`);
        const data = (await res.json()) as { ok: boolean; worlds: WorldServerEntry[] };

        if (!data.ok || data.worlds.length === 0) {
          const empty = document.createElement("div");
          empty.className = "bp-empty";
          empty.textContent = "No public worlds found. Try joining by URL.";
          list.appendChild(empty);
          return;
        }

        for (const world of data.worlds) {
          const card = document.createElement("div");
          card.className = "clawhub-card";
          if (world.publicUrl) card.style.cursor = "pointer";

          const cardHeader = document.createElement("div");
          cardHeader.className = "clawhub-card-header";

          const nameEl = document.createElement("span");
          nameEl.className = "clawhub-card-name";
          nameEl.textContent = world.name;
          cardHeader.appendChild(nameEl);

          const countEl = document.createElement("span");
          countEl.className = "clawhub-card-version";
          countEl.textContent = `${world.agents}/${world.maxAgents}`;
          cardHeader.appendChild(countEl);

          card.appendChild(cardHeader);

          if (world.publicUrl) {
            const urlEl = document.createElement("p");
            urlEl.className = "clawhub-card-desc";
            urlEl.textContent = world.publicUrl;
            card.appendChild(urlEl);

            card.addEventListener("click", () => {
              window.location.href = `${window.location.pathname}?server=${encodeURIComponent(world.publicUrl!.replace(/\/+$/, ""))}`;
            });
          } else {
            const noUrl = document.createElement("p");
            noUrl.className = "clawhub-card-desc";
            noUrl.textContent = "No public URL available";
            card.appendChild(noUrl);
          }

          list.appendChild(card);
        }
      } catch {
        list.textContent = "";
        const err = document.createElement("div");
        err.className = "bp-error";
        err.textContent = "Could not fetch worlds. Is the server running?";
        list.appendChild(err);
      }
    }

    loadWorlds();
    show();
  }

  return {
    showMoltbook,
    showClawhub,
    showWorlds,
    hide,
    isVisible: () => visible,
  };
}
