// 수학 도우미. three.js 없이 쓰는 순수 함수만 둔다.
// 방향 규칙: yaw 0 = +Z 방향, 방향 벡터 = (sin yaw, cos yaw). three.js의 rotation.y와 같다.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** 프레임 속도와 무관하게 부드럽게 따라가기 */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function wrapAngle(a) {
  const TWO_PI = Math.PI * 2;
  a = (a + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

export const angleDiff = (from, to) => wrapAngle(to - from);
export const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;
export const dampAngle = (a, b, lambda, dt) => a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));

export const yawToDir = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
export const dirToYaw = (x, z) => Math.atan2(x, z);
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const round2 = (v) => Math.round(v * 100) / 100;

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInQuad = (t) => t * t;
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 시드가 같으면 모든 브라우저에서 같은 순서의 난수가 나온다 (섬 배치·몬스터 스폰 위치 일치용). */
export function createRng(seed) {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randRange = (rng, a, b) => a + (b - a) * rng();
export const randInt = (rng, a, b) => Math.floor(randRange(rng, a, b + 1));

/** 짧은 무작위 id (접속마다 새로 만드는 네트워크 id 등) */
export function uid(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let s = '';
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}
