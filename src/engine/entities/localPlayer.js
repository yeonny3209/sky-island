// 내 캐릭터: 이동·점프·충돌·피격·사망·부활.
// 저장되는 정보(레벨·장비 등)는 save/character.js, 여기는 화면 속 실시간 상태만 다룬다.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { damp, dampAngle, dirToYaw } from '../core/mathUtils.js';
import { CharacterModel } from './characterModel.js';

/** 네트워크로 보내는 상태 번호 */
export const PLAYER_STATE = { idle: 0, run: 1, jump: 2, attack: 3, dead: 4 };

export class LocalPlayer {
  constructor(game, character) {
    this.game = game;
    this.character = character;
    this.model = new CharacterModel({ color: character.appearance.color });
    game.scene.add(this.model.root);
    this.pos = this.model.root.position;
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.grounded = true;
    this.radius = CONFIG.player.radius;
    this.hp = character.stats.maxHp;
    this.dead = false;
    this.deadT = 0;
    this.invulnT = 0;
    this.casting = false;
    this.dash = null;
    this.label = game.labels.create({ text: '', color: '#bfdbfe', offsetY: 2.35 }).follow(this.model.root);
    this.refreshLabel();
    this.refreshWeapon();

    this._offs = [
      game.events.on('player:stats', () => {
        this.hp = Math.min(this.hp, this.maxHp);
        this._emitHp();
      }),
      game.events.on('player:levelUp', () => {
        this.hp = this.maxHp;
        this._emitHp();
        this.refreshLabel();
        game.fx.levelUp(this.model.root);
        game.damageText.spawn({ x: this.pos.x, y: this.pos.y + 2.3, z: this.pos.z }, `레벨 ${character.level}!`, 'level');
      }),
      game.events.on('equipment:changed', () => this.refreshWeapon()),
    ];
  }

  get maxHp() {
    return this.character.stats.maxHp;
  }

  get stateCode() {
    if (this.dead) return PLAYER_STATE.dead;
    if (this.casting) return PLAYER_STATE.attack;
    if (!this.grounded) return PLAYER_STATE.jump;
    if (Math.hypot(this.vel.x, this.vel.z) > 0.3) return PLAYER_STATE.run;
    return PLAYER_STATE.idle;
  }

  refreshLabel() {
    this.label.setText(`Lv.${this.character.level} ${this.character.name}`);
  }

  refreshWeapon() {
    const weaponId = this.character.equipment.weapon;
    this.model.setWeapon(weaponId ? this.game.data.getItem(weaponId) : null);
  }

  teleport(x, y, z, yaw = this.yaw) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.model.root.rotation.y = yaw;
    this.grounded = y <= 0.001;
    this.dash = null;
  }

  /** 스킬 돌진: duration 동안 yaw 방향으로 distance만큼 */
  startDash(yaw, distance, duration) {
    this.dash = { x: Math.sin(yaw), z: Math.cos(yaw), speed: distance / duration, t: duration };
  }

  update(dt) {
    const game = this.game;
    const input = game.input;
    const P = CONFIG.player;

    if (this.dead) {
      this.deadT += dt;
      if (this.deadT >= P.respawnSec) this.respawn();
    }
    this.invulnT = Math.max(0, this.invulnT - dt);

    // 입력 → 월드 방향 (카메라 기준)
    let ix = input.move.x;
    let iy = input.move.y;
    if (this.dead || game.traveling) {
      ix = 0;
      iy = 0;
    }
    const camYaw = game.cameraRig.yaw;
    const wx = Math.cos(camYaw) * ix - Math.sin(camYaw) * iy;
    const wz = -Math.sin(camYaw) * ix - Math.cos(camYaw) * iy;
    this.moveYaw = Math.hypot(wx, wz) > 0.2 ? dirToYaw(wx, wz) : null;
    const speed = this.character.stats.moveSpeed * (this.casting ? P.castMoveFactor : 1);

    if (this.dash && this.dash.t > 0) {
      this.dash.t -= dt;
      this.vel.x = this.dash.x * this.dash.speed;
      this.vel.z = this.dash.z * this.dash.speed;
      if (this.dash.t <= 0) this.dash = null;
    } else {
      this.vel.x = damp(this.vel.x, wx * speed, 14, dt);
      this.vel.z = damp(this.vel.z, wz * speed, 14, dt);
    }

    if (input.consumePressed('jump') && this.grounded && !this.dead && !game.traveling) {
      this.vel.y = P.jumpSpeed;
      this.grounded = false;
    }
    this.vel.y -= P.gravity * dt;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;

    const world = game.world;
    if (world.isOnIsland(this.pos.x, this.pos.z) && this.pos.y <= 0 && this.vel.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.grounded = true;
    }
    world.resolveCircle(this.pos, this.radius);
    game.monsters.pushOut(this.pos, this.radius);
    if (this.pos.y < P.fallLimitY) {
      const s = world.spawnPosition();
      this.teleport(s.x, s.y, s.z, s.yaw);
    }

    // 몸 방향: 시전 중이면 조준 방향, 아니면 이동 방향
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (!this.dead) {
      if (this.casting && this.castYaw != null) this.yaw = dampAngle(this.yaw, this.castYaw, 30, dt);
      else if (hSpeed > 0.5) this.yaw = dampAngle(this.yaw, dirToYaw(this.vel.x, this.vel.z), P.turnSpeed, dt);
    }
    this.model.root.rotation.y = this.yaw;
    this.model.update(dt, { speed: this.dead ? 0 : hSpeed, grounded: this.grounded, dead: this.dead });
    this.model.setOpacity(this.invulnT > 0 && !this.dead && Math.floor(this.invulnT * 12) % 2 === 0 ? 0.55 : 1);
  }

  /**
   * 피해 받기 (몬스터 공격 판정은 각자 자기 캐릭터만 한다)
   * @returns {boolean} 실제로 맞았으면 true
   */
  takeDamage(amount, { fromX = null, fromZ = null, sourceName = '' } = {}) {
    if (this.dead || this.invulnT > 0 || this.game.traveling) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnT = CONFIG.player.invulnSec;
    this.model.flash('#ff3b3b', 0.18);
    this.game.damageText.spawn({ x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, amount, 'taken');
    if (fromX !== null) {
      const dx = this.pos.x - fromX;
      const dz = this.pos.z - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      this.vel.x += (dx / d) * 6;
      this.vel.z += (dz / d) * 6;
    }
    this.game.events.emit('player:damaged', { amount, sourceName, hp: this.hp, maxHp: this.maxHp });
    this._emitHp();
    if (this.hp <= 0) this.die(sourceName);
    return true;
  }

  heal(amount) {
    if (this.dead || amount <= 0) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const healed = Math.round(this.hp - before);
    if (healed > 0) this.game.damageText.spawn({ x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, `+${healed}`, 'heal');
    this._emitHp();
  }

  die(sourceName = '') {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.casting = false;
    this.dash = null;
    this.game.combat.cancel();
    this.game.events.emit('player:died', { respawnSec: CONFIG.player.respawnSec, sourceName });
  }

  respawn() {
    const s = this.game.world.spawnPosition();
    this.teleport(s.x, s.y, s.z, s.yaw);
    this.dead = false;
    this.deadT = 0;
    this.hp = this.maxHp;
    this.invulnT = 1.5;
    this.game.events.emit('player:respawned', {});
    this._emitHp();
  }

  _emitHp() {
    this.game.events.emit('player:hp', { hp: Math.round(this.hp), maxHp: this.maxHp });
  }

  dispose() {
    for (const off of this._offs) off();
    this.label.dispose();
    this.model.dispose();
  }
}
