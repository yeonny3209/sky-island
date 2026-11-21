// 오프라인(개발용) 전송: 같은 브라우저의 탭끼리 BroadcastChannel로 주고받는다.
// Supabase 키가 없거나 주소에 ?offline 을 붙이면 이걸 쓴다. 탭 두 개를 열면 멀티플레이를 시험할 수 있다.
// SupabaseTransport와 같은 모양(join/leave/send/updatePresence/onMessage/onPresence/onStatus)이다.

import { CONFIG } from '../config.js';

const BEAT_MS = 1500;

export class LocalTransport {
  constructor(selfNid) {
    this.selfNid = selfNid;
    this.connected = false;
    this.members = new Map(); // nid → { info, seen }
    this._onMessage = null;
    this._onPresence = null;
    this._onStatus = null;
    this._lastPresenceSig = '';
  }

  onMessage(fn) {
    this._onMessage = fn;
  }

  onPresence(fn) {
    this._onPresence = fn;
  }

  onStatus(fn) {
    this._onStatus = fn;
  }

  async join(room, info) {
    if (typeof BroadcastChannel === 'undefined') {
      this._status('error', new Error('이 브라우저는 BroadcastChannel을 지원하지 않습니다'));
      return;
    }
    this.room = room;
    this.info = info;
    this.bc = new BroadcastChannel(`sky-island:${room}`);
    this.bc.onmessage = (e) => this._recv(e.data);
    this.members.set(this.selfNid, { info, seen: Infinity });
    this._post({ k: 'hello', info });
    this._beat = setInterval(() => {
      this._post({ k: 'beat', info: this.info });
      this._expire();
    }, BEAT_MS);
    this.connected = true;
    this._status('connected');
    this._emitPresence();
  }

  _recv(msg) {
    if (!msg || msg.from === this.selfNid) return;
    if (msg.k === 'hello' || msg.k === 'beat') {
      this.members.set(msg.from, { info: msg.info, seen: Date.now() });
      if (msg.k === 'hello') this._post({ k: 'beat', info: this.info });
      this._emitPresence();
    } else if (msg.k === 'bye') {
      this.members.delete(msg.from);
      this._emitPresence();
    } else if (msg.k === 'msg' && this._onMessage) {
      this._onMessage(msg.type, msg.data, msg.from);
    }
  }

  _expire() {
    const now = Date.now();
    let changed = false;
    for (const [nid, m] of this.members) {
      if (nid !== this.selfNid && now - m.seen > CONFIG.net.presenceExpireMs) {
        this.members.delete(nid);
        changed = true;
      }
    }
    if (changed) this._emitPresence();
  }

  _emitPresence() {
    const map = new Map();
    for (const [nid, m] of this.members) map.set(nid, m.info);
    const sig = JSON.stringify([...map]);
    if (sig === this._lastPresenceSig) return;
    this._lastPresenceSig = sig;
    if (this._onPresence) this._onPresence(map);
  }

  _status(state, error = null) {
    if (this._onStatus) this._onStatus(state, error);
  }

  _post(m) {
    if (!this.bc) return;
    try {
      this.bc.postMessage({ ...m, from: this.selfNid });
    } catch (err) {
      console.warn('[네트워크] 탭 간 전송 실패', err);
    }
  }

  send(type, data) {
    if (!this.connected) return false;
    this._post({ k: 'msg', type, data });
    return true;
  }

  updatePresence(info) {
    this.info = info;
    this.members.set(this.selfNid, { info, seen: Infinity });
    this._post({ k: 'beat', info });
    this._emitPresence();
  }

  async leave() {
    if (this.bc) {
      this._post({ k: 'bye' });
      this.bc.close();
    }
    clearInterval(this._beat);
    this.bc = null;
    this.connected = false;
    this.members.clear();
    this._lastPresenceSig = '';
  }
}
