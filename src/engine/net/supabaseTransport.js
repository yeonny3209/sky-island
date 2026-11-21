// Supabase Realtime 전송: 섬(방)마다 채널 하나. Presence = 누가 있나, Broadcast = 위치·전투·채팅.
// DB를 거치지 않으므로 테이블 설정 없이 동작한다.

export class SupabaseTransport {
  constructor(client, selfNid) {
    this.client = client;
    this.selfNid = selfNid;
    this.connected = false;
    this.channel = null;
    this._onMessage = null;
    this._onPresence = null;
    this._onStatus = null;
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

  /** 접속을 시도하고 8초 안에 결과를 돌려준다. 실패해도 라이브러리가 뒤에서 계속 재접속한다. */
  async join(room, info) {
    this.info = info;
    const ch = this.client.channel(`sky:${room}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.selfNid } },
    });
    this.channel = ch;
    ch.on('presence', { event: 'sync' }, () => this._emitPresence());
    ch.on('broadcast', { event: 'm' }, ({ payload }) => {
      if (!payload || payload.f === this.selfNid || !this._onMessage) return;
      this._onMessage(payload.t, payload.d, payload.f);
    });
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const timer = setTimeout(done, 8000);
      ch.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // 재접속 때도 여기로 다시 온다 → 내 정보를 다시 올린다
          this.connected = true;
          this._status('connected');
          ch.track(this.info).catch((e) => console.warn('[네트워크] presence 등록 실패', e));
          clearTimeout(timer);
          done();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.connected = false;
          console.warn(`[네트워크] ${room} 채널 ${status}`, err);
          this._status('error', err);
          clearTimeout(timer);
          done();
        } else if (status === 'CLOSED') {
          this.connected = false;
          this._status('closed');
        }
      });
    });
  }

  _emitPresence() {
    if (!this.channel || !this._onPresence) return;
    const state = this.channel.presenceState();
    const map = new Map();
    for (const [key, metas] of Object.entries(state)) {
      const meta = metas[metas.length - 1];
      if (!meta) continue;
      const { presence_ref: _ref, ...info } = meta;
      map.set(key, info);
    }
    if (this.connected && !map.has(this.selfNid)) map.set(this.selfNid, this.info);
    this._onPresence(map);
  }

  _status(state, error = null) {
    if (this._onStatus) this._onStatus(state, error);
  }

  send(type, data) {
    if (!this.channel || !this.connected) return false;
    this.channel.send({ type: 'broadcast', event: 'm', payload: { f: this.selfNid, t: type, d: data } }).catch(() => {});
    return true;
  }

  updatePresence(info) {
    this.info = info;
    if (this.channel && this.connected) this.channel.track(info).catch(() => {});
  }

  async leave() {
    const ch = this.channel;
    this.channel = null;
    this.connected = false;
    if (ch) {
      try {
        await this.client.removeChannel(ch);
      } catch (err) {
        console.warn('[네트워크] 채널 나가기 실패', err);
      }
    }
  }
}
