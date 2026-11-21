// 떠 있는 섬 본체(잔디 윗면 + 흙 + 아래 바위)와 주변의 작은 떠다니는 바위를 만든다.
// 윗면은 y = 0 평면이다 (전투·이동 판정이 평면 기준).

import * as THREE from 'three';
import { createRng, randRange } from '../core/mathUtils.js';
import { sharedMat, positionNoise } from './materials.js';

function jitterRadial(geo, amount, keepTopY, seed) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (keepTopY !== null && y >= keepTopY - 0.001) continue;
    const r = Math.hypot(x, z);
    if (r < 0.001) continue;
    const n = positionNoise(x, y, z, seed);
    const k = 1 + n * amount;
    pos.setXYZ(i, x * k, y + positionNoise(z, x, y, seed + 1) * amount * 2, z * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

export function buildIslandMesh(island, layout) {
  const group = new THREE.Group();
  const R = layout.radius;
  const theme = island.theme;
  const seed = island.id.length * 13;

  // 잔디 윗면 (y: -0.6 ~ 0)
  const top = new THREE.CylinderGeometry(R, R * 0.985, 0.6, 48, 1);
  top.translate(0, -0.3, 0);
  group.add(new THREE.Mesh(top, sharedMat(theme.ground)));

  // 흙 띠
  const dirt = new THREE.CylinderGeometry(R * 0.985, R * 0.9, 2.4, 48, 2);
  dirt.translate(0, -0.6 - 1.2, 0);
  jitterRadial(dirt, 0.025, -0.6, seed);
  group.add(new THREE.Mesh(dirt, sharedMat(theme.dirt)));

  // 아래 바위 원뿔
  const depth = Math.max(8, R * 0.95);
  const cone = new THREE.ConeGeometry(R * 0.9, depth, 16, 6);
  cone.rotateX(Math.PI);
  cone.translate(0, -3.0 - depth / 2, 0);
  jitterRadial(cone, 0.12, -3.0, seed + 2);
  group.add(new THREE.Mesh(cone, sharedMat(theme.rock)));

  // 주변에 떠다니는 작은 바위
  const rng = createRng(`floaters:${island.id}`);
  const floaters = [];
  const rockMat = sharedMat(theme.rock);
  const grassMat = sharedMat(theme.ground);
  for (let i = 0; i < 9; i++) {
    const s = randRange(rng, 0.8, 2.6);
    const f = new THREE.Group();
    const c = new THREE.ConeGeometry(s, s * 1.8, 7, 2);
    c.rotateX(Math.PI);
    c.translate(0, -s * 0.9, 0);
    jitterRadial(c, 0.15, -0.001, seed + 10 + i);
    f.add(new THREE.Mesh(c, rockMat));
    const cap = new THREE.CylinderGeometry(s, s, 0.25, 7);
    cap.translate(0, 0.12, 0);
    f.add(new THREE.Mesh(cap, grassMat));
    const a = rng() * Math.PI * 2;
    const r = R + randRange(rng, 5, 18);
    const baseY = randRange(rng, -9, 2);
    f.position.set(Math.cos(a) * r, baseY, Math.sin(a) * r);
    f.rotation.y = rng() * Math.PI;
    group.add(f);
    floaters.push({ obj: f, baseY, phase: rng() * Math.PI * 2, speed: randRange(rng, 0.3, 0.7) });
  }

  return { group, floaters };
}
