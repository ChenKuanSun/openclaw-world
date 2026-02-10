import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

export function createScene() {
  // ── Renderer ───────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.getElementById("app")!.appendChild(renderer.domElement);

  // ── CSS2D label renderer ───────────────────────────────────
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  document.getElementById("app")!.appendChild(labelRenderer.domElement);

  // ── Scene ──────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // light sky blue
  scene.fog = new THREE.FogExp2(0x9dd8e8, 0.008);

  // ── Camera ─────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(20, 18, 20);
  camera.lookAt(0, 0, 0);

  // ── Controls ───────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.minDistance = 5;
  controls.maxDistance = 80;
  controls.target.set(0, 0, 0);

  // ── Clock ──────────────────────────────────────────────────
  const clock = new THREE.Clock();

  // ── Sandy ocean floor ──────────────────────────────────────
  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const ctx = floorCanvas.getContext("2d")!;

  // Warm sandy floor gradient
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 360);
  gradient.addColorStop(0, "#c2b280");  // warm sand center
  gradient.addColorStop(0.5, "#b8a97a");
  gradient.addColorStop(1, "#a89b72");  // slightly darker edge
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle grid lines (light)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(4, 4);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.85,
      metalness: 0.05,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ── Semi-transparent walls ─────────────────────────────────
  const wallMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x88ccdd,
    transparent: true,
    opacity: 0.08,
    roughness: 0.1,
    metalness: 0.0,
    transmission: 0.8,
    side: THREE.DoubleSide,
  });

  const wallHeight = 20;
  const wallPositions: [number, number, number, number][] = [
    [0, wallHeight / 2, -50, 0],         // back
    [0, wallHeight / 2, 50, Math.PI],     // front
    [-50, wallHeight / 2, 0, Math.PI / 2], // left
    [50, wallHeight / 2, 0, -Math.PI / 2], // right
  ];

  for (const [x, y, z, ry] of wallPositions) {
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(100, wallHeight),
      wallMaterial
    );
    wall.position.set(x, y, z);
    wall.rotation.y = ry;
    scene.add(wall);
  }

  // ── Lighting (bright sunny day, clear water) ───────────────
  // Hemisphere: sky blue from above, warm sand reflection from below
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0xc2b280, 0.8);
  scene.add(hemiLight);

  // Ambient fill
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main sun light — warm white, strong
  const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
  mainLight.position.set(25, 40, 15);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 100;
  mainLight.shadow.camera.left = -50;
  mainLight.shadow.camera.right = 50;
  mainLight.shadow.camera.top = 50;
  mainLight.shadow.camera.bottom = -50;
  scene.add(mainLight);

  // Light dappled caustics
  const caustic1 = new THREE.PointLight(0xffe8b0, 0.4, 60);
  caustic1.position.set(-15, 15, -15);
  scene.add(caustic1);

  const caustic2 = new THREE.PointLight(0xe0f0ff, 0.3, 50);
  caustic2.position.set(15, 12, 10);
  scene.add(caustic2);

  // ── Decorative rocks / coral ───────────────────────────────
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockColors = [0x8b7d6b, 0x9b8b7b, 0x7a6e5e, 0xa09080];
  const rockMaterials = rockColors.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );

  // Store obstacle data for collision avoidance
  const obstacles: { x: number; z: number; radius: number }[] = [];

  for (let i = 0; i < 20; i++) {
    const rock = new THREE.Mesh(rockGeo, rockMaterials[i % rockMaterials.length]);
    const scale = 0.5 + Math.random() * 2;
    rock.scale.set(scale, scale * 0.6, scale);
    const rx = (Math.random() - 0.5) * 90;
    const rz = (Math.random() - 0.5) * 90;
    rock.position.set(rx, scale * 0.3, rz);
    rock.rotation.y = Math.random() * Math.PI;
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.userData.obstacle = true;
    scene.add(rock);
    obstacles.push({ x: rx, z: rz, radius: scale + 0.8 });
  }

  // ── Floating particles (light sparkles / plankton) ─────────
  const particleCount = 500;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = Math.random() * 18;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 100;
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const particleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.12,
    transparent: true,
    opacity: 0.35,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  // Animate particles gently
  const originalPositions = positions.slice();
  function animateParticles(time: number) {
    const pos = particleGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < particleCount; i++) {
      pos.array[i * 3 + 1] =
        originalPositions[i * 3 + 1] + Math.sin(time * 0.5 + i) * 0.3;
    }
    pos.needsUpdate = true;
  }

  // Expose particle animation via scene userData
  scene.userData.animateParticles = animateParticles;

  return { scene, camera, renderer, labelRenderer, controls, clock, obstacles };
}
