// 몬스터 한 마리: 모양·이름표 + 상태. 움직임은 호스트면 monsterAI.js, 아니면 받은 스냅샷으로 정한다.

import { createMonsterModel } from './monsterModels.js';
import { createRng } from '../core/mathUtils.js';

/** 네트워크로 보내는 상태 번호 */
export const MONSTER_STATES = ['idle', 'wander', 'chase', 'windup', 'recover', 'return', 'dead'];
export const MONSTER_STATE_CODE = Object.fromEntries(MONSTER_STATES.map((s, i) => [s, i]));

export class Monster {
  constructor(game, idx, def, spawn) {
    this.game = game;
    this.idx = idx;
    this.def = def;
    this.home = { x: spawn.x, z: spawn.z };
    this.model = createMonsterModel(def.model, { color: def.color, size: def.size });
    game.scene.add(this.model.root);
    this.pos = this.model.root.position;
    this.pos.set(spawn.x, 0, spawn.z);
    const rng = createRng(`monster:${idx}:${def.id}`);
    this.yaw = rng() * Math.PI * 2;
    this.hp = def.maxHp;
    this.hostHp = def.maxHp;
    this.state = 'idle';
    this.stateT = 0;
    this.moving = false;
    this.speed = 0;

    // 호스트 AI용
    this.targetNid = null;
    this.patternCd = def.patterns.map(() => 0);
    this.globalCd = 0.5 + rng();
    this.attack = null;
    this.wanderTarget = null;
    this.wanderT = 1 + rng() * 3;
    this.knock = null;
    this.contributors = new Map();

    // 다른 사람이 호스트일 때
    this.buffer = [];
    this.lastLocalHitAt = -99;
    this.predictedDeadAt = null;

    this.label = game.labels
      .create({
        text: def.isBoss ? `👑 ${def.name}` : def.name,
        hp: true,
        className: def.isBoss ? 'si-boss' : '',
        color: def.isBoss ? '#fca5a5' : '#fde68a',
        offsetY: this.model.height + 0.35,
      })
      .follow(this.model.root);
  }

  get alive() {
    return this.state !== 'dead' && this.predictedDeadAt === null;
  }

  get radius() {
    return this.def.radius;
  }

  setState(state) {
    if (this.state !== state) {
      this.state = state;
      this.stateT = 0;
    }
  }

  updateVisual(dt, playerPos) {
    this.model.root.rotation.y = this.yaw;
    let state = this.state;
    if (this.predictedDeadAt !== null) state = 'dead';
    this.model.update(dt, {
      moving: this.moving && state !== 'dead',
      speed: this.speed,
      state,
      stateT: this.stateT,
      windupSec: this.attack ? this.attack.windupSec : this.def.attackWindupSec,
    });
    const hurt = this.hp < this.def.maxHp;
    const near = playerPos ? Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z) < 14 : false;
    const show = state !== 'dead' && (this.def.isBoss || hurt || near);
    this.label.setVisible(show);
    this.label.showHp(this.def.isBoss || hurt);
    this.label.setHp(this.hp / this.def.maxHp);
  }

  dispose() {
    this.label.dispose();
    this.model.dispose();
  }
}
