// 몬스터 AI (호스트 브라우저에서만 돈다).
// 대기 → 배회 → 추격 → 공격 예고(windup) → 공격 후 경직(recover) → 너무 멀어지면 귀환(체력 회복)
// 공격의 실제 명중 판정은 맞는 쪽 브라우저가 자기 캐릭터로 한다 (monsterManager._updatePending).

import { dampAngle, dirToYaw } from '../core/mathUtils.js';

function moveToward(m, tx, tz, speed, dt, stopDist, world) {
  const dx = tx - m.pos.x;
  const dz = tz - m.pos.z;
  const d = Math.hypot(dx, dz);
  m.yaw = dampAngle(m.yaw, dirToYaw(dx, dz), 10, dt);
  if (d <= stopDist) {
    m.moving = false;
    m.speed = 0;
    return d;
  }
  const step = Math.min(speed * dt, d - stopDist);
  m.pos.x += (dx / d) * step;
  m.pos.z += (dz / d) * step;
  world.resolveCircle(m.pos, m.radius, 1);
  m.moving = step > 0.0001;
  m.speed = speed;
  return d - step;
}

function nearestPlayer(m, players, range) {
  let best = null;
  let bestD = range;
  for (const p of players) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - m.pos.x, p.z - m.pos.z);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function choosePattern(m, target, rng) {
  const centerDist = Math.hypot(target.x - m.pos.x, target.z - m.pos.z);
  const edgeDist = centerDist - target.radius - m.radius;
  const candidates = [];
  m.def.patterns.forEach((p, i) => {
    if (m.patternCd[i] > 0 || p.weight <= 0) return;
    let ok = false;
    if (p.type === 'melee') ok = edgeDist <= p.reach;
    else if (p.type === 'slam') ok = centerDist <= p.radius * 0.85;
    else if (p.type === 'charge') ok = edgeDist >= 2 && centerDist <= p.length * 0.9;
    if (ok) candidates.push(i);
  });
  if (!candidates.length) return -1;
  const total = candidates.reduce((s, i) => s + m.def.patterns[i].weight, 0);
  let r = rng() * total;
  for (const i of candidates) {
    r -= m.def.patterns[i].weight;
    if (r <= 0) return i;
  }
  return candidates[candidates.length - 1];
}

/**
 * @param {import('../entities/monster.js').Monster} m
 * @param {number} dt
 * @param {{players:Array, rng:Function, world:any, onAttack:Function, onRespawn:Function, onReset:Function}} ctx
 */
export function updateMonsterAI(m, dt, ctx) {
  const def = m.def;
  m.stateT += dt;
  m.moving = false;
  m.speed = 0;
  for (let i = 0; i < m.patternCd.length; i++) if (m.patternCd[i] > 0) m.patternCd[i] -= dt;
  if (m.globalCd > 0) m.globalCd -= dt;

  if (m.knock) {
    m.knock.t -= dt;
    m.pos.x += m.knock.x * dt * 8;
    m.pos.z += m.knock.z * dt * 8;
    ctx.world.resolveCircle(m.pos, m.radius, 1);
    if (m.knock.t <= 0) m.knock = null;
  }

  switch (m.state) {
    case 'dead':
      if (m.stateT >= def.respawnSec) ctx.onRespawn(m);
      return;

    case 'windup':
      if (m.stateT >= m.attack.windupSec) {
        m.setState('recover');
        if (m.attack.type === 'charge') m.chargeLeft = m.attack.length;
      }
      return;

    case 'recover': {
      if (m.attack && m.attack.type === 'charge' && m.chargeLeft > 0) {
        const step = Math.min(m.chargeLeft, (m.attack.length / 0.3) * dt);
        m.chargeLeft -= step;
        m.pos.x += Math.sin(m.yaw) * step;
        m.pos.z += Math.cos(m.yaw) * step;
        ctx.world.resolveCircle(m.pos, m.radius, 1);
        m.moving = true;
        m.speed = m.attack.length / 0.3;
      }
      if (m.stateT >= (m.attack ? m.attack.recoverSec : 0.4) + (m.attack && m.attack.type === 'charge' ? 0.3 : 0)) {
        m.attack = null;
        m.setState('chase');
      }
      return;
    }

    case 'return': {
      const d = moveToward(m, m.home.x, m.home.z, def.moveSpeed * 1.6, dt, 0.2, ctx.world);
      if (d <= 0.25) {
        m.hp = def.maxHp;
        m.contributors.clear();
        m.setState('idle');
        ctx.onReset(m);
      }
      return;
    }

    case 'idle':
    case 'wander': {
      const t = nearestPlayer(m, ctx.players, def.aggroRange);
      if (t) {
        m.targetNid = t.nid;
        m.setState('chase');
        return;
      }
      if (m.state === 'idle') {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          const a = ctx.rng() * Math.PI * 2;
          const r = 1 + ctx.rng() * 3;
          m.wanderTarget = { x: m.home.x + Math.cos(a) * r, z: m.home.z + Math.sin(a) * r };
          m.setState('wander');
        }
      } else if (!m.wanderTarget) {
        m.setState('idle');
      } else {
        const d = moveToward(m, m.wanderTarget.x, m.wanderTarget.z, def.moveSpeed * 0.4, dt, 0.1, ctx.world);
        if (d <= 0.15 || m.stateT > 5) {
          m.wanderT = 2 + ctx.rng() * 4;
          m.setState('idle');
        }
      }
      return;
    }

    case 'chase': {
      let target = ctx.players.find((p) => p.nid === m.targetNid && p.alive);
      if (!target) {
        // 원래 대상이 사라지면 근처의 다른 플레이어로
        target = nearestPlayer(m, ctx.players, def.aggroRange);
        m.targetNid = target ? target.nid : null;
      }
      const fromHome = Math.hypot(m.pos.x - m.home.x, m.pos.z - m.home.z);
      if (!target || fromHome > def.leashRange) {
        m.targetNid = null;
        m.setState('return');
        return;
      }
      if (m.globalCd <= 0) {
        const pick = choosePattern(m, target, ctx.rng);
        if (pick >= 0) {
          const pattern = def.patterns[pick];
          m.yaw = dirToYaw(target.x - m.pos.x, target.z - m.pos.z);
          m.attack = pattern;
          m.patternCd[pick] = pattern.cooldownSec;
          m.globalCd = pattern.windupSec + pattern.recoverSec + 0.3;
          m.setState('windup');
          ctx.onAttack(m, pick);
          return;
        }
      }
      const melee = def.patterns.find((p) => p.type === 'melee');
      const stopEdge = melee ? melee.reach * 0.7 : 0.6;
      moveToward(m, target.x, target.z, def.moveSpeed, dt, m.radius + target.radius + stopEdge, ctx.world);
      return;
    }

    default:
      m.setState('idle');
  }
}
