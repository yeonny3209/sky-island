// 섬 배치(포탈·소품·몬스터 스폰 위치)를 계산한다.
// 섬 데이터에 props / spawns / portals가 있으면 그대로 쓰고, 없으면 섬 id를 시드로 자동 배치한다.
// 시드가 같으면 모든 브라우저에서 같은 배치가 나오므로 멀티플레이에서 몬스터 번호가 서로 맞는다.
// three.js 없는 순수 함수.

import { createRng, randRange, dirToYaw } from '../core/mathUtils.js';

/** 엔진이 그릴 수 있는 소품 종류와 충돌 반지름 (0이면 통과 가능) */
export const PROP_TYPES = {
  tree: 0.55,
  pine: 0.5,
  rock: 0.8,
  bush: 0,
  flower: 0,
  house: 2.4,
  lamp: 0.2,
  well: 1.1,
  crystal: 0.45,
  stump: 0.35,
  sign: 0.15,
};

function clear(x, z, obstacles, gap) {
  for (const o of obstacles) {
    if (Math.hypot(o.x - x, o.z - z) < o.r + gap) return false;
  }
  return true;
}

function placeInRing(rng, minR, maxR, obstacles, gap, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(randRange(rng, minR * minR, maxR * maxR));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (clear(x, z, obstacles, gap)) return { x, z };
  }
  return null;
}

function buildPortals(island, data) {
  const R = island.radius;
  const known = (id) => data.islands.has(id) && id !== island.id;
  if (island.portals) {
    return island.portals
      .filter((p) => known(p.to))
      .map((p) => ({ to: p.to, x: Number(p.x) || 0, z: Number(p.z) || 0 }))
      .map((p) => ({ ...p, yaw: dirToYaw(-p.x, -p.z) }));
  }
  const targets = [];
  const add = (to) => {
    if (to && known(to) && !targets.includes(to)) targets.push(to);
  };
  const back = island.type !== 'hub' ? island.returnTo : null;
  add(back);
  island.connectsTo.forEach(add);
  add(island.unlocksIsland);

  const r = R - 2.5;
  const out = [];
  if (back && targets.includes(back)) out.push({ to: back, x: 0, z: r }); // 돌아가는 포탈은 남쪽(+Z)
  const others = targets.filter((t) => t !== back);
  others.forEach((to, i) => {
    const a = -Math.PI / 2 + (i - (others.length - 1) / 2) * (Math.PI / 4.5); // 북쪽(-Z)부터 부채꼴로
    out.push({ to, x: Math.cos(a) * r, z: Math.sin(a) * r });
  });
  return out.map((p) => ({ ...p, yaw: dirToYaw(-p.x, -p.z) })); // 섬 중심을 바라본다
}

function normalizeProp(p) {
  const type = PROP_TYPES[p.type] !== undefined ? p.type : 'rock';
  const scale = Number(p.scale) > 0 ? Number(p.scale) : 1;
  return {
    type,
    x: Number(p.x) || 0,
    z: Number(p.z) || 0,
    scale,
    rotY: Number(p.rotY) || 0,
    radius: PROP_TYPES[type] * scale,
  };
}

function makeProp(rng, type, x, z, scaleMin = 0.85, scaleMax = 1.25, rotY = null) {
  const scale = randRange(rng, scaleMin, scaleMax);
  return { type, x, z, scale, rotY: rotY ?? rng() * Math.PI * 2, radius: PROP_TYPES[type] * scale };
}

function generateProps(island, rng, spawn, portals, bossSpawn) {
  const R = island.radius;
  const props = [];
  const obstacles = [
    { x: spawn.x, z: spawn.z, r: island.type === 'hub' ? 3 : 5 },
    ...portals.map((p) => ({ x: p.x, z: p.z, r: 3.5 })),
    ...island.npcs.map((n) => ({ x: n.x, z: n.z, r: 1.5 })),
  ];
  if (bossSpawn) obstacles.push({ x: bossSpawn.x, z: bossSpawn.z, r: 6 });
  const addProp = (prop) => {
    props.push(prop);
    if (prop.radius > 0) obstacles.push({ x: prop.x, z: prop.z, r: prop.radius });
  };
  const scatter = (type, count, minR, maxR, gap, sMin, sMax) => {
    for (let i = 0; i < count; i++) {
      const pos = placeInRing(rng, minR, maxR, obstacles, gap);
      if (pos) addProp(makeProp(rng, type, pos.x, pos.z, sMin, sMax));
    }
  };

  if (island.type === 'hub') {
    // 집 4채 (대각선), 우물, 포탈 가는 길의 가로등
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const x = Math.cos(a) * R * 0.55;
      const z = Math.sin(a) * R * 0.55;
      if (clear(x, z, obstacles, 2.6)) addProp(makeProp(rng, 'house', x, z, 1, 1, dirToYaw(-x, -z)));
    }
    if (clear(0, R * 0.3, obstacles, 1)) addProp(makeProp(rng, 'well', 0, R * 0.3, 1, 1, 0));
    for (const p of portals) {
      const a = Math.atan2(p.z, p.x);
      for (const side of [-1, 1]) {
        const la = a + side * 0.2;
        const x = Math.cos(la) * R * 0.5;
        const z = Math.sin(la) * R * 0.5;
        if (clear(x, z, obstacles, 0.5)) addProp(makeProp(rng, 'lamp', x, z, 1, 1, 0));
      }
    }
    scatter('tree', 12, R * 0.74, R * 0.93, 1.4, 0.9, 1.3);
    scatter('flower', 14, R * 0.25, R * 0.9, 0.4, 0.8, 1.2);
    scatter('bush', 6, R * 0.6, R * 0.92, 0.8, 0.8, 1.2);
  } else {
    scatter('tree', Math.round(R * 0.4), 5, R - 1.2, 1.8, 0.85, 1.35);
    scatter('pine', Math.round(R * 0.2), 5, R - 1.2, 1.8, 0.85, 1.3);
    scatter('rock', Math.round(R * 0.35), 4, R - 1, 1.6, 0.6, 1.4);
    scatter('bush', Math.round(R * 0.4), 3, R - 0.8, 0.6, 0.7, 1.2);
    scatter('flower', Math.round(R * 0.4), 3, R - 0.8, 0.3, 0.7, 1.1);
    scatter('crystal', 3, R * 0.5, R - 1.5, 2, 0.8, 1.4);
    scatter('stump', 3, 4, R - 1.5, 1.5, 0.8, 1.2);
  }
  return props;
}

function buildSpawns(island, rng, spawn, portals, colliders, bossSpawn) {
  const R = island.radius;
  const out = [];
  const obstacles = [
    { x: spawn.x, z: spawn.z, r: 7 },
    // 포탈로 도착하자마자 몬스터에게 걸리지 않도록 포탈 주변(도착 지점 + 어그로 거리)은 비워 둔다
    ...portals.map((p) => ({ x: p.x, z: p.z, r: 10 })),
    ...colliders.map((c) => ({ x: c.x, z: c.z, r: c.r + 0.8 })),
  ];
  if (bossSpawn) obstacles.push({ x: bossSpawn.x, z: bossSpawn.z, r: 5 });

  const push = (monsterId, x, z, isBoss = false) => {
    out.push({ monsterId, x, z, isBoss });
    obstacles.push({ x, z, r: 1.6 });
  };

  if (island.spawns) {
    for (const s of island.spawns) {
      const count = Math.max(1, Math.round(Number(s.count) || 1));
      const cx = Number(s.x) || 0;
      const cz = Number(s.z) || 0;
      const area = Number(s.radius) || 0;
      for (let i = 0; i < count; i++) {
        if (area > 0) {
          const a = rng() * Math.PI * 2;
          const r = Math.sqrt(rng()) * area;
          push(s.monsterId, cx + Math.cos(a) * r, cz + Math.sin(a) * r);
        } else push(s.monsterId, cx, cz);
      }
    }
  } else {
    for (const monsterId of island.monsters) {
      for (let i = 0; i < island.monsterCountEach; i++) {
        const pos = placeInRing(rng, 6, R - 2.5, obstacles, 0) ?? placeInRing(rng, 4, R - 1.5, [], 0);
        push(monsterId, pos.x, pos.z);
      }
    }
  }
  if (island.boss && bossSpawn) out.push({ monsterId: island.boss, x: bossSpawn.x, z: bossSpawn.z, isBoss: true });
  return out;
}

/**
 * @returns {{ radius:number, spawn:{x:number,y:number,z:number}, portals:Array, props:Array, colliders:Array, spawns:Array, npcs:Array }}
 */
export function buildIslandLayout(island, data) {
  const rng = createRng(`layout:${island.id}`);
  const spawn = { ...island.spawnPoint };
  const portals = buildPortals(island, data);
  const bossSpawn = island.boss ? island.bossSpawn ?? { x: 0, z: -island.radius * 0.55 } : null;
  const props = island.props ? island.props.map(normalizeProp) : generateProps(island, rng, spawn, portals, bossSpawn);
  const colliders = props.filter((p) => p.radius > 0).map((p) => ({ x: p.x, z: p.z, r: p.radius }));
  for (const n of island.npcs) colliders.push({ x: n.x, z: n.z, r: 0.45 });
  const spawns = buildSpawns(island, rng, spawn, portals, colliders, bossSpawn);
  return { radius: island.radius, spawn, portals, props, colliders, spawns, npcs: island.npcs };
}
