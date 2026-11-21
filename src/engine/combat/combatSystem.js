// 내 캐릭터의 공격·스킬: 입력 → 조준 → 시전(모션) → 판정 → 피해.
// 슬롯 0 = 평타, 1~3 = 직업 스킬 (data/skills.json, data/classes.json).
// 판정은 내 브라우저에서 한다 (기획서의 "전투 판정은 각자 브라우저에서").

import { CONFIG } from '../config.js';
import { dirToYaw } from '../core/mathUtils.js';
import { computeDamage } from './formula.js';
import { SLOT_ACTIONS } from '../input/bindings.js';

const DEG = Math.PI / 180;

export class CombatSystem {
  constructor(game) {
    this.game = game;
    this.slots = [];
    this.cooldowns = [];
    this.cast = null;
    this.buffered = null;
  }

  setupForClass(classDef) {
    const data = this.game.data;
    this.slots = [classDef.basicAttack, ...classDef.skills.map((id) => data.getSkill(id)).filter(Boolean)];
    this.cooldowns = this.slots.map(() => 0);
    this.cast = null;
    this.buffered = null;
    this.game.events.emit('skills:changed', { slots: this.getSlots() });
  }

  get isCasting() {
    return !!this.cast;
  }

  cancel() {
    this.cast = null;
    this.buffered = null;
    if (this.game.player) this.game.player.casting = false;
  }

  /** UI 버튼에서 슬롯 사용 */
  useSlot(slot) {
    this._request(slot, true);
  }

  update(dt) {
    for (let i = 0; i < this.cooldowns.length; i++) if (this.cooldowns[i] > 0) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    const game = this.game;
    const player = game.player;
    const input = game.input;
    if (!player || player.dead || game.traveling) {
      if (this.cast) this.cancel();
      for (const a of SLOT_ACTIONS) input.consumePressed(a);
      return;
    }

    for (let s = 1; s < SLOT_ACTIONS.length; s++) if (input.consumePressed(SLOT_ACTIONS[s])) this._request(s, true);
    if (input.consumePressed('attack')) this._request(0, true);
    else if (input.isHeld('attack') && !this.cast) this._request(0, false);

    const c = this.cast;
    if (!c) return;
    c.t += dt;
    const sk = c.skill;
    while (c.hitIndex < sk.hits && c.t >= sk.castSec + c.hitIndex * sk.hitIntervalSec) {
      this._resolveHit(c);
      c.hitIndex += 1;
    }
    if (c.t >= sk.totalSec) {
      this.cast = null;
      player.casting = false;
      const b = this.buffered;
      this.buffered = null;
      if (b && game.now - b.at <= CONFIG.combat.inputBufferSec + sk.totalSec) this._tryUse(b.slot);
    }
  }

  _request(slot, explicit) {
    if (!this.slots[slot]) return;
    if (this.cast) {
      if (explicit) this.buffered = { slot, at: this.game.now };
      return;
    }
    this._tryUse(slot);
  }

  _tryUse(slot) {
    const game = this.game;
    const player = game.player;
    const skill = this.slots[slot];
    if (!skill || !player || player.dead || game.traveling) return false;
    if (this.cooldowns[slot] > 0) return false;
    const yaw = this._aimYaw(skill);
    this.cast = { slot, skill, t: 0, yaw, hitIndex: 0, startX: player.pos.x, startZ: player.pos.z };
    player.casting = true;
    player.castYaw = yaw;
    player.yaw = yaw;
    this.cooldowns[slot] = Math.max(skill.cooldownSec, slot === 0 ? skill.totalSec * 0.9 : 0);
    if (skill.dashDistance > 0) player.startDash(yaw, skill.dashDistance, Math.max(0.08, skill.castSec));
    player.model.playAttack(skill.anim, skill.castSec, skill.totalSec);
    game.net.queueAction(slot, skill.id, yaw);
    game.events.emit('skill:used', { slot, skillId: skill.id, name: skill.name, cooldownSec: this.cooldowns[slot] });
    return true;
  }

  /**
   * 조준 방향: 쿼터뷰+마우스면 커서 쪽, 3인칭이면 카메라 정면, 그 외엔 이동/바라보는 방향.
   * 그 뒤 그 방향 근처(aimAssistDeg)의 가장 가까운 몬스터 쪽으로 보정한다.
   * 이동 중도 마우스 조준도 아니면(서서 J, 폰에서 조이스틱 없이 공격) 근처에 없을 때 뒤쪽이라도 가장 가까운 몬스터를 친다.
   */
  _aimYaw(skill) {
    const game = this.game;
    const p = game.player;
    const input = game.input;
    const cam = game.cameraRig;
    let yaw = p.moveYaw ?? p.yaw;
    let deliberate = p.moveYaw != null;
    const usingMouse = input.lastDevice !== 'touch' && input.pointer.type === 'mouse' && input.pointer.inside;
    if (cam.mode === 'third' && input.lastDevice !== 'touch') {
      yaw = cam.forwardYaw;
    } else if (usingMouse) {
      const g = cam.screenToGround(input.pointer.ndcX, input.pointer.ndcY, 0);
      if (g) {
        const dx = g.x - p.pos.x;
        const dz = g.z - p.pos.z;
        if (dx * dx + dz * dz > 0.04) {
          yaw = dirToYaw(dx, dz);
          deliberate = true;
        }
      }
    }
    if (skill.shape === 'circle') return yaw;
    const c = CONFIG.combat;
    const reach = skill.range + skill.dashDistance + c.aimAssistExtraRange;
    const cone = (input.lastDevice === 'touch' ? c.aimAssistTouchDeg : c.aimAssistDeg) * DEG;
    let target = game.monsters.findAimTarget(p.pos.x, p.pos.z, yaw, reach, cone);
    if (!target && !deliberate) target = game.monsters.findAimTarget(p.pos.x, p.pos.z, yaw, reach, c.aimAssistIdleDeg * DEG);
    if (target) yaw = dirToYaw(target.pos.x - p.pos.x, target.pos.z - p.pos.z);
    return yaw;
  }

  _resolveHit(c) {
    const game = this.game;
    const sk = c.skill;
    const p = game.player;
    const stats = game.character.stats;
    const dashLine = sk.dashDistance > 0 && sk.shape === 'line';
    const ox = dashLine ? c.startX : p.pos.x;
    const oz = dashLine ? c.startZ : p.pos.z;
    const params = { range: sk.range + (dashLine ? sk.dashDistance : 0), angleDeg: sk.angleDeg, width: sk.width };

    if (sk.shape === 'circle') game.fx.burst({ x: ox, z: oz, radius: params.range, color: sk.color });
    else if (sk.shape === 'line') game.fx.thrust({ x: ox, z: oz, yaw: c.yaw, length: params.range, width: sk.width, color: sk.color });
    else game.fx.slash({ x: ox, z: oz, yaw: c.yaw, range: params.range, angleDeg: sk.angleDeg, color: sk.color });

    const targets = game.monsters.queryShape(sk.shape, ox, oz, c.yaw, params);
    for (const m of targets) {
      const { damage, crit } = computeDamage({
        attack: stats.attack,
        multiplier: sk.damageMultiplier,
        defense: m.def.defense,
        critRate: stats.critRate,
        critDamage: stats.critDamage,
      });
      let kx = m.pos.x - ox;
      let kz = m.pos.z - oz;
      const d = Math.hypot(kx, kz);
      if (d > 1e-3) {
        kx = (kx / d) * sk.knockback;
        kz = (kz / d) * sk.knockback;
      } else {
        kx = Math.sin(c.yaw) * sk.knockback;
        kz = Math.cos(c.yaw) * sk.knockback;
      }
      game.monsters.applyLocalHit(m, damage, crit, kx, kz);
    }
    if (targets.length) game.events.emit('combat:hit', { skillId: sk.id, targets: targets.length });
  }

  /** UI용 슬롯 정보 */
  getSlots() {
    const bindings = this.game.input ? this.game.input.bindings : {};
    return this.slots.map((s, i) => ({
      slot: i,
      skillId: s.id,
      name: s.name,
      description: s.description ?? '',
      cooldown: this.cooldowns[i] ?? 0,
      cooldownTotal: s.cooldownSec,
      keys: (bindings[SLOT_ACTIONS[i]] ?? []).slice(),
    }));
  }
}
