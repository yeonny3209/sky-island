// 로우폴리 재질 캐시와 메모리 정리 도우미.
// 공용 재질(userData.shared)은 섬을 바꿔도 지우지 않고 계속 쓴다.

import * as THREE from 'three';

const cache = new Map();

/** 같은 색이면 같은 재질을 돌려준다 (소품·지형용). 깜빡임 효과가 필요한 캐릭터·몬스터는 쓰지 않는다. */
export function sharedMat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  let mat = cache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...opts });
    mat.userData.shared = true;
    cache.set(key, mat);
  }
  return mat;
}

/** 개체마다 따로 쓰는 재질 (맞으면 번쩍이는 효과 등) */
export function ownMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...opts });
}

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
shadowMat.userData.shared = true;
const shadowGeo = new THREE.CircleGeometry(0.5, 18);
shadowGeo.rotateX(-Math.PI / 2);
shadowGeo.userData.shared = true;

/** 캐릭터 발밑의 동그란 그림자 (그림자 맵 없이 가볍게) */
export function createBlobShadow(radius = 0.5) {
  const mesh = new THREE.Mesh(shadowGeo, shadowMat);
  mesh.scale.setScalar(radius / 0.5);
  mesh.position.y = 0.03;
  mesh.renderOrder = 1;
  return mesh;
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry && !obj.geometry.userData.shared) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) if (!m.userData.shared) m.dispose();
  });
}

/** 정점 위치를 기준으로 항상 같은 흔들림을 준다 (이음새가 벌어지지 않게) */
export function positionNoise(x, y, z, seed = 0) {
  const k = `${Math.round(x * 20)},${Math.round(y * 20)},${Math.round(z * 20)},${seed}`;
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
