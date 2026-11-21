// 자동 저장.
//  - 레벨업·아이템·장비·섬 해금 같은 중요한 변화: 2초 뒤 저장 (연달아 바뀌면 한 번에)
//  - 그 밖(경험치·위치): 30초마다 바뀐 게 있으면 저장
//  - 탭을 닫거나 다른 앱으로 갈 때도 저장 시도
// 실패하면 5→15→30→60초 간격으로 다시 시도한다.

import { CONFIG } from '../config.js';

export class SaveManager {
  constructor(game) {
    this.game = game;
    this.character = null;
    this.dirty = false;
    this.importantAt = null;
    this.timer = 0;
    this.saving = false;
    this.again = false;
    this.failCount = 0;
    this.retryAt = 0;
    this.lastSavedAt = null;
    this.lastPos = null;
    this._off = null;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.saveNow('hidden');
    });
    window.addEventListener('pagehide', () => this.saveNow('pagehide'));
  }

  attach(character) {
    if (this._off) this._off();
    this.character = character;
    this.dirty = false;
    this.importantAt = null;
    this.timer = 0;
    this._off = character ? this.game.events.on('character:changed', ({ important }) => this.markDirty(important)) : null;
  }

  markDirty(important = false) {
    this.dirty = true;
    if (important && this.importantAt === null) this.importantAt = this.game.time + CONFIG.save.importantDebounceSec;
  }

  update(dt) {
    if (!this.character || !this.game.inWorld) return;
    this.character.playTimeSec += dt;
    this.timer += dt;
    const t = this.game.time;
    if (this.saving || t < this.retryAt) return;
    const p = this.game.player;
    const moved = p && this.lastPos ? Math.hypot(p.pos.x - this.lastPos.x, p.pos.z - this.lastPos.z) > 1 : !!p;
    const due =
      (this.importantAt !== null && t >= this.importantAt) || (this.timer >= CONFIG.save.autosaveSec && (this.dirty || moved));
    if (due) this.saveNow('auto');
  }

  /** 지금 저장. 이미 저장 중이면 끝난 뒤 한 번 더 */
  async saveNow(reason = 'manual') {
    const game = this.game;
    const ch = this.character;
    if (!ch || !game.session.user) return { ok: false };
    if (this.saving) {
      this.again = true;
      return { ok: false, queued: true };
    }
    if (game.inWorld && game.player && game.world.island) {
      ch.setLocation(game.world.island.id, game.player.pos);
    }
    this.saving = true;
    this.importantAt = null;
    this.timer = 0;
    game.events.emit('save:status', { state: 'saving', reason });
    let res;
    try {
      res = await game.session.saveCharacter(ch.toSave());
    } catch (err) {
      res = { ok: false, error: err.message };
    }
    this.saving = false;
    if (res.ok) {
      this.dirty = false;
      this.failCount = 0;
      this.lastSavedAt = Date.now();
      this.lastPos = game.player ? { x: game.player.pos.x, z: game.player.pos.z } : null;
      game.events.emit('save:status', { state: 'saved', at: this.lastSavedAt, reason });
    } else {
      const waits = CONFIG.save.retrySec;
      this.retryAt = game.time + waits[Math.min(this.failCount, waits.length - 1)];
      this.failCount += 1;
      this.dirty = true;
      console.warn('[저장] 실패', res.error);
      game.events.emit('save:status', { state: 'error', error: res.error, reason });
    }
    if (this.again) {
      this.again = false;
      return this.saveNow('again');
    }
    return res;
  }
}
