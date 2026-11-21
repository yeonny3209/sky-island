// 멀티플레이 동기화.
//  - 섬마다 방(채널) 하나: 위치·공격 모션·몬스터 상태를 주고받는다.
//  - 전체 방 하나(global): 채팅과 접속자 목록.
//  - 보내는 것은 한 번에 묶어서(bundle) 인원에 맞춘 간격으로 보낸다 (Supabase 무료 한도 보호).
//
// 묶음(bundle) 형식 'b':
//   i: 보낸 쪽 전송 간격(ms)
//   p: [x, y, z, yaw, 상태, vx, vz, hp, maxHp]       내 위치
//   a: [[skillId, yaw], ...]                           내가 쓴 공격 (모션·이펙트용)
//   h: [[몬스터번호, 피해, 치명, kx, kz], ...]          내가 때린 피해 (호스트만 적용)
//   e: [[사건...], ...]                                호스트만: 몬스터 공격/죽음/부활
//   m: [[번호, x, z, yaw, hp, 상태], ...]               호스트만: 몬스터 스냅샷

import { CONFIG } from '../config.js';
import { uid, round2, angleDiff } from '../core/mathUtils.js';
import { electHost, sendIntervalMs } from './hostElection.js';
import { LocalTransport } from './localTransport.js';
import { SupabaseTransport } from './supabaseTransport.js';
import { RemotePlayer } from '../entities/remotePlayer.js';
import { supabase } from '../save/supabaseClient.js';

export class NetSync {
  constructor(game) {
    this.game = game;
    this.selfNid = uid(8); // 접속할 때마다 새로 만든다 (같은 계정으로 탭 두 개를 열어도 겹치지 않게)
    this.room = null;
    this.roomId = null;
    this.global = null;
    this.roomMembers = new Map();
    this.globalMembers = new Map();
    this.remotes = new Map();
    this.hostNid = null;
    this.isHost = true;
    this.joinedAt = 0;
    this.sendInterval = CONFIG.net.minSendIntervalMs;
    this.out = { a: [], h: [], e: [] };
    this.sendTimer = 0;
    this.forcePos = false;
    this.forceSnapshot = false;
    this.lastSentPos = null;
    this.lastChatAt = 0;
    this._globalReady = false;
    this._dupWarned = false;

    document.addEventListener('visibilitychange', () => {
      if (this.room) this.room.updatePresence(this._roomInfo());
    });
    window.addEventListener('pagehide', () => {
      if (this.room) this.room.leave();
      if (this.global) this.global.leave();
    });
    game.events.on('player:levelUp', ({ level }) => {
      this.updatePresence();
      this.announce(`${game.character.name}님이 레벨 ${level}이 되었습니다!`);
    });
    game.events.on('equipment:changed', () => this.updatePresence());
  }

  get mode() {
    return this.game.session.mode;
  }

  _createTransport() {
    return this.mode === 'online' && supabase ? new SupabaseTransport(supabase, this.selfNid) : new LocalTransport(this.selfNid);
  }

  _roomInfo() {
    const ch = this.game.character;
    return {
      nid: this.selfNid,
      name: ch ? ch.name : '???',
      level: ch ? ch.level : 1,
      color: ch ? ch.appearance.color : '#f97316',
      w: ch ? ch.equipment.weapon ?? null : null,
      at: this.joinedAt,
      away: document.hidden,
    };
  }

  _globalInfo() {
    const ch = this.game.character;
    return {
      nid: this.selfNid,
      cid: ch ? ch.id : null,
      name: ch ? ch.name : '???',
      level: ch ? ch.level : 1,
      island: this.roomId,
    };
  }

  // ---------- 접속 관리

  async connectGlobal() {
    if (this.global) return;
    const t = this._createTransport();
    this.global = t;
    t.onMessage((type, data, from) => {
      if (this.global === t) this._onGlobalMessage(type, data, from);
    });
    t.onPresence((map) => {
      if (this.global === t) this._onGlobalPresence(map);
    });
    t.onStatus(() => this._emitStatus());
    await t.join('global', this._globalInfo());
  }

  async joinIsland(islandId) {
    await this.leaveIsland();
    this.roomId = islandId;
    this.joinedAt = Date.now();
    this.hostNid = this.selfNid;
    this.isHost = true;
    this.game.monsters.setAuthority(true);
    const t = this._createTransport();
    this.room = t;
    t.onMessage((type, data, from) => {
      if (this.room === t) this._onRoomMessage(type, data, from);
    });
    t.onPresence((map) => {
      if (this.room === t) this._onRoomPresence(map);
    });
    t.onStatus((state) => {
      if (this.room !== t) return;
      if (state === 'connected') {
        this.forcePos = true;
        this.forceSnapshot = true;
      }
      this._emitStatus();
    });
    await t.join(`island:${islandId}`, this._roomInfo());
    this._electHost();
    this.updatePresence();
    this._emitStatus();
  }

  async leaveIsland() {
    const t = this.room;
    this.room = null;
    this.roomId = null;
    for (const r of this.remotes.values()) r.dispose();
    this.remotes.clear();
    this.roomMembers = new Map();
    this.out.a.length = 0;
    this.out.h.length = 0;
    this.out.e.length = 0;
    this.lastSentPos = null;
    this.hostNid = null;
    if (t) await t.leave();
  }

  async disconnect() {
    await this.leaveIsland();
    const g = this.global;
    this.global = null;
    this.globalMembers = new Map();
    this._globalReady = false;
    if (g) await g.leave();
    this._emitStatus();
  }

  /** 레벨·무기가 바뀌면 다른 사람에게 알린다 */
  updatePresence() {
    if (this.room) this.room.updatePresence(this._roomInfo());
    if (this.global) this.global.updatePresence(this._globalInfo());
  }

  // ---------- 방(섬) 이벤트

  _onRoomPresence(map) {
    this.roomMembers = map;
    let joined = false;
    for (const [nid, info] of map) {
      if (nid === this.selfNid) continue;
      const r = this.remotes.get(nid);
      if (!r) {
        this.remotes.set(nid, new RemotePlayer(this.game, nid, info));
        joined = true;
      } else {
        r.ghost = false;
        r.setInfo(info);
      }
    }
    const now = this.game.now;
    for (const [nid, r] of this.remotes) {
      if (!map.has(nid) && !(r.ghost && now - r.lastRecv < 3)) {
        r.dispose();
        this.remotes.delete(nid);
      }
    }
    if (joined) {
      this.forcePos = true;
      this.forceSnapshot = true;
    }
    this._electHost();
    this.game.events.emit('players:changed', { players: this.roomPlayers() });
  }

  _electHost() {
    const members = [...this.roomMembers.entries()].map(([nid, info]) => ({ nid, at: info.at, away: info.away }));
    if (!this.roomMembers.has(this.selfNid)) members.push({ nid: this.selfNid, at: this.joinedAt, away: document.hidden });
    const host = electHost(members);
    if (host === this.hostNid) return;
    const wasHost = this.isHost;
    this.hostNid = host;
    this.isHost = host === this.selfNid;
    if (wasHost !== this.isHost) this.game.monsters.setAuthority(this.isHost);
    if (this.isHost) this.forceSnapshot = true;
    this._emitStatus();
  }

  _onRoomMessage(type, data, from) {
    if (type !== 'b' || !data || typeof data !== 'object') return;
    const game = this.game;
    const now = game.now;
    let r = this.remotes.get(from);
    if (!r) {
      r = new RemotePlayer(game, from, this.roomMembers.get(from) ?? {});
      r.ghost = !this.roomMembers.has(from);
      this.remotes.set(from, r);
    }
    if (Array.isArray(data.p)) r.pushSample(data.p, now, data.i);
    if (Array.isArray(data.a)) for (const [skillId, yaw] of data.a) r.playAction(this._findSkill(skillId), Number(yaw) || 0);
    if (Array.isArray(data.h) && this.isHost) {
      for (const [idx, dmg, , kx, kz] of data.h) game.monsters.applyNetHit(idx, dmg, kx, kz, from);
    }
    if (from === this.hostNid && !this.isHost) {
      if (Array.isArray(data.e)) for (const ev of data.e) if (Array.isArray(ev)) game.monsters.applyEvent(ev);
      if (Array.isArray(data.m)) game.monsters.applySnapshot(data.m, now, data.i);
    }
  }

  _findSkill(id) {
    const data = this.game.data;
    const s = data.getSkill(id);
    if (s) return s;
    for (const c of data.classes.values()) if (c.basicAttack.id === id) return c.basicAttack;
    return null;
  }

  // ---------- 전체 방(채팅·접속자)

  _onGlobalPresence(map) {
    const prev = this.globalMembers;
    this.globalMembers = map;
    if (this._globalReady) {
      for (const [nid, info] of map) {
        if (nid !== this.selfNid && !prev.has(nid)) this._system(`${info.name}님이 접속했습니다`);
      }
      for (const [nid, info] of prev) {
        if (nid !== this.selfNid && !map.has(nid)) this._system(`${info.name}님이 나갔습니다`);
      }
    }
    if (map.has(this.selfNid)) this._globalReady = true;
    const ch = this.game.character;
    if (ch && !this._dupWarned) {
      for (const [nid, info] of map) {
        if (nid !== this.selfNid && info.cid && info.cid === ch.id) {
          this._dupWarned = true;
          this._system('같은 캐릭터가 다른 창에서도 접속 중입니다. 저장이 서로 덮어써질 수 있어요.');
          this.game.events.emit('session:duplicate', {});
        }
      }
    }
    this.game.events.emit('online:changed', { players: this.onlinePlayers() });
  }

  _onGlobalMessage(type, data, from) {
    if (!data || typeof data !== 'object') return;
    const max = CONFIG.net.chatMaxLength;
    if (type === 'chat') {
      this.game.events.emit('chat:message', {
        nid: from,
        name: String(data.n ?? '???').slice(0, 20),
        text: String(data.x ?? '').slice(0, max),
        time: Date.now(),
      });
    } else if (type === 'sys') {
      this._system(String(data.x ?? '').slice(0, max));
    }
  }

  _system(text) {
    this.game.events.emit('chat:message', { system: true, text, time: Date.now() });
  }

  /** 채팅 보내기. { ok, reason } */
  sendChat(text) {
    const clean = String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, CONFIG.net.chatMaxLength);
    if (!clean) return { ok: false, reason: '내용이 비어 있습니다' };
    const now = Date.now();
    if (now - this.lastChatAt < CONFIG.net.chatCooldownMs) return { ok: false, reason: '조금 천천히 보내 주세요' };
    this.lastChatAt = now;
    const name = this.game.character ? this.game.character.name : '???';
    if (this.global) this.global.send('chat', { n: name, x: clean });
    this.game.events.emit('chat:message', { nid: this.selfNid, name, text: clean, time: now, self: true });
    return { ok: true };
  }

  /** 모두에게 시스템 알림 (레벨업 등) */
  announce(text) {
    if (this.global) this.global.send('sys', { x: text });
    this._system(text);
  }

  // ---------- 보내기 대기열

  queueAction(slot, skillId, yaw) {
    this.out.a.push([skillId, round2(yaw)]);
  }

  queueHit(idx, damage, crit, kx, kz) {
    this.out.h.push([idx, damage, crit, kx, kz]);
  }

  queueEvent(ev) {
    if (this.isHost) this.out.e.push(ev);
  }

  // ---------- 매 프레임

  update(dt) {
    const game = this.game;
    const now = game.now;
    for (const r of this.remotes.values()) r.update(dt, now);
    const p = game.player;
    if (!this.room || !this.room.connected || !p) return;

    const n = Math.max(1, this.roomMembers.size);
    if (n <= 1) {
      // 혼자면 아무것도 안 보낸다
      this.out.a.length = 0;
      this.out.h.length = 0;
      this.out.e.length = 0;
      return;
    }
    const interval = sendIntervalMs(n, CONFIG.net.budgetMsgsPerSec, CONFIG.net.minSendIntervalMs, CONFIG.net.maxSendIntervalMs);
    if (interval !== this.sendInterval) {
      this.sendInterval = interval;
      this._emitStatus();
    }
    this.sendTimer += dt * 1000;
    if (this.sendTimer < interval) return;
    this.sendTimer = 0;

    const b = { i: interval };
    let has = false;
    const pos = [
      round2(p.pos.x),
      round2(p.pos.y),
      round2(p.pos.z),
      round2(p.yaw),
      p.stateCode,
      round2(p.vel.x),
      round2(p.vel.z),
      Math.round(p.hp),
      p.maxHp,
    ];
    const last = this.lastSentPos;
    const changed =
      !last ||
      Math.abs(pos[0] - last[0]) > 0.02 ||
      Math.abs(pos[1] - last[1]) > 0.02 ||
      Math.abs(pos[2] - last[2]) > 0.02 ||
      Math.abs(angleDiff(pos[3], last[3])) > 0.05 ||
      pos[4] !== last[4] ||
      pos[7] !== last[7] ||
      pos[8] !== last[8];
    if (changed || this.forcePos) {
      b.p = pos;
      this.lastSentPos = pos;
      this.forcePos = false;
      has = true;
    }
    if (this.out.a.length) {
      b.a = this.out.a.splice(0);
      has = true;
    }
    if (this.out.h.length) {
      b.h = this.out.h.splice(0);
      has = true;
    }
    if (this.isHost) {
      if (this.out.e.length) {
        b.e = this.out.e.splice(0);
        has = true;
      }
      const snap = game.monsters.getSnapshot(this.forceSnapshot);
      this.forceSnapshot = false;
      if (snap) {
        b.m = snap;
        has = true;
      }
    } else {
      this.out.e.length = 0;
    }
    if (has) this.room.send('b', b);
  }

  // ---------- UI용 정보

  roomPlayers() {
    return [...this.roomMembers.entries()].map(([nid, info]) => ({
      nid,
      name: info.name,
      level: info.level,
      isSelf: nid === this.selfNid,
      isHost: nid === this.hostNid,
    }));
  }

  onlinePlayers() {
    const data = this.game.data;
    return [...this.globalMembers.entries()].map(([nid, info]) => ({
      nid,
      name: info.name,
      level: info.level,
      islandId: info.island,
      islandName: info.island && data.getIsland(info.island) ? data.getIsland(info.island).name : '',
      isSelf: nid === this.selfNid,
    }));
  }

  status() {
    return {
      mode: this.mode,
      connected: !!(this.room && this.room.connected),
      globalConnected: !!(this.global && this.global.connected),
      isHost: this.isHost,
      players: Math.max(1, this.roomMembers.size),
      online: Math.max(1, this.globalMembers.size),
      sendIntervalMs: this.sendInterval,
    };
  }

  _emitStatus() {
    this.game.events.emit('net:status', this.status());
  }
}
