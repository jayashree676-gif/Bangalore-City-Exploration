import * as THREE from 'three';
import { buildCity, CITY_HALF } from './city.js';
import { buildCar, CarController } from './car.js';

// ---------- Renderer / Scene / Camera ----------
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaecbe8);
scene.fog = new THREE.Fog(0xaecbe8, 60, 260);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 1.7, 10);

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a3f33, 0.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d6, 1.4);
sun.position.set(80, 120, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- City ----------
let colliders = [];
let carSpots = [];
buildCity(scene, {
  onColliders: (c) => (colliders = c),
  onCarSpots: (c) => (carSpots = c)
});

// ---------- Car ----------
const car = buildCar(0xd1443a);
car.position.copy(carSpots[0]);
scene.add(car);
const carController = new CarController(car, colliders, CITY_HALF - 2);

// ---------- Player state ----------
const player = {
  position: new THREE.Vector3(0, 1.7, 14),
  yaw: 0,
  pitch: 0,
  velocityY: 0,
  onGround: true,
  height: 1.7,
  radius: 0.4
};

let mode = 'walk'; // 'walk' | 'drive'
const keys = {};
let yawCar = 0;

const modeLabel = document.getElementById('modeLabel');
const carHint = document.getElementById('carHint');
const blocker = document.getElementById('blocker');

function setMode(next) {
  mode = next;
  modeLabel.textContent = mode === 'walk' ? 'Walking' : 'Driving';
  carHint.style.display = mode === 'drive' ? 'block' : 'none';
}

// ---------- Pointer lock look ----------
let pointerLocked = false;

blocker.addEventListener('click', () => {
  canvas.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  blocker.style.display = pointerLocked ? 'none' : 'flex';
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  const sens = 0.0022;
  if (mode === 'walk') {
    player.yaw -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  } else {
    yawCar -= e.movementX * sens;
  }
});

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyF') tryToggleCar();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

function tryToggleCar() {
  if (mode === 'walk') {
    const dist = player.position.distanceTo(car.position);
    if (dist < 4) {
      setMode('drive');
    }
  } else {
    setMode('walk');
    // place player beside the car
    const offset = new THREE.Vector3(2.2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y);
    player.position.copy(car.position).add(offset);
    player.position.y = player.height;
  }
}

// ---------- Collision helper (AABB vs circle, walking) ----------
function resolveWalkCollision(x, z) {
  const r = player.radius;
  let nx = x, nz = z;
  for (const c of colliders) {
    const closestX = THREE.MathUtils.clamp(nx, c.minX, c.maxX);
    const closestZ = THREE.MathUtils.clamp(nz, c.minZ, c.maxZ);
    const dx = nx - closestX;
    const dz = nz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < r * r) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const push = (r - dist);
      nx += (dx / dist) * push;
      nz += (dz / dist) * push;
    }
  }
  return [nx, nz];
}

// ---------- Minimap ----------
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');

function drawMinimap() {
  const size = minimap.width;
  mctx.clearRect(0, 0, size, size);
  mctx.fillStyle = 'rgba(20,24,34,0.4)';
  mctx.fillRect(0, 0, size, size);

  const scale = size / (CITY_HALF * 2.4);
  const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];

  mctx.fillStyle = '#4a5a68';
  for (const c of colliders) {
    const [x1, z1] = toMap(c.minX, c.minZ);
    const [x2, z2] = toMap(c.maxX, c.maxZ);
    mctx.fillRect(x1, z1, x2 - x1, z2 - z1);
  }

  // car
  const [cx, cz] = toMap(car.position.x, car.position.z);
  mctx.fillStyle = '#d1443a';
  mctx.beginPath();
  mctx.arc(cx, cz, 3, 0, Math.PI * 2);
  mctx.fill();

  // player
  const pPos = mode === 'walk' ? player.position : car.position;
  const [px, pz] = toMap(pPos.x, pPos.z);
  mctx.fillStyle = '#8ab4ff';
  mctx.beginPath();
  mctx.arc(px, pz, 4, 0, Math.PI * 2);
  mctx.fill();
}

// ---------- FPS counter ----------
const fpsEl = document.getElementById('fps');
let frames = 0;
let fpsTimer = 0;

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Main loop ----------
const clock = new THREE.Clock();

function updateWalk(dt) {
  const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 7.5 : 4.2;
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.sin(player.yaw + Math.PI / 2), 0, Math.cos(player.yaw + Math.PI / 2));

  const move = new THREE.Vector3();
  if (keys['KeyW'] || keys['ArrowUp']) move.add(forward);
  if (keys['KeyS'] || keys['ArrowDown']) move.sub(forward);
  if (keys['KeyD'] || keys['ArrowRight']) move.add(right);
  if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed * dt);
  }

  let nx = player.position.x + move.x;
  let nz = player.position.z + move.z;
  [nx, nz] = resolveWalkCollision(nx, nz);

  const half = CITY_HALF + 50;
  nx = THREE.MathUtils.clamp(nx, -half, half);
  nz = THREE.MathUtils.clamp(nz, -half, half);

  player.position.x = nx;
  player.position.z = nz;

  // simple jump/gravity
  const groundY = 1.7;
  if (keys['Space'] && player.onGround) {
    player.velocityY = 5.2;
    player.onGround = false;
  }
  player.velocityY -= 14 * dt;
  player.position.y += player.velocityY * dt;
  if (player.position.y <= groundY) {
    player.position.y = groundY;
    player.velocityY = 0;
    player.onGround = true;
  }

  camera.position.copy(player.position);
  const dir = new THREE.Vector3(
    Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    Math.cos(player.yaw) * Math.cos(player.pitch)
  );
  camera.lookAt(player.position.clone().add(dir));
}

function updateDrive(dt) {
  const input = {
    forward: keys['KeyW'] || keys['ArrowUp'],
    back: keys['KeyS'] || keys['ArrowDown'],
    left: keys['KeyA'] || keys['ArrowLeft'],
    right: keys['KeyD'] || keys['ArrowRight'],
    brake: keys['Space']
  };
  carController.update(dt, input);

  // chase camera, with slight free-look via yawCar
  const behind = new THREE.Vector3(
    Math.sin(car.rotation.y + Math.PI) * 7,
    3.2,
    Math.cos(car.rotation.y + Math.PI) * 7
  );
  const desired = car.position.clone().add(behind);
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  const lookTarget = car.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  camera.lookAt(lookTarget);
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (mode === 'walk') updateWalk(dt);
  else updateDrive(dt);

  drawMinimap();

  renderer.render(scene, camera);

  frames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = Math.round(frames / fpsTimer) + ' fps';
    frames = 0;
    fpsTimer = 0;
  }

  requestAnimationFrame(animate);
}

animate();
