import * as THREE from 'three';

// A simple low-poly car built from primitives (no external model needed).
export function buildCar(color = 0xd1443a) {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd0e8, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.7 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 4), bodyMat);
  base.position.y = 0.5;
  base.castShadow = true;
  car.add(base);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 12);
  const wheelPositions = [
    [-1.05, 0.4, 1.3], [1.05, 0.4, 1.3],
    [-1.05, 0.4, -1.3], [1.05, 0.4, -1.3]
  ];
  car.userData.wheels = [];
  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    car.add(wheel);
    car.userData.wheels.push(wheel);
  });

  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff6cc, emissive: 0xfff6cc, emissiveIntensity: 1 });
  [[-0.7, 0.55, 2.01], [0.7, 0.55, 2.01]].forEach(([x, y, z]) => {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), headlightMat);
    light.position.set(x, y, z);
    car.add(light);
  });

  car.userData.isCar = true;
  car.userData.speed = 0;
  car.userData.heading = 0;

  return car;
}

export class CarController {
  constructor(car, colliders, halfExtent) {
    this.car = car;
    this.colliders = colliders;
    this.halfExtent = halfExtent;
    this.velocity = 0;
    this.heading = 0;
    this.maxSpeed = 22;
    this.accel = 14;
    this.brakeDecel = 26;
    this.friction = 6;
    this.turnRate = 2.0;
  }

  update(dt, input) {
    const { forward, back, left, right, brake } = input;

    if (forward) this.velocity += this.accel * dt;
    else if (back) this.velocity -= this.accel * dt;
    else {
      // natural friction toward 0
      if (this.velocity > 0) this.velocity = Math.max(0, this.velocity - this.friction * dt);
      else this.velocity = Math.min(0, this.velocity + this.friction * dt);
    }
    if (brake) {
      if (this.velocity > 0) this.velocity = Math.max(0, this.velocity - this.brakeDecel * dt);
      else this.velocity = Math.min(0, this.velocity + this.brakeDecel * dt);
    }

    this.velocity = THREE.MathUtils.clamp(this.velocity, -this.maxSpeed * 0.5, this.maxSpeed);

    const turnFactor = THREE.MathUtils.clamp(Math.abs(this.velocity) / 6, 0.2, 1);
    if (left) this.heading += this.turnRate * dt * turnFactor * (this.velocity >= 0 ? 1 : -1);
    if (right) this.heading -= this.turnRate * dt * turnFactor * (this.velocity >= 0 ? 1 : -1);

    const dx = Math.sin(this.heading) * this.velocity * dt;
    const dz = Math.cos(this.heading) * this.velocity * dt;

    const nextX = this.car.position.x + dx;
    const nextZ = this.car.position.z + dz;

    if (!this.collides(nextX, nextZ)) {
      this.car.position.x = nextX;
      this.car.position.z = nextZ;
    } else {
      this.velocity *= -0.2; // bounce back slightly on collision
    }

    this.car.position.x = THREE.MathUtils.clamp(this.car.position.x, -this.halfExtent, this.halfExtent);
    this.car.position.z = THREE.MathUtils.clamp(this.car.position.z, -this.halfExtent, this.halfExtent);

    this.car.rotation.y = this.heading;

    // spin wheels for visual feedback
    this.car.userData.wheels.forEach(w => { w.rotation.x -= this.velocity * dt * 0.8; });
  }

  collides(x, z) {
    const margin = 1.1;
    for (const c of this.colliders) {
      if (x + margin > c.minX && x - margin < c.maxX && z + margin > c.minZ && z - margin < c.maxZ) {
        return true;
      }
    }
    return false;
  }
}
