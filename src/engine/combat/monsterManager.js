// 섬의 몬스터 전체를 관리한다.
//  - 호스트(그 섬에 가장 먼저 들어온 사람): AI를 돌리고, 받은 피해를 적용하고, 상태를 모두에게 보낸다.
//  - 나머지: 호스트가 보낸 스냅샷을 보간해서 그리고, 내 공격 피해는 호스트에게 보낸다(화면에는 바로 표시).
//  - 몬스터 공격의 명중 판정은 모두가 "자기 캐릭터"에 대해서만 한다.

import { CONFIG } from '../config.js';
import { clamp, lerp, lerpAngle, round2 } from '../core/mathUtils.js';
import { Monster, MONSTER_STATES, MONSTER_STATE_CODE } from '../entities/monster.js';
import { updateMonsterAI } from './monsterAI.js';
import { hitTest, patternShape } from './shapes.js';
import { computeDamage } from './formula.js';
import { grantKillRewards } from './rewards.js';

export class MonsterManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.isAuthority = true;
    this.pending = []; // 예고 중인 몬스터 공격
    this.interpDelay = 0.25;
    this._lastSnapSig = '';
    this._lastSnapAt = -99;
    this._bossShown = null;
  }

  spawnForIsland(layout) {
    this.clear();
    layout.spawns.forEach((s, i) => {
      const def = this.game.data.getMonster(s.monsterId);
      if (def) this.list.push(new Monster(this.game, i, def, s));
    });
    this._lastSnapSig = '';
  }

  clear() {
    for (const a of this.pending) a.tele.cancel();
    this.pending = [];
    for (const m of this.list) m.dispose();
    this.list = [];
    if (this._bossShown) {
      this._bossShown = null;
      this.game.events.emit('boss:hp', null);
    }
  }

  /** 호스트가 되거나 그만둘 때 */
  setAuthority(isAuthority) {
    if (this.isAuthority === isAuthority) return;
    this.isAuthority = isAuthority;
    for (const m of this.list) {
      m.buffer = [];
      if (isAuthority) {
        // 이전 호스트만 알던 AI 정보(배회 목적지·공격 중인 패턴)는 없으니 이어받을 수 있는 상태로 바꾼다
        if (m.predictedDeadAt !== null) {
          m.predictedDeadAt = null;
          m.hp = m.hostHp;
        }
        m.attack = null;
        m.wanderTarget = null;
        if (m.state === 'dead') m.stateT = 0;
        else if (m.state === 'windup' || m.state === 'recover') m.setState('chase');
        else if (m.state === 'wander') {
          m.wanderT = 0.5 + Math.random() * 2;
          m.setState('idle');
        }
      }
    }
    this._lastSnapSig = '';
  }

  update(dt) {
    const game = this.game;
    const now = game.now;
    const ctx = this.isAuthority ? this._aiContext() : null;
    const playerPos = game.player ? game.player.pos : null;
    for (const m of this.list) {
      if (this.isAuthority) updateMonsterAI(m, dt, ctx);
      else {
        m.stateT += dt;
        this._interpolate(m, now, dt);
      }
      if (m.predictedDeadAt !== null && now - m.predictedDeadAt > CONFIG.combat.predictedDeathTimeoutSec) {
        // 호스트가 처치를 확인해 주지 않았다 → 되살린다
        m.predictedDeadAt = null;
        m.hp = m.hostHp;
        m.model.playSpawn();
      }
      m.updateVisual(dt, playerPos);
    }
    if (this.isAuthority) this._separate();
    this._updatePending(now);
    this._updateBossBar(playerPos);
  }

  _aiContext() {
    const game = this.game;
    const players = [];
    const p = game.player;
    if (p) players.push({ nid: game.net.selfNid, x: p.pos.x, z: p.pos.z, alive: !p.dead && !game.traveling, radius: p.radius });
    for (const r of game.net.remotes.values()) {
      if (r.model.root.visible) players.push({ nid: r.nid, x: r.pos.x, z: r.pos.z, alive: !r.dead, radius: r.radius });
    }
    return {
      players,
      rng: Math.random,
      world: game.world,
      onAttack: (m, i) => this._hostAttack(m, i),
      onRespawn: (m) => this._hostRespawn(m),
      onReset: (m) => this._hostReset(m),
    };
  }

  _separate() {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.state === 'dead') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.state === 'dead') continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const overlap = a.radius + b.radius - d;
        if (overlap > 0 && d > 1e-4) {
          const push = overlap / 2;
          a.pos.x -= (dx / d) * push;
          a.pos.z -= (dz / d) * push;
          b.pos.x += (dx / d) * push;
          b.pos.z += (dz / d) * push;
        }
      }
    }
  }

  _interpolate(m, now, dt) {
    const b = m.buffer;
    if (!b.length) {
      m.moving = false;
      return;
    }
    const rt = now - this.interpDelay;
    let x;
    let z;
    let yaw;
    if (rt <= b[0].t) ({ x, z, yaw } = b[0]);
    else if (rt >= b[b.length - 1].t) ({ x, z, yaw } = b[b.length - 1]);
    else {
      let i = 1;
      while (i < b.length && b[i].t < rt) i++;
      const a = b[i - 1];
      const c = b[i];
      const k = (rt - a.t) / Math.max(1e-4, c.t - a.t);
      x = lerp(a.x, c.x, k);
      z = lerp(a.z, c.z, k);
      yaw = lerpAngle(a.yaw, c.yaw, k);
      if (i > 2) b.splice(0, i - 2);
    }
    const moved = Math.hypot(x - m.pos.x, z - m.pos.z);
    m.speed = dt > 0 ? moved / dt : 0;
    m.moving = m.speed > 0.2;
    m.pos.x = x;
    m.pos.z = z;
    if (m.state !== 'windup') m.yaw = yaw;
  }

  // ---------- 판정 도우미 (내 공격용)

  queryShape(shape, ox, oz, yaw, params) {
    return this.list.filter((m) => m.alive && hitTest(shape, ox, oz, yaw, params, m.pos.x, m.pos.z, m.radius));
  }

  /** 조준 보정: yaw 기준 maxAngle 안에서 가장 가까운 몬스터 */
  findAimTarget(x, z, yaw, reach, maxAngle) {
    let best = null;
    let bestD = Infinity;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    for (const m of this.list) {
      if (!m.alive) continue;
      const dx = m.pos.x - x;
      const dz = m.pos.z - z;
      const d = Math.hypot(dx, dz);
      if (d > reach + m.radius || d < 1e-3) continue;
      const ang = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
      if (ang > maxAngle) continue;
      if (d < bestD) {
        best = m;
        bestD = d;
      }
    }
    return best;
  }

  /** 플레이어가 몬스터를 뚫고 지나가지 않게 */
  pushOut(pos, radius) {
    for (const m of this.list) {
      if (!m.alive) continue;
      const dx = pos.x - m.pos.x;
      const dz = pos.z - m.pos.z;
      const d = Math.hypot(dx, dz);
      const min = radius + m.radius * 0.9;
      if (d < min && d > 1e-4 && pos.y < m.model.height) {
        pos.x = m.pos.x + (dx / d) * min;
        pos.z = m.pos.z + (dz / d) * min;
      }
    }
  }

  // ---------- 피해 처리

  /** 내가 때렸다 (화면엔 바로 보이고, 호스트가 아니면 호스트에게 보낸다) */
  applyLocalHit(m, damage, crit, kx, kz) {
    const game = this.game;
    game.damageText.spawn({ x: m.pos.x, y: m.pos.y + m.model.height, z: m.pos.z }, damage, crit ? 'crit' : 'dealt');
    game.fx.hit({ x: m.pos.x, y: m.pos.y + m.model.height * 0.5, z: m.pos.z, color: crit ? '#fbbf24' : '#ffffff', size: 0.35 * m.def.size + 0.15 });
    m.model.flash('#ffffff', 0.1);
    m.lastLocalHitAt = game.now;
    if (this.isAuthority) {
      this.applyDamage(m, damage, game.net.selfNid, kx, kz);
    } else {
      m.hp = Math.max(0, m.hp - damage);
      if (m.hp <= 0 && m.predictedDeadAt === null) m.predictedDeadAt = game.now;
      game.net.queueHit(m.idx, damage, crit ? 1 : 0, round2(kx), round2(kz));
      this._emitHp(m);
    }
  }

  /** 호스트 전용: 다른 사람이 보낸 피해 */
  applyNetHit(idx, damage, kx, kz, fromNid) {
    const m = this.list[idx];
    if (!m || !Number.isFinite(damage)) return;
    const dmg = clamp(Math.round(damage), 0, 1e7);
    m.model.flash('#ffffff', 0.08);
    this.applyDamage(m, dmg, fromNid, Number(kx) || 0, Number(kz) || 0);
  }

  /** 호스트 전용: 실제 체력 감소 */
  applyDamage(m, damage, fromNid, kx, kz) {
    if (m.state === 'dead' || m.state === 'return') return; // 귀환 중에는 무적
    m.hp = Math.max(0, m.hp - damage);
    m.contributors.set(fromNid, this.game.now);
    if (m.state === 'idle' || m.state === 'wander' || !m.targetNid) {
      m.targetNid = fromNid;
      if (m.state === 'idle' || m.state === 'wander') m.setState('chase');
    }
    if (!m.def.isBoss && (kx || kz)) m.knock = { x: kx, z: kz, t: 0.12 };
    this._emitHp(m);
    if (m.hp <= 0) this._hostKill(m);
  }

  _hostKill(m) {
    const now = this.game.now;
    const killers = [...m.contributors].filter(([, t]) => now - t <= CONFIG.combat.contributionSec).map(([nid]) => nid);
    m.contributors.clear();
    this.game.net.queueEvent(['d', m.idx, killers]);
    this._onDeath(m, killers);
  }

  _onDeath(m, killers) {
    m.hp = 0;
    m.predictedDeadAt = null;
    m.attack = null;
    m.targetNid = null;
    m.knock = null;
    m.setState('dead');
    this._cancelPending(m);
    this._emitHp(m);
    this.game.events.emit('monster:died', { idx: m.idx, monsterId: m.def.id, isBoss: m.def.isBoss });
    if (killers.includes(this.game.net.selfNid)) grantKillRewards(this.game, m.def);
  }

  _hostAttack(m, patternIndex) {
    this.game.net.queueEvent(['a', m.idx, patternIndex, round2(m.pos.x), round2(m.pos.z), round2(m.yaw)]);
    this._startPendingAttack(m, patternIndex, m.pos.x, m.pos.z, m.yaw);
  }

  _hostRespawn(m) {
    this._respawn(m);
    this.game.net.queueEvent(['r', m.idx]);
  }

  _hostReset(m) {
    this._emitHp(m);
    this.game.net.queueEvent(['z', m.idx]);
  }

  _respawn(m) {
    m.hp = m.def.maxHp;
    m.hostHp = m.def.maxHp;
    m.pos.set(m.home.x, 0, m.home.z);
    m.buffer = [];
    m.predictedDeadAt = null;
    m.attack = null;
    m.targetNid = null;
    m.setState('idle');
    m.model.playSpawn();
    this._emitHp(m);
  }

  // ---------- 몬스터 공격 (예고 → 판정)

  _startPendingAttack(m, patternIndex, x, z, yaw) {
    const pattern = m.def.patterns[patternIndex];
    if (!pattern) return;
    m.attack = pattern;
    const { shape, params } = patternShape(pattern, m.radius);
    const tele = this.game.fx.telegraph({
      shape,
      params,
      x,
      z,
      yaw,
      duration: pattern.windupSec,
      color: m.def.isBoss ? '#f43f5e' : '#ef4444',
    });
    this.pending.push({ m, pattern, shape, params, x, z, yaw, resolveAt: this.game.now + pattern.windupSec, tele });
  }

  _cancelPending(m) {
    this.pending = this.pending.filter((a) => {
      if (a.m !== m) return true;
      a.tele.cancel();
      return false;
    });
  }

  _updatePending(now) {
    const game = this.game;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const a = this.pending[i];
      if (now < a.resolveAt) continue;
      this.pending.splice(i, 1);
      a.tele.finish();
      if (a.pattern.type === 'slam') game.fx.burst({ x: a.x, z: a.z, radius: a.params.range, color: '#fca5a5' });
      const p = game.player;
      if (!p || p.dead || game.traveling) continue;
      if (a.pattern.type === 'slam' && p.pos.y > 0.9) continue; // 점프로 충격파를 넘었다
      if (!hitTest(a.shape, a.x, a.z, a.yaw, a.params, p.pos.x, p.pos.z, p.radius)) continue;
      const { damage } = computeDamage({
        attack: a.m.def.attack,
        multiplier: a.pattern.damageMultiplier,
        defense: game.character.stats.defense,
        critRate: 0,
      });
      p.takeDamage(damage, { fromX: a.x, fromZ: a.z, sourceName: a.m.def.name });
    }
  }

  // ---------- 네트워크 (호스트 → 다른 사람)

  /** 호스트가 보낼 상태. 바뀐 게 없으면 null (가끔은 그래도 보낸다) */
  getSnapshot(force = false) {
    const arr = this.list.map((m) => [m.idx, round2(m.pos.x), round2(m.pos.z), round2(m.yaw), Math.round(m.hp), MONSTER_STATE_CODE[m.state]]);
    const sig = JSON.stringify(arr);
    const now = this.game.now;
    if (!force && sig === this._lastSnapSig && now - this._lastSnapAt < CONFIG.net.snapshotKeepaliveMs / 1000) return null;
    this._lastSnapSig = sig;
    this._lastSnapAt = now;
    return arr;
  }

  /** 호스트가 보낸 사건: ['a', 공격] ['d', 죽음] ['r', 부활] ['z', 귀환 후 회복] */
  applyEvent(ev) {
    const [type, idx] = ev;
    const m = this.list[idx];
    if (!m) return;
    if (type === 'a') {
      const [, , pi, x, z, yaw] = ev;
      m.yaw = yaw;
      m.setState('windup');
      this._startPendingAttack(m, pi, x, z, yaw);
    } else if (type === 'd') {
      this._onDeath(m, Array.isArray(ev[2]) ? ev[2] : []);
    } else if (type === 'r') {
      this._respawn(m);
    } else if (type === 'z') {
      m.hp = m.def.maxHp;
      m.hostHp = m.def.maxHp;
      this._emitHp(m);
    }
  }

  applySnapshot(arr, now, intervalMs) {
    this.interpDelay = Math.min(1.2, ((intervalMs || 150) / 1000) * 1.4 + 0.06);
    for (const row of arr) {
      const [idx, x, z, yaw, hp, code] = row;
      const m = this.list[idx];
      if (!m) continue;
      const st = MONSTER_STATES[code] ?? 'idle';
      m.hostHp = hp;
      if (st === 'dead') {
        if (m.state !== 'dead') {
          m.hp = 0;
          m.predictedDeadAt = null;
          m.setState('dead');
          this._cancelPending(m);
        }
        continue;
      }
      if (m.state === 'dead') {
        // 부활 사건을 못 받았어도 스냅샷이 살아 있으면 살린다
        this._respawn(m);
        m.pos.set(x, 0, z);
      }
      if (m.predictedDeadAt === null) {
        m.hp = now - m.lastLocalHitAt < 1.5 ? Math.min(m.hp, hp) : hp;
        const keepWindup = m.state === 'windup' && m.attack && m.stateT < m.attack.windupSec;
        if (!keepWindup) m.setState(st);
      }
      const last = m.buffer[m.buffer.length - 1];
      if (last && now - last.t > this.interpDelay * 2.5) m.buffer.push({ ...last, t: now - this.interpDelay });
      m.buffer.push({ t: now, x, z, yaw });
      if (m.buffer.length > 30) m.buffer.splice(0, m.buffer.length - 30);
    }
  }

  // ---------- UI 이벤트

  _emitHp(m) {
    this.game.events.emit('monster:hp', {
      idx: m.idx,
      monsterId: m.def.id,
      name: m.def.name,
      hp: Math.max(0, Math.round(m.hp)),
      maxHp: m.def.maxHp,
      isBoss: m.def.isBoss,
    });
  }

  /** 근처 보스가 싸움 중이면 'boss:hp'로 알려 준다 (HUD 상단 보스 체력바용) */
  _updateBossBar(playerPos) {
    let boss = null;
    if (playerPos) {
      for (const m of this.list) {
        if (!m.def.isBoss || m.state === 'dead') continue;
        const engaged = m.hp < m.def.maxHp || m.state === 'chase' || m.state === 'windup' || m.state === 'recover';
        if (engaged && Math.hypot(m.pos.x - playerPos.x, m.pos.z - playerPos.z) < 35) {
          boss = m;
          break;
        }
      }
    }
    const info = boss ? { idx: boss.idx, monsterId: boss.def.id, name: boss.def.name, hp: Math.max(0, Math.round(boss.hp)), maxHp: boss.def.maxHp } : null;
    const sig = info ? `${info.idx}:${info.hp}` : null;
    if (sig !== this._bossShown) {
      this._bossShown = sig;
      this.game.events.emit('boss:hp', info);
    }
  }
}
