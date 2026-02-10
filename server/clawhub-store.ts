import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

export interface SkillSchema {
  name: string;
  version: string;
  description: string;
  ipc?: { transport: string; endpoint: string; defaultPort: number };
  commands?: Record<string, unknown>;
}

export interface SkillEntry {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  publishedAt: number;
  source: "local" | "registry";
  pluginName?: string;
  schema?: SkillSchema;
}

export interface InstalledSkill {
  skillId: string;
  version: string;
  installedAt: number;
}

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  skills?: string[];
}

interface SkillFrontmatter {
  name: string;
  description: string;
}

const INSTALLED_PATH = resolve(process.cwd(), "clawhub-installed.json");
const OPENCLAW_DIR = resolve(homedir(), ".openclaw");

export class ClawhubStore {
  private catalog: SkillEntry[] = [];
  private installed: InstalledSkill[] = [];

  constructor() {
    this.loadInstalled();
    this.scanPlugins();
  }

  /** Scan ~/.openclaw/ for installed plugins and their skills */
  scanPlugins(): void {
    this.catalog = [];

    if (!existsSync(OPENCLAW_DIR)) return;

    const entries = readdirSync(OPENCLAW_DIR);
    for (const entry of entries) {
      const entryPath = join(OPENCLAW_DIR, entry);
      if (!statSync(entryPath).isDirectory()) continue;

      // Check for openclaw.plugin.json in the directory or plugin/ subdirectory
      const manifestPaths = [
        join(entryPath, "openclaw.plugin.json"),
        join(entryPath, "plugin", "openclaw.plugin.json"),
      ];

      for (const manifestPath of manifestPaths) {
        if (existsSync(manifestPath)) {
          this.loadPlugin(manifestPath, entry);
          break;
        }
      }
    }
  }

  private loadPlugin(manifestPath: string, dirName: string): void {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as PluginManifest;
      const pluginDir = resolve(manifestPath, "..");

      // Add the plugin itself as a skill entry
      this.catalog.push({
        id: manifest.name,
        name: manifest.name,
        description: manifest.description ?? "",
        author: "openclaw",
        version: manifest.version ?? "0.0.0",
        tags: ["plugin"],
        publishedAt: Date.now(),
        source: "local",
        pluginName: manifest.name,
      });

      // Load each skill defined in the manifest
      if (manifest.skills) {
        for (const skillPath of manifest.skills) {
          const skillDir = resolve(pluginDir, skillPath);
          const skillMdPath = join(skillDir, "SKILL.md");
          const skillJsonPath = join(skillDir, "skill.json");

          // Try skill.json first for machine-readable schema
          let schema: SkillSchema | undefined;
          if (existsSync(skillJsonPath)) {
            try {
              schema = JSON.parse(readFileSync(skillJsonPath, "utf-8")) as SkillSchema;
            } catch {
              // Malformed skill.json, fall through to SKILL.md
            }
          }

          if (schema) {
            this.catalog.push({
              id: `${manifest.name}/${schema.name}`,
              name: schema.name,
              description: schema.description ?? "",
              author: "openclaw",
              version: schema.version ?? manifest.version ?? "0.0.0",
              tags: ["skill", manifest.name],
              publishedAt: Date.now(),
              source: "local",
              pluginName: manifest.name,
              schema,
            });
          } else if (existsSync(skillMdPath)) {
            const frontmatter = this.parseSkillFrontmatter(skillMdPath);
            if (frontmatter) {
              this.catalog.push({
                id: `${manifest.name}/${frontmatter.name}`,
                name: frontmatter.name,
                description: frontmatter.description,
                author: "openclaw",
                version: manifest.version ?? "0.0.0",
                tags: ["skill", manifest.name],
                publishedAt: Date.now(),
                source: "local",
                pluginName: manifest.name,
              });
            }
          }
        }
      }
    } catch {
      // Skip malformed plugins
    }
  }

  private parseSkillFrontmatter(mdPath: string): SkillFrontmatter | null {
    try {
      const content = readFileSync(mdPath, "utf-8");
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return null;

      const frontmatter = match[1];
      let name = "";
      let description = "";

      for (const line of frontmatter.split("\n")) {
        const [key, ...rest] = line.split(":");
        const val = rest.join(":").trim();
        if (key.trim() === "name") name = val;
        if (key.trim() === "description") description = val;
      }

      return name ? { name, description } : null;
    } catch {
      return null;
    }
  }

  /** List all skills with installed status */
  list(): (SkillEntry & { installed: boolean })[] {
    const installedIds = new Set(this.installed.map((i) => i.skillId));
    return this.catalog.map((s) => ({ ...s, installed: installedIds.has(s.id) }));
  }

  /** Publish a new skill to the catalog */
  publish(input: {
    id: string;
    name: string;
    description: string;
    author: string;
    version: string;
    tags: string[];
  }): SkillEntry {
    const idx = this.catalog.findIndex((s) => s.id === input.id);
    const entry: SkillEntry = {
      id: input.id.slice(0, 50),
      name: input.name.slice(0, 100),
      description: input.description.slice(0, 500),
      author: input.author.slice(0, 50),
      version: input.version.slice(0, 20),
      tags: input.tags.slice(0, 10).map((t) => t.slice(0, 30)),
      publishedAt: Date.now(),
      source: "registry",
    };
    if (idx >= 0) {
      this.catalog[idx] = entry;
    } else {
      this.catalog.push(entry);
    }
    return entry;
  }

  /** Mark a skill as installed */
  install(skillId: string): InstalledSkill | null {
    const skill = this.catalog.find((s) => s.id === skillId);
    if (!skill) return null;

    this.installed = this.installed.filter((i) => i.skillId !== skillId);
    const record: InstalledSkill = {
      skillId,
      version: skill.version,
      installedAt: Date.now(),
    };
    this.installed.push(record);
    this.saveInstalled();
    return record;
  }

  /** Uninstall a skill */
  uninstall(skillId: string): boolean {
    const before = this.installed.length;
    this.installed = this.installed.filter((i) => i.skillId !== skillId);
    if (this.installed.length < before) {
      this.saveInstalled();
      return true;
    }
    return false;
  }

  /** List installed skills */
  getInstalled(): InstalledSkill[] {
    return [...this.installed];
  }

  private loadInstalled(): void {
    try {
      if (existsSync(INSTALLED_PATH)) {
        const data = JSON.parse(readFileSync(INSTALLED_PATH, "utf-8"));
        if (Array.isArray(data)) this.installed = data;
      }
    } catch {
      // Start fresh
    }
  }

  private saveInstalled(): void {
    try {
      writeFileSync(INSTALLED_PATH, JSON.stringify(this.installed, null, 2), "utf-8");
    } catch {
      // Non-fatal
    }
  }
}
