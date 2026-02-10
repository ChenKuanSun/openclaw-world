import { describe, it, expect, beforeEach, vi } from "vitest";
import { ClawhubStore } from "../clawhub-store.js";

// Mock fs to control what scanPlugins sees
vi.mock("node:fs", () => {
  const actualFs: Record<string, unknown> = {};
  return {
    existsSync: vi.fn((path: string) => {
      // installed path: false (no pre-installed skills)
      if (path.includes("clawhub-installed")) return false;
      // ~/.openclaw exists
      if (path.endsWith(".openclaw")) return true;
      // plugin manifest
      if (path.endsWith("openclaw.plugin.json")) return path.includes("test-plugin");
      // SKILL.md
      if (path.endsWith("SKILL.md")) return path.includes("test-plugin");
      return false;
    }),
    readFileSync: vi.fn((path: string) => {
      if (path.endsWith("openclaw.plugin.json")) {
        return JSON.stringify({
          name: "test-plugin",
          version: "1.0.0",
          description: "A test plugin",
          skills: ["skills/test-skill"],
        });
      }
      if (path.endsWith("SKILL.md")) {
        return "---\nname: test-skill\ndescription: A test skill for testing\n---\n\n# Test Skill\n";
      }
      return "[]";
    }),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn((path: string) => {
      if (path.endsWith(".openclaw")) return ["test-plugin", "not-a-plugin"];
      return [];
    }),
    statSync: vi.fn(() => ({ isDirectory: () => true })),
  };
});

describe("ClawhubStore", () => {
  let store: ClawhubStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ClawhubStore();
  });

  it("scans plugins from ~/.openclaw", () => {
    const list = store.list();
    // Should find test-plugin and its skill
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("finds plugin entry", () => {
    const list = store.list();
    const plugin = list.find((s) => s.id === "test-plugin");
    expect(plugin).toBeDefined();
    expect(plugin!.name).toBe("test-plugin");
    expect(plugin!.description).toBe("A test plugin");
    expect(plugin!.source).toBe("local");
    expect(plugin!.tags).toContain("plugin");
  });

  it("finds skill entry from SKILL.md frontmatter", () => {
    const list = store.list();
    const skill = list.find((s) => s.id === "test-plugin/test-skill");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("test-skill");
    expect(skill!.description).toBe("A test skill for testing");
    expect(skill!.pluginName).toBe("test-plugin");
  });

  it("publishes a new skill", () => {
    const entry = store.publish({
      id: "new-skill",
      name: "New Skill",
      description: "Freshly published",
      author: "tester",
      version: "0.1.0",
      tags: ["test"],
    });
    expect(entry.id).toBe("new-skill");
    expect(entry.source).toBe("registry");

    const list = store.list();
    const found = list.find((s) => s.id === "new-skill");
    expect(found).toBeDefined();
  });

  it("updates existing skill on re-publish", () => {
    store.publish({
      id: "upd-skill",
      name: "V1",
      description: "First",
      author: "a",
      version: "1.0",
      tags: [],
    });
    store.publish({
      id: "upd-skill",
      name: "V2",
      description: "Second",
      author: "a",
      version: "2.0",
      tags: [],
    });
    const list = store.list();
    const matches = list.filter((s) => s.id === "upd-skill");
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("V2");
  });

  it("installs and uninstalls a skill", () => {
    store.publish({
      id: "inst-skill",
      name: "Installable",
      description: "Can install",
      author: "a",
      version: "1.0",
      tags: [],
    });

    const installed = store.install("inst-skill");
    expect(installed).not.toBeNull();
    expect(installed!.skillId).toBe("inst-skill");

    const list = store.list();
    const skill = list.find((s) => s.id === "inst-skill");
    expect(skill!.installed).toBe(true);

    const removed = store.uninstall("inst-skill");
    expect(removed).toBe(true);

    const listAfter = store.list();
    const skillAfter = listAfter.find((s) => s.id === "inst-skill");
    expect(skillAfter!.installed).toBe(false);
  });

  it("returns null when installing unknown skill", () => {
    expect(store.install("no-such-skill")).toBeNull();
  });

  it("returns false when uninstalling non-installed skill", () => {
    expect(store.uninstall("no-such-skill")).toBe(false);
  });

  it("truncates long publish inputs", () => {
    const entry = store.publish({
      id: "x".repeat(100),
      name: "n".repeat(200),
      description: "d".repeat(1000),
      author: "a".repeat(100),
      version: "v".repeat(50),
      tags: Array(20).fill("tag"),
    });
    expect(entry.id.length).toBeLessThanOrEqual(50);
    expect(entry.name.length).toBeLessThanOrEqual(100);
    expect(entry.description.length).toBeLessThanOrEqual(500);
    expect(entry.author.length).toBeLessThanOrEqual(50);
    expect(entry.version.length).toBeLessThanOrEqual(20);
    expect(entry.tags.length).toBeLessThanOrEqual(10);
  });
});
