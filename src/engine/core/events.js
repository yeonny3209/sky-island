// 아주 작은 이벤트 버스.
// UI(B)는 game.events.on('이벤트 이름', fn)으로 엔진 상태 변화를 받는다. 목록은 src/engine/README.md 참고.

export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  /** 구독. 돌려주는 함수를 부르면 구독 해제. '*'를 구독하면 (type, payload)로 모든 이벤트를 받는다. */
  on(type, fn) {
    let set = this._handlers.get(type);
    if (!set) {
      set = new Set();
      this._handlers.set(type, set);
    }
    set.add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off(type, fn) {
    const set = this._handlers.get(type);
    if (set) set.delete(fn);
  }

  emit(type, payload) {
    const set = this._handlers.get(type);
    if (set) {
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[이벤트 ${type}] 처리 중 오류`, err);
        }
      }
    }
    const any = this._handlers.get('*');
    if (any) {
      for (const fn of [...any]) {
        try {
          fn(type, payload);
        } catch (err) {
          console.error('[이벤트 *] 처리 중 오류', err);
        }
      }
    }
  }
}
