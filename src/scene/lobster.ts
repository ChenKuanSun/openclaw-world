import * as THREE from "three";

/**
 * Creates a procedural lobster mesh group.
 * Body = ellipsoid, tail = tapered segments, claws, legs, eye stalks.
 * Uses MeshToonMaterial for a stylised underwater look.
 */
export function createLobster(color: string): THREE.Group {
  const group = new THREE.Group();
  group.name = "lobster";

  const baseColor = new THREE.Color(color);
  const darkColor = baseColor.clone().multiplyScalar(0.6);

  const bodyMat = new THREE.MeshToonMaterial({ color: baseColor });
  const darkMat = new THREE.MeshToonMaterial({ color: darkColor });
  const eyeMat = new THREE.MeshToonMaterial({ color: 0x111111 });
  const eyeWhiteMat = new THREE.MeshToonMaterial({ color: 0xeeeeee });

  // ── Body (main carapace) ───────────────────────────────────
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 12, 8),
    bodyMat
  );
  body.scale.set(1, 0.7, 1.6);
  body.position.set(0, 0.5, 0);
  body.castShadow = true;
  group.add(body);

  // ── Head ───────────────────────────────────────────────────
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 10, 8),
    bodyMat
  );
  head.scale.set(1, 0.8, 1.1);
  head.position.set(0, 0.55, 0.85);
  head.castShadow = true;
  group.add(head);

  // ── Tail segments ──────────────────────────────────────────
  const tailSegments = 5;
  for (let i = 0; i < tailSegments; i++) {
    const t = i / tailSegments;
    const radius = 0.45 * (1 - t * 0.5);
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 8, 6),
      i % 2 === 0 ? bodyMat : darkMat
    );
    seg.scale.set(1, 0.6, 0.9);
    seg.position.set(0, 0.35 - i * 0.05, -0.8 - i * 0.38);
    seg.castShadow = true;
    group.add(seg);
  }

  // Tail fan
  const fan = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    darkMat
  );
  fan.scale.set(1.6, 0.2, 1);
  fan.position.set(0, 0.2, -2.7);
  fan.castShadow = true;
  group.add(fan);

  // ── Claws ──────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const clawGroup = new THREE.Group();
    clawGroup.name = side === -1 ? "claw_left" : "claw_right";

    // Arm
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.8, 6),
      bodyMat
    );
    arm.rotation.z = side * 0.5;
    arm.rotation.x = -0.3;
    arm.position.set(side * 0.4, 0, 0.3);
    arm.castShadow = true;
    clawGroup.add(arm);

    // Forearm
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 0.6, 6),
      bodyMat
    );
    forearm.position.set(side * 0.8, 0.1, 0.6);
    forearm.rotation.z = side * 0.8;
    forearm.castShadow = true;
    clawGroup.add(forearm);

    // Pincer (two halves)
    for (const half of [-1, 1]) {
      const pincer = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 6),
        darkMat
      );
      pincer.scale.set(0.6, 0.4, 1.5);
      pincer.position.set(
        side * 1.1,
        0.1 + half * 0.06,
        0.85
      );
      pincer.castShadow = true;
      clawGroup.add(pincer);
    }

    clawGroup.position.set(0, 0.5, 0.3);
    group.add(clawGroup);
  }

  // ── Legs (4 pairs) ─────────────────────────────────────────
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.5, 4),
        darkMat
      );
      leg.position.set(
        side * (0.45 + i * 0.02),
        0.15,
        0.3 - i * 0.3
      );
      leg.rotation.z = side * 0.8;
      leg.rotation.x = -0.1 + i * 0.05;
      leg.castShadow = true;
      leg.name = `leg_${side === -1 ? "l" : "r"}_${i}`;
      group.add(leg);
    }
  }

  // ── Eye stalks ─────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6),
      bodyMat
    );
    stalk.position.set(side * 0.18, 0.85, 1.05);
    stalk.rotation.z = side * 0.3;
    stalk.rotation.x = -0.2;
    group.add(stalk);

    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      eyeWhiteMat
    );
    eyeWhite.position.set(side * 0.25, 0.97, 1.08);
    group.add(eyeWhite);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 6),
      eyeMat
    );
    eye.position.set(side * 0.27, 0.97, 1.12);
    group.add(eye);
  }

  // ── Antennae ───────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    for (let t = 0; t <= 1; t += 0.1) {
      points.push(
        new THREE.Vector3(
          side * (0.1 + t * 0.4),
          0.8 + t * 0.3 - t * t * 0.4,
          1.1 + t * 0.8
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.015, 4, false);
    const antenna = new THREE.Mesh(tubeGeo, darkMat);
    group.add(antenna);
  }

  // Scale the whole lobster
  group.scale.set(1.2, 1.2, 1.2);

  return group;
}

/**
 * All animations use absolute `=` assignments (never `+=` or `*=`)
 * to avoid unbounded accumulation across frames. The lobster-manager
 * calls position.set() before animations, so position.y offsets here
 * are additive on top of the correct base position for one frame only.
 */

/** Animate idle bob — note: position.y is reset by manager each frame */
export function animateIdle(group: THREE.Group, time: number): void {
  group.position.y += Math.sin(time * 2) * 0.003;
  group.rotation.z = Math.sin(time * 1.5) * 0.02;
}

/** Animate walking (wiggle legs) */
export function animateWalk(group: THREE.Group, time: number): void {
  group.children.forEach((child) => {
    if (child.name.startsWith("leg_")) {
      const idx = parseInt(child.name.split("_")[2], 10);
      const phase = idx * Math.PI * 0.5;
      child.rotation.x = Math.sin(time * 8 + phase) * 0.4;
    }
  });
}

/** Animate claw snap (talk / pinch) */
export function animateClawSnap(group: THREE.Group, time: number): void {
  const leftClaw = group.getObjectByName("claw_left");
  const rightClaw = group.getObjectByName("claw_right");
  const snap = Math.sin(time * 6) * 0.15;
  if (leftClaw) leftClaw.rotation.x = snap;
  if (rightClaw) rightClaw.rotation.x = -snap;
}

/** Animate wave (raise one claw) */
export function animateWave(group: THREE.Group, time: number): void {
  const rightClaw = group.getObjectByName("claw_right");
  if (rightClaw) {
    rightClaw.rotation.z = -0.5 + Math.sin(time * 4) * 0.5;
    rightClaw.rotation.x = -0.3;
  }
}

/** Animate dance (rhythmic body bounce + alternating claw raises + leg shuffle) */
export function animateDance(group: THREE.Group, time: number): void {
  // Rhythmic vertical bounce (additive on manager-set base)
  group.position.y += Math.abs(Math.sin(time * 5)) * 0.15;

  // Body sway side to side
  group.rotation.z = Math.sin(time * 3) * 0.15;

  // Alternating claw raises
  const leftClaw = group.getObjectByName("claw_left");
  const rightClaw = group.getObjectByName("claw_right");
  if (leftClaw) {
    leftClaw.rotation.z = 0.3 + Math.sin(time * 5) * 0.6;
    leftClaw.rotation.x = Math.sin(time * 3) * 0.3;
  }
  if (rightClaw) {
    rightClaw.rotation.z = -0.3 + Math.sin(time * 5 + Math.PI) * 0.6;
    rightClaw.rotation.x = Math.sin(time * 3 + Math.PI) * 0.3;
  }

  // Leg shuffle — use absolute assignments based on base rotation
  group.children.forEach((child) => {
    if (child.name.startsWith("leg_")) {
      const idx = parseInt(child.name.split("_")[2], 10);
      const side = child.name.includes("_l_") ? -1 : 1;
      const baseZ = side * 0.8; // original rotation from construction
      const phase = idx * Math.PI * 0.5;
      child.rotation.x = Math.sin(time * 10 + phase) * 0.5;
      child.rotation.z = baseZ + Math.sin(time * 5 + phase) * 0.1;
    }
  });
}

/**
 * Animate backflip (full rotation around X axis over ~1.5 sec cycle).
 * Uses a smooth ease curve so the flip accelerates/decelerates naturally.
 */
export function animateBackflip(group: THREE.Group, time: number): void {
  const cycleDuration = 1.5;
  const phase = (time % cycleDuration) / cycleDuration;

  // Smooth ease-in-out for the flip rotation
  const eased = phase < 0.5
    ? 2 * phase * phase
    : 1 - Math.pow(-2 * phase + 2, 2) / 2;

  group.rotation.x = eased * Math.PI * 2;

  // Jump arc (additive on manager-set base)
  group.position.y += Math.sin(phase * Math.PI) * 2.5;

  // Tuck legs during flip
  group.children.forEach((child) => {
    if (child.name.startsWith("leg_")) {
      child.rotation.x = -0.5 * Math.sin(phase * Math.PI);
    }
  });

  // Pull claws in during flip
  const leftClaw = group.getObjectByName("claw_left");
  const rightClaw = group.getObjectByName("claw_right");
  const tuck = Math.sin(phase * Math.PI) * 0.4;
  if (leftClaw) leftClaw.rotation.x = -tuck;
  if (rightClaw) rightClaw.rotation.x = -tuck;
}

/** Animate spin (360° Y rotation with rising motion) — all absolute values */
export function animateSpin(group: THREE.Group, time: number): void {
  const spinSpeed = 2 * Math.PI; // one full rotation per second

  // Deterministic spin based on time (no accumulation)
  group.rotation.y = (time * spinSpeed) % (Math.PI * 2);

  // Slight bounce (additive on manager-set base)
  const cycleDuration = 1.0;
  const phase = (time % cycleDuration) / cycleDuration;
  group.position.y += Math.sin(phase * Math.PI) * 0.5;

  // Spread claws outward during spin (centrifugal effect)
  const leftClaw = group.getObjectByName("claw_left");
  const rightClaw = group.getObjectByName("claw_right");
  if (leftClaw) {
    leftClaw.rotation.z = 0.6;
    leftClaw.rotation.x = Math.sin(time * 8) * 0.2;
  }
  if (rightClaw) {
    rightClaw.rotation.z = -0.6;
    rightClaw.rotation.x = Math.sin(time * 8 + Math.PI) * 0.2;
  }

  // Fan legs out with capped spread (absolute, not multiplicative)
  group.children.forEach((child) => {
    if (child.name.startsWith("leg_")) {
      const side = child.name.includes("_l_") ? -1 : 1;
      const baseZ = side * 0.8;
      const spread = Math.sin(time * 3) * 0.15;
      child.rotation.z = baseZ + spread;
    }
  });
}
