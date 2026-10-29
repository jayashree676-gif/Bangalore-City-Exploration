import * as THREE from 'three';

// City grid configuration
export const BLOCK_SIZE = 24;      // size of one city block (building + plot)
export const ROAD_WIDTH = 10;
export const GRID_COUNT = 9;       // GRID_COUNT x GRID_COUNT blocks
export const CITY_HALF = (GRID_COUNT * (BLOCK_SIZE + ROAD_WIDTH)) / 2;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_PALETTE = [
  0x9fb4c7, 0x8fa8be, 0xb7a98f, 0xc2b280, 0x7d8ca3,
  0xa3b1a1, 0xcdbfae, 0x8898aa, 0xb0a28e, 0x9bb0c4
];

export function buildCity(scene, { onColliders, onCarSpots } = {}) {
  const colliders = [];
  const carSpots = [];
  const rand = mulberry32(1337);

  // ---- Ground ----
  const groundSize = CITY_HALF * 2 + 120;
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x45523f, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Road network (as a dark overlay grid) ----
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.9 });
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xdcd9c9, roughness: 0.8 });

  const cell = BLOCK_SIZE + ROAD_WIDTH;
  const start = -CITY_HALF + ROAD_WIDTH / 2;

  for (let i = 0; i <= GRID_COUNT; i++) {
    const pos = start + i * cell - ROAD_WIDTH / 2;
    // vertical road strip
    const vRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, CITY_HALF * 2 + ROAD_WIDTH),
      roadMat
    );
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(pos, 0.01, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);

    // horizontal road strip
    const hRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_HALF * 2 + ROAD_WIDTH, ROAD_WIDTH),
      roadMat
    );
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.01, pos);
    hRoad.receiveShadow = true;
    scene.add(hRoad);

    // lane markings (dashed look via thin strips)
    for (let d = -CITY_HALF; d < CITY_HALF; d += 6) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.5), laneMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(pos, 0.02, d + 1);
      scene.add(dashV);

      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.4), laneMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(d + 1, 0.02, pos);
      scene.add(dashH);
    }
  }

  // ---- Buildings ----
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xfff2b3, emissive: 0xffe28a, emissiveIntensity: 0.25, roughness: 0.4
  });

  for (let gx = 0; gx < GRID_COUNT; gx++) {
    for (let gz = 0; gz < GRID_COUNT; gz++) {
      const cx = start + gx * cell + BLOCK_SIZE / 2;
      const cz = start + gz * cell + BLOCK_SIZE / 2;

      // leave a few open plaza blocks
      const isPlaza = rand() < 0.06;
      if (isPlaza) {
        const plaza = new THREE.Mesh(
          new THREE.CircleGeometry(BLOCK_SIZE / 2.4, 24),
          new THREE.MeshStandardMaterial({ color: 0x6b7a5e })
        );
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(cx, 0.015, cz);
        scene.add(plaza);
        continue;
      }

      // 1-4 buildings per block in a small sub-grid
      const sub = rand() < 0.5 ? 1 : 2;
      const subCell = BLOCK_SIZE / sub;

      for (let sx = 0; sx < sub; sx++) {
        for (let sz = 0; sz < sub; sz++) {
          if (rand() < 0.08) continue; // occasional empty lot

          const footprint = subCell * (0.55 + rand() * 0.3);
          const height = 4 + rand() * rand() * 42;
          const color = BUILDING_PALETTE[Math.floor(rand() * BUILDING_PALETTE.length)];

          const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
          const mesh = new THREE.Mesh(buildingGeo, mat);
          mesh.scale.set(footprint, height, footprint);

          const bx = cx - BLOCK_SIZE / 2 + subCell * sx + subCell / 2;
          const bz = cz - BLOCK_SIZE / 2 + subCell * sz + subCell / 2;
          mesh.position.set(bx, height / 2, bz);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          scene.add(mesh);

          // window band (simple glowing strip for high-end night look)
          if (height > 8) {
            const bandGeo = new THREE.BoxGeometry(footprint * 1.001, height * 0.96, footprint * 1.001);
            const band = new THREE.Mesh(bandGeo, windowMat);
            band.position.copy(mesh.position);
            band.scale.set(1, 1, 1);
            band.visible = false; // toggled on for night mode by main.js
            band.userData.isWindowBand = true;
            scene.add(band);
          }

          colliders.push({
            minX: bx - footprint / 2, maxX: bx + footprint / 2,
            minZ: bz - footprint / 2, maxZ: bz + footprint / 2,
            height
          });

          // occasionally mark a ground-floor spot as a parking spot for the car
          if (rand() < 0.015 && carSpots.length < 6) {
            carSpots.push(new THREE.Vector3(bx + footprint, 0, bz));
          }
        }
      }
    }
  }

  // ---- Streetlights ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1f26 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a8, emissiveIntensity: 1 });
  for (let i = -3; i <= 3; i++) {
    const x = i * cell * 1.6;
    if (Math.abs(x) > CITY_HALF) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), poleMat);
    pole.position.set(x, 3, -CITY_HALF - 4);
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), lampMat);
    lamp.position.set(x, 6, -CITY_HALF - 4);
    scene.add(lamp);
  }

  if (carSpots.length === 0) carSpots.push(new THREE.Vector3(6, 0, 6));

  onColliders && onColliders(colliders);
  onCarSpots && onCarSpots(carSpots);

  return { colliders, carSpots, groundSize };
}
