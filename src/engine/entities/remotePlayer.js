// 다른 플레이어: 받은 위치들을 조금 늦게(보간 지연) 따라가며 부드럽게 그린다.

import { lerp, lerpAngle, clamp } from '../core/mathUtils.js';
import { CharacterModel } from './characterModel.js';
import { PLAYER_STATE } from './localPlayer.js';

export class RemotePlayer {
  constructor(game, nid, info = {}) {
    this.game = game;
    this.nid = nid;
    this.info = {};
    this.model = new CharacterModel({ color: info.color || '#f97316' });
    this.model.root.visible = false;
    game.scene.add(this.model.root);
    this.pos = this.model.root.position;
    this.yaw = 0;
    this.state = PLAYER_STATE.idle;
    this.hp = 1;
    this.maxHp = 1;
    this.buffer = []; // { t, x, y, z, yaw, vx, vz, st }
    this.delay = 0.2;
    this.lastRecv = 0;
    this.speed = 0;
    this.label = game.labels.create({ text: '', color: '#ffffff', hp: true, className: 'si-ally', offsetY: 2.35 }).follow(this.model.root);
    this.setInfo(info);
  }

  get dead() {
    return this.state === PLAYER_STATE.dead;
  }

  get alive() {
    return !this.dead && this.model.root.visible;
  }

  get radius() {
    return 0.45;
  }

  setInfo(info) {
    this.info = { ...this.info, ...info };
    this.label.setText(`Lv.${this.info.level ?? 1} ${this.info.name ?? '???'}`);
    const weaponId = this.info.w;
    this.model.setWeapon(weaponId ? this.game.data.getItem(weaponId) : null);
  }

  /**
   * @param {number[]} p  [x, y, z, yaw, state, vx, vz, hp, maxHp]
   * @param {number} now  받은 시각(초)
   * @param {number} intervalMs  보낸 쪽의 전송 간격
   */
  pushSample(p, now, intervalMs = 150) {
    const [x, y, z, yaw, st, vx, vz, hp, maxHp] = p;
    const interval = clamp((intervalMs || 150) / 1000, 0.05, 1.5);
    this.delay = Math.min(1.2, interval * 1.4 + 0.06);
    const last = this.buffer[this.buffer.length - 1];
    // 한동안 멈춰 있다가 다시 움직이면, 출발 시점을 맞추려고 이전 위치를 한 번 더 넣는다
    if (last && now - last.t > interval * 2.2) {
      this.buffer.push({ ...last, t: now - interval });
    }
    // 순간이동(섬 이동·부활)이면 보간하지 않는다
    if (last && Math.hypot(x - last.x, z - last.z) > 8) this.buffer.length = 0;
    this.buffer.push({ t: now, x, y, z, yaw, vx: vx || 0, vz: vz || 0, st });
    if (this.buffer.length > 30) this.buffer.splice(0, this.buffer.length - 30);
    this.hp = hp ?? this.hp;
    this.maxHp = maxHp ?? this.maxHp;
    this.label.setHp(this.maxHp > 0 ? this.hp / this.maxHp : 1);
    if (!this.model.root.visible) {
      this.model.root.visible = true;
      this.pos.set(x, y, z);
      this.yaw = yaw;
    }
    this.lastRecv = now;
  }

  /** 다른 플레이어의 공격 모션과 이펙트만 보여 준다 (판정은 그 사람 브라우저가 한다) */
  playAction(skill, yaw) {
    if (!skill) return;
    this.yaw = yaw;
    this.model.playAttack(skill.anim, skill.castSec, skill.totalSec);
    const fx = this.game.fx;
    const x = this.pos.x;
    const z = this.pos.z;
    setTimeout(() => {
      if (skill.shape === 'circle') fx.burst({ x, z, radius: skill.range, color: skill.color });
      else if (skill.shape === 'line') fx.thrust({ x, z, yaw, length: skill.range + skill.dashDistance, width: skill.width, color: skill.color });
      else fx.slash({ x, z, yaw, range: skill.range, angleDeg: skill.angleDeg, color: skill.color });
    }, skill.castSec * 1000);
  }

  update(dt, now) {
    const b = this.buffer;
    if (b.length) {
      const rt = now - this.delay;
      let x;
      let y;
      let z;
      let yaw;
      let st;
      if (rt <= b[0].t) {
        ({ x, y, z, yaw, st } = b[0]);
      } else if (rt >= b[b.length - 1].t) {
        const s = b[b.length - 1];
        const ahead = Math.min(0.25, rt - s.t); // 잠깐은 속도로 예측
        x = s.x + s.vx * ahead;
        y = s.y;
        z = s.z + s.vz * ahead;
        yaw = s.yaw;
        st = s.st;
      } else {
        let i = 1;
        while (i < b.length && b[i].t < rt) i++;
        const a = b[i - 1];
        const c = b[i];
        const k = (rt - a.t) / Math.max(1e-4, c.t - a.t);
        x = lerp(a.x, c.x, k);
        y = lerp(a.y, c.y, k);
        z = lerp(a.z, c.z, k);
        yaw = lerpAngle(a.yaw, c.yaw, k);
        st = k < 0.5 ? a.st : c.st;
        if (i > 2) b.splice(0, i - 2);
      }
      const moved = Math.hypot(x - this.pos.x, z - this.pos.z);
      this.speed = dt > 0 ? moved / dt : 0;
      this.pos.set(x, y, z);
      if (st !== PLAYER_STATE.attack || !this.model.attack) this.yaw = yaw;
      this.state = st;
    }
    this.model.root.rotation.y = this.yaw;
    this.model.update(dt, {
      speed: this.state === PLAYER_STATE.run ? Math.max(this.speed, 2) : this.speed,
      grounded: this.state !== PLAYER_STATE.jump && this.pos.y < 0.05,
      dead: this.state === PLAYER_STATE.dead,
    });
  }

  dispose() {
    this.label.dispose();
    this.model.dispose();
  }
}
