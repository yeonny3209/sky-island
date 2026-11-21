// 섬 소품(나무·바위·집 등) 로우폴리 모양. 종류 목록은 islandLayout.js의 PROP_TYPES.
// 나중에 Kenney/Quaternius 모델(.glb)로 바꿀 때 이 파일만 고치면 된다.

import * as THREE from 'three';
import { sharedMat, positionNoise } from './materials.js';

const pick = (list, x, z) => list[Math.floor(((positionNoise(x, 0, z, 7) + 1) / 2) * list.length) % list.length];

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

const builders = {
  tree(g, p) {
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.1, 6), sharedMat('#7a5230'), 0, 0.55, 0));
    const leaf = sharedMat(pick(['#4caf50', '#5cb85c', '#3f9b46', '#6abf4b'], p.x, p.z));
    const a = mesh(new THREE.IcosahedronGeometry(0.95, 0), leaf, 0, 1.75, 0);
    a.scale.y = 1.1;
    g.add(a);
    g.add(mesh(new THREE.IcosahedronGeometry(0.6, 0), leaf, 0.35, 2.35, 0.1));
  },
  pine(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.9, 6), sharedMat('#6b4426'), 0, 0.45, 0));
    const leaf = sharedMat('#2f7d4a');
    [
      [1.0, 1.1, 1.1],
      [0.78, 1.0, 1.75],
      [0.55, 0.9, 2.35],
    ].forEach(([r, h, y]) => g.add(mesh(new THREE.ConeGeometry(r, h, 7), leaf, 0, y, 0)));
  },
  rock(g, p) {
    const mat = sharedMat(pick(['#8b8f98', '#7d828c', '#9aa0a8'], p.x, p.z));
    const a = mesh(new THREE.DodecahedronGeometry(0.75, 0), mat, 0, 0.35, 0);
    a.scale.set(1, 0.7, 0.9);
    g.add(a);
    const b = mesh(new THREE.DodecahedronGeometry(0.35, 0), mat, 0.6, 0.18, 0.3);
    g.add(b);
  },
  bush(g, p) {
    const mat = sharedMat(pick(['#4a9e48', '#58b05a', '#3d8c3f'], p.x, p.z));
    const a = mesh(new THREE.IcosahedronGeometry(0.45, 0), mat, 0, 0.3, 0);
    a.scale.y = 0.7;
    g.add(a);
    g.add(mesh(new THREE.IcosahedronGeometry(0.3, 0), mat, 0.35, 0.22, 0.1));
  },
  flower(g, p) {
    const color = pick(['#f472b6', '#facc15', '#ffffff', '#a78bfa', '#fb923c'], p.x, p.z);
    const stem = sharedMat('#3f8f3a');
    const petal = sharedMat(color, { emissive: color, emissiveIntensity: 0.15 });
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 0.18;
      const oz = (i % 2) * 0.15;
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), stem, ox, 0.15, oz));
      g.add(mesh(new THREE.OctahedronGeometry(0.08, 0), petal, ox, 0.32, oz));
    }
  },
  house(g, p) {
    const wall = sharedMat(pick(['#f3e2c7', '#efe0d0', '#f5ecd9'], p.x, p.z));
    const roof = sharedMat(pick(['#c2553d', '#3f6fb5', '#5b8c3a', '#9b5de5'], p.x, p.z));
    const wood = sharedMat('#7a5230');
    g.add(mesh(new THREE.BoxGeometry(3.2, 2.2, 2.8), wall, 0, 1.1, 0));
    const r = mesh(new THREE.ConeGeometry(2.55, 1.6, 4), roof, 0, 3.0, 0);
    r.rotation.y = Math.PI / 4;
    r.scale.set(1.05, 1, 0.95);
    g.add(r);
    g.add(mesh(new THREE.BoxGeometry(0.75, 1.3, 0.08), wood, 0, 0.65, 1.42));
    const glass = sharedMat('#9bd3ff', { emissive: '#ffe9a8', emissiveIntensity: 0.25 });
    g.add(mesh(new THREE.BoxGeometry(0.55, 0.5, 0.06), glass, -0.95, 1.35, 1.42));
    g.add(mesh(new THREE.BoxGeometry(0.55, 0.5, 0.06), glass, 0.95, 1.35, 1.42));
    g.add(mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), sharedMat('#8b8f98'), 0.9, 3.3, -0.5));
  },
  lamp(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 6), sharedMat('#3f3f46'), 0, 1.1, 0));
    g.add(mesh(new THREE.BoxGeometry(0.32, 0.38, 0.32), sharedMat('#ffd27a', { emissive: '#ffcc66', emissiveIntensity: 0.9 }), 0, 2.35, 0));
    g.add(mesh(new THREE.ConeGeometry(0.28, 0.25, 4), sharedMat('#3f3f46'), 0, 2.67, 0));
  },
  well(g) {
    const stone = sharedMat('#9aa0a8');
    const ring = mesh(new THREE.CylinderGeometry(1, 1.05, 0.7, 10, 1, true), stone, 0, 0.35, 0);
    ring.material = sharedMat('#9aa0a8', { side: THREE.DoubleSide });
    g.add(ring);
    g.add(mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.05, 10), sharedMat('#4aa3df', { emissive: '#1e6fa8', emissiveIntensity: 0.2 }), 0, 0.45, 0));
    const wood = sharedMat('#7a5230');
    g.add(mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), wood, -0.85, 1.1, 0));
    g.add(mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), wood, 0.85, 1.1, 0));
    const roof = mesh(new THREE.ConeGeometry(1.35, 0.7, 4), sharedMat('#c2553d'), 0, 2.2, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  },
  crystal(g) {
    const mat = sharedMat('#67e8f9', { emissive: '#22d3ee', emissiveIntensity: 0.6, roughness: 0.3 });
    const a = mesh(new THREE.OctahedronGeometry(0.45, 0), mat, 0, 0.8, 0);
    a.scale.y = 2;
    g.add(a);
    const b = mesh(new THREE.OctahedronGeometry(0.25, 0), mat, 0.4, 0.4, 0.15);
    b.scale.y = 1.8;
    b.rotation.z = -0.4;
    g.add(b);
  },
  stump(g) {
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.4, 7), sharedMat('#7a5230'), 0, 0.2, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 7), sharedMat('#d9b77e'), 0, 0.41, 0));
  },
  sign(g) {
    const wood = sharedMat('#8b5e3c');
    g.add(mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), wood, 0, 0.6, 0));
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.45, 0.08), wood, 0, 1.1, 0));
  },
};

export function createPropMesh(prop) {
  const g = new THREE.Group();
  (builders[prop.type] ?? builders.rock)(g, prop);
  g.position.set(prop.x, 0, prop.z);
  g.rotation.y = prop.rotY;
  g.scale.setScalar(prop.scale);
  return g;
}
