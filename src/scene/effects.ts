import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { PROXIMITY_RADIUS } from "../../server/types.js";

interface LabelEntry {
  object: CSS2DObject;
  agentId: string;
}

interface BubbleEntry {
  object: CSS2DObject;
  agentId: string;
  expiresAt: number;
}

interface EmoteEntry {
  object: CSS2DObject;
  agentId: string;
  expiresAt: number;
}

// Reusable vector to avoid allocation in update loop
const _worldPos = new THREE.Vector3();

/**
 * CSS2DObjects start at screen (0,0) on first frame before the renderer
 * positions them. Hide initially, then reveal after one render pass so
 * they appear directly above the character instead of flying from top-left.
 */
function deferShow(el: HTMLElement): void {
  el.style.opacity = "0";
  el.style.transition = "none";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.2s ease";
      el.style.opacity = "1";
    });
  });
}

/** Properly dispose a CSS2DObject: remove DOM element + detach from scene */
function disposeCSS2D(obj: CSS2DObject): void {
  obj.element.remove();
  obj.removeFromParent();
}

/**
 * Manages CSS2D overlays: name labels, chat bubbles, emotes.
 * Labels/bubbles are proximity-based — only visible when camera is close.
 */
export class EffectsManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private labels = new Map<string, LabelEntry>();
  private bubbles = new Map<string, BubbleEntry>();
  private emotes = new Map<string, EmoteEntry>();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  /** Create or update a name label above a lobster */
  updateLabel(agentId: string, name: string, color: string): void {
    let entry = this.labels.get(agentId);

    if (entry) {
      const el = entry.object.element as HTMLElement;
      el.textContent = name;
      el.style.borderColor = color;
      el.style.color = color;
      return;
    }

    const el = document.createElement("div");
    el.className = "lobster-label";
    el.textContent = name;
    el.style.borderColor = color;
    el.style.color = color;
    deferShow(el);

    const obj = new CSS2DObject(el);
    obj.position.set(0, 2.8, 0);
    obj.name = `label_${agentId}`;

    entry = { object: obj, agentId };
    this.labels.set(agentId, entry);
    this.attachToAgent(agentId, obj);
  }

  /** Remove a name label */
  removeLabel(agentId: string): void {
    const entry = this.labels.get(agentId);
    if (entry) {
      disposeCSS2D(entry.object);
      this.labels.delete(agentId);
    }
  }

  /** Show a chat bubble above a lobster (auto-expires after 6s) */
  showBubble(agentId: string, text: string): void {
    this.removeBubble(agentId);

    const el = document.createElement("div");
    el.className = "chat-bubble";
    el.textContent = text.length > 80 ? text.slice(0, 80) + "\u2026" : text;
    deferShow(el);

    const obj = new CSS2DObject(el);
    obj.position.set(0, 3.6, 0);
    obj.name = `bubble_${agentId}`;

    const entry: BubbleEntry = {
      object: obj,
      agentId,
      expiresAt: Date.now() + 6000,
    };
    this.bubbles.set(agentId, entry);
    this.attachToAgent(agentId, obj);
  }

  /** Remove a chat bubble */
  removeBubble(agentId: string): void {
    const entry = this.bubbles.get(agentId);
    if (entry) {
      disposeCSS2D(entry.object);
      this.bubbles.delete(agentId);
    }
  }

  /** Show an emote icon above a lobster (auto-expires after 3s) */
  showEmote(agentId: string, emote: string): void {
    const existing = this.emotes.get(agentId);
    if (existing) {
      disposeCSS2D(existing.object);
      this.emotes.delete(agentId);
    }

    const emojiMap: Record<string, string> = {
      happy: "\u{1F60A}",
      thinking: "\u{1F914}",
      surprised: "\u{1F62E}",
      laugh: "\u{1F602}",
    };

    const el = document.createElement("div");
    el.className = "emote-bubble";
    el.textContent = emojiMap[emote] ?? "\u{1F4AC}";
    deferShow(el);

    const obj = new CSS2DObject(el);
    obj.position.set(0.5, 3.2, 0);
    obj.name = `emote_${agentId}`;

    const entry: EmoteEntry = {
      object: obj,
      agentId,
      expiresAt: Date.now() + 3000,
    };
    this.emotes.set(agentId, entry);
    this.attachToAgent(agentId, obj);
  }

  /** Per-frame update: expire old bubbles/emotes, proximity check */
  update(camera: THREE.Camera): void {
    const now = Date.now();
    this.camera = camera;

    // Expire bubbles (fade out, then remove)
    for (const [id, entry] of this.bubbles) {
      if (now >= entry.expiresAt) {
        disposeCSS2D(entry.object);
        this.bubbles.delete(id);
      }
    }

    // Expire emotes
    for (const [id, entry] of this.emotes) {
      if (now >= entry.expiresAt) {
        disposeCSS2D(entry.object);
        this.emotes.delete(id);
      }
    }

    // Proximity-based visibility
    const camPos = camera.position;
    for (const entry of this.labels.values()) {
      const parent = entry.object.parent;
      if (parent) {
        parent.getWorldPosition(_worldPos);
        entry.object.visible = camPos.distanceTo(_worldPos) < PROXIMITY_RADIUS;
      }
    }
    for (const entry of this.bubbles.values()) {
      const parent = entry.object.parent;
      if (parent) {
        parent.getWorldPosition(_worldPos);
        entry.object.visible = camPos.distanceTo(_worldPos) < PROXIMITY_RADIUS;
      }
    }
  }

  /** Attach a CSS2DObject to a lobster group in the scene */
  private attachToAgent(agentId: string, obj: CSS2DObject): void {
    this.scene.traverse((child) => {
      if (child.userData.agentId === agentId && child.name === "lobster") {
        child.add(obj);
      }
    });
  }
}
