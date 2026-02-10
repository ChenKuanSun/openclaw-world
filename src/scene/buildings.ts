import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

export interface BuildingDef {
  id: string;
  name: string;
  position: THREE.Vector3;
  obstacleRadius: number;
  mesh: THREE.Group;
}

/**
 * Create all interactive buildings in the ocean world.
 * Returns building definitions + obstacle data for collision avoidance.
 */
export function createBuildings(scene: THREE.Scene): {
  buildings: BuildingDef[];
  obstacles: { x: number; z: number; radius: number }[];
} {
  const buildings: BuildingDef[] = [];
  const obstacles: { x: number; z: number; radius: number }[] = [];

  // ── Moltbook Bulletin Board ──────────────────────────────────
  const moltbook = createMoltbookBoard();
  moltbook.position.set(-20, 0, -20);
  scene.add(moltbook);
  buildings.push({
    id: "moltbook",
    name: "Moltbook",
    position: new THREE.Vector3(-20, 0, -20),
    obstacleRadius: 4,
    mesh: moltbook,
  });
  obstacles.push({ x: -20, z: -20, radius: 4 });

  // ── Clawhub School ───────────────────────────────────────────
  const clawhub = createClawhubSchool();
  clawhub.position.set(22, 0, -22);
  scene.add(clawhub);
  buildings.push({
    id: "clawhub",
    name: "Clawhub Academy",
    position: new THREE.Vector3(22, 0, -22),
    obstacleRadius: 6,
    mesh: clawhub,
  });
  obstacles.push({ x: 22, z: -22, radius: 6 });

  // ── Worlds Portal ───────────────────────────────────────────
  const portal = createWorldsPortal();
  portal.position.set(0, 0, -35);
  scene.add(portal);
  buildings.push({
    id: "worlds-portal",
    name: "Worlds Portal",
    position: new THREE.Vector3(0, 0, -35),
    obstacleRadius: 5,
    mesh: portal,
  });
  obstacles.push({ x: 0, z: -35, radius: 5 });

  // Add floating labels above each building
  for (const b of buildings) {
    const el = document.createElement("div");
    el.className = "building-label";
    el.textContent = b.name;
    const labelObj = new CSS2DObject(el);
    const labelY = b.id === "moltbook" ? 6 : b.id === "worlds-portal" ? 9 : 8;
    labelObj.position.set(0, labelY, 0);
    b.mesh.add(labelObj);
  }

  // ── Moltbook decorative sticky notes (3D geometry on the board) ──
  const moltbookGroup = buildings.find((b) => b.id === "moltbook")?.mesh;
  if (moltbookGroup) {
    const noteGrid = [
      // [x, y] on the board face — 3 columns x 3 rows
      [-1.0, 4.2], [0.0, 4.3], [1.0, 4.1],
      [-0.8, 3.3], [0.4, 3.2], [1.2, 3.4],
      [-0.3, 2.4], [0.8, 2.5],
    ];
    const noteColors = [0xc8e6c9, 0x81d4fa, 0xffcc80, 0xb39ddb, 0xffe082, 0x80cbc4, 0xf48fb1, 0x90caf9];

    for (let i = 0; i < noteGrid.length; i++) {
      const [nx, ny] = noteGrid[i];
      const w = 0.5 + Math.random() * 0.3;
      const h = 0.5 + Math.random() * 0.2;
      const note = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          color: noteColors[i % noteColors.length],
          roughness: 0.9,
        })
      );
      note.position.set(nx, ny, 0.09);
      note.rotation.z = (Math.random() - 0.5) * 0.15;
      note.userData.buildingId = "moltbook";
      moltbookGroup.add(note);
    }
  }

  return { buildings, obstacles };
}

function createMoltbookBoard(): THREE.Group {
  const group = new THREE.Group();
  group.name = "building_moltbook";
  group.userData.buildingId = "moltbook";

  // Posts (two wooden poles)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.18, 5, 8),
      postMat
    );
    post.position.set(side * 1.8, 2.5, 0);
    post.castShadow = true;
    group.add(post);
  }

  // Board (main panel)
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.7 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 0.15),
    boardMat
  );
  board.position.set(0, 3.5, 0);
  board.castShadow = true;
  group.add(board);

  // Board frame
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.6 });
  const frameGeo = new THREE.BoxGeometry(4.3, 3.3, 0.1);
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 3.5, -0.1);
  group.add(frame);

  // Decorative sticky notes are added as 3D meshes in createBuildings()

  // "Moltbook" title on top
  const titleBg = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.5, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xff7043 })
  );
  titleBg.position.set(0, 5.2, 0);
  group.add(titleBg);

  // Small roof
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 0.2, 1),
    roofMat
  );
  roof.position.set(0, 5.5, 0);
  roof.castShadow = true;
  group.add(roof);

  // Mark all meshes as interactable
  group.traverse((child) => {
    child.userData.buildingId = "moltbook";
  });

  return group;
}

function createClawhubSchool(): THREE.Group {
  const group = new THREE.Group();
  group.name = "building_clawhub";
  group.userData.buildingId = "clawhub";

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x00bcd4, roughness: 0.3 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x4fc3f7,
    emissive: 0x0288d1,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.8,
  });

  // Main building body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 6),
    wallMat
  );
  body.position.set(0, 2.5, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof (pitched)
  const roofGeo = new THREE.ConeGeometry(5.5, 2, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 6, 0);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.5, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x5d4037 })
  );
  door.position.set(0, 1.25, 3.05);
  group.add(door);

  // Door accent (arch)
  const doorArch = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.3, 0.15),
    accentMat
  );
  doorArch.position.set(0, 2.6, 3.05);
  group.add(doorArch);

  // Windows (2 rows of 3)
  for (let row = 0; row < 2; row++) {
    for (let col = -1; col <= 1; col++) {
      if (row === 0 && col === 0) continue; // Door position
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.8),
        windowMat
      );
      win.position.set(col * 2.2, 1.5 + row * 2, 3.06);
      group.add(win);
    }
  }

  // Side windows
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.8),
        windowMat
      );
      win.position.set(side * 4.06, 2.5 + (i % 2) * 1.5, -1 + i * 1.5);
      win.rotation.y = side * Math.PI / 2;
      group.add(win);
    }
  }

  // "Clawhub" sign above door
  const signBg = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.7, 0.1),
    accentMat
  );
  signBg.position.set(0, 4.5, 3.06);
  group.add(signBg);

  // Flag pole on roof
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 2, 6),
    new THREE.MeshStandardMaterial({ color: 0x9e9e9e })
  );
  pole.position.set(0, 7.5, 0);
  group.add(pole);

  // Flag
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x00bcd4, side: THREE.DoubleSide })
  );
  flag.position.set(0.5, 8, 0);
  group.add(flag);

  // Mark all meshes as interactable
  group.traverse((child) => {
    child.userData.buildingId = "clawhub";
  });

  return group;
}

function createWorldsPortal(): THREE.Group {
  const group = new THREE.Group();
  group.name = "building_worlds_portal";
  group.userData.buildingId = "worlds-portal";

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.7 });
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0x7c4dff,
    emissive: 0x4527a0,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.6,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xb388ff,
    emissive: 0x7c4dff,
    emissiveIntensity: 0.2,
  });

  // Stone arch (two pillars + top)
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 7, 1.2),
      stoneMat
    );
    pillar.position.set(side * 3, 3.5, 0);
    pillar.castShadow = true;
    group.add(pillar);

    // Pillar base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.5, 1.8),
      stoneMat
    );
    base.position.set(side * 3, 0.25, 0);
    group.add(base);

    // Pillar cap
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.4, 1.6),
      stoneMat
    );
    cap.position.set(side * 3, 7.2, 0);
    group.add(cap);
  }

  // Top arch beam
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 1, 1.2),
    stoneMat
  );
  beam.position.set(0, 7.5, 0);
  beam.castShadow = true;
  group.add(beam);

  // Portal surface (glowing plane)
  const portalPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 6.5),
    portalMat
  );
  portalPlane.position.set(0, 3.5, 0);
  group.add(portalPlane);

  // Portal back side
  const portalBack = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 6.5),
    portalMat
  );
  portalBack.position.set(0, 3.5, -0.01);
  portalBack.rotation.y = Math.PI;
  group.add(portalBack);

  // Decorative runes on pillars
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const rune = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        accentMat
      );
      rune.position.set(side * 3, 2 + i * 1.8, 0.65);
      group.add(rune);
    }
  }

  // Glowing orb on top
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xb388ff,
      emissive: 0x7c4dff,
      emissiveIntensity: 0.8,
    })
  );
  orb.position.set(0, 8.3, 0);
  group.add(orb);

  // Platform base
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.5, 0.4, 8),
    stoneMat
  );
  platform.position.set(0, 0.2, 0);
  platform.receiveShadow = true;
  group.add(platform);

  // Mark all meshes as interactable
  group.traverse((child) => {
    child.userData.buildingId = "worlds-portal";
  });

  return group;
}
