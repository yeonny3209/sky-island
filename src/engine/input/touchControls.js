// 폰·태블릿 조작: 왼쪽 아래 가상 조이스틱 + 오른쪽 아래 공격·스킬·점프 버튼.
// 터치가 감지되면 나타난다. 버튼에는 쿨타임이 원형으로 표시된다.
// (이 화면은 "조작" 담당이라 엔진에 있다. 모양은 B가 바꿔도 된다: .si-touch 클래스)

const STYLE_ID = 'si-touch-styles';

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
.si-touch { position:absolute; inset:0; pointer-events:none; z-index:4; display:none; user-select:none; -webkit-user-select:none;
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; }
.si-touch.on { display:block; }
.si-joy-zone { position:absolute; left:0; bottom:0; width:42%; height:60%; pointer-events:auto; touch-action:none; }
.si-joy-base { position:absolute; width:120px; height:120px; margin:-60px 0 0 -60px; border-radius:50%;
  background:rgba(15,23,42,.28); border:2px solid rgba(255,255,255,.45); display:none; }
.si-joy-knob { position:absolute; left:50%; top:50%; width:52px; height:52px; margin:-26px 0 0 -26px; border-radius:50%;
  background:rgba(255,255,255,.75); box-shadow:0 2px 8px rgba(0,0,0,.3); }
.si-joy-hint { position:absolute; left:calc(18px + env(safe-area-inset-left)); bottom:calc(18px + env(safe-area-inset-bottom));
  width:96px; height:96px; border-radius:50%; border:2px dashed rgba(255,255,255,.45); }
.si-btn { position:absolute; border-radius:50%; border:2px solid rgba(255,255,255,.7); color:#fff; font-weight:800;
  background:rgba(15,23,42,.45); pointer-events:auto; touch-action:none; display:flex; align-items:center; justify-content:center;
  text-align:center; line-height:1.1; padding:0; overflow:hidden; text-shadow:0 1px 2px rgba(0,0,0,.6); -webkit-tap-highlight-color:transparent; }
.si-btn::after { content:""; position:absolute; inset:0; border-radius:50%;
  background:conic-gradient(rgba(0,0,0,.6) calc(var(--cd, 0) * 360deg), transparent 0); }
.si-btn.down { background:rgba(59,130,246,.65); }
.si-btn span { position:relative; z-index:1; font-size:13px; }
.si-btn.attack { width:84px; height:84px; right:calc(24px + env(safe-area-inset-right)); bottom:calc(28px + env(safe-area-inset-bottom)); }
.si-btn.attack span { font-size:16px; }
.si-btn.skill { width:58px; height:58px; }
.si-btn.s1 { right:calc(124px + env(safe-area-inset-right)); bottom:calc(30px + env(safe-area-inset-bottom)); }
.si-btn.s2 { right:calc(112px + env(safe-area-inset-right)); bottom:calc(104px + env(safe-area-inset-bottom)); }
.si-btn.s3 { right:calc(40px + env(safe-area-inset-right)); bottom:calc(128px + env(safe-area-inset-bottom)); }
.si-btn.jump { width:50px; height:50px; right:calc(196px + env(safe-area-inset-right)); bottom:calc(24px + env(safe-area-inset-bottom)); }
.si-btn.interact { width:58px; height:58px; right:calc(196px + env(safe-area-inset-right)); bottom:calc(96px + env(safe-area-inset-bottom));
  background:rgba(245,158,11,.6); display:none; }
.si-btn.interact.show { display:flex; }
.si-btn.cam { width:44px; height:44px; right:calc(30px + env(safe-area-inset-right)); bottom:calc(204px + env(safe-area-inset-bottom)); }
.si-btn.cam span { font-size:11px; }
`;
  document.head.appendChild(s);
}

export class TouchControls {
  constructor(game, input) {
    this.game = game;
    this.input = input;
    this.joystick = { active: false, x: 0, y: 0 };
    this.held = new Set();
    this.isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.wantVisible = false;
    injectStyles();
    this._build();
    // iOS 사파리 핀치 확대 막기
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  _build() {
    const root = document.createElement('div');
    root.className = 'si-touch';
    this.root = root;

    const zone = document.createElement('div');
    zone.className = 'si-joy-zone';
    const hint = document.createElement('div');
    hint.className = 'si-joy-hint';
    const base = document.createElement('div');
    base.className = 'si-joy-base';
    const knob = document.createElement('div');
    knob.className = 'si-joy-knob';
    base.appendChild(knob);
    zone.append(hint, base);
    root.appendChild(zone);
    this._joy = { zone, base, knob, hint, id: null, cx: 0, cy: 0 };

    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this._joy.id !== null) return;
      this.notifyTouch();
      const rect = zone.getBoundingClientRect();
      this._joy.id = e.pointerId;
      this._joy.cx = e.clientX;
      this._joy.cy = e.clientY;
      base.style.left = `${e.clientX - rect.left}px`;
      base.style.top = `${e.clientY - rect.top}px`;
      base.style.display = 'block';
      hint.style.display = 'none';
      knob.style.transform = '';
      this.joystick.active = true;
      this.joystick.x = 0;
      this.joystick.y = 0;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        // 무시
      }
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this._joy.id) return;
      const max = 50;
      let dx = e.clientX - this._joy.cx;
      let dy = e.clientY - this._joy.cy;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 0.12;
      const mag = Math.min(1, len / max);
      const k = mag < dead ? 0 : (mag - dead) / (1 - dead);
      const n = Math.hypot(dx, dy) || 1;
      this.joystick.x = (dx / n) * k;
      this.joystick.y = (-dy / n) * k;
    });
    const end = (e) => {
      if (e.pointerId !== this._joy.id) return;
      this._joy.id = null;
      this.joystick.active = false;
      this.joystick.x = 0;
      this.joystick.y = 0;
      base.style.display = 'none';
      hint.style.display = '';
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    this.buttons = {};
    const makeBtn = (action, cls, text) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `si-btn ${cls}`;
      const span = document.createElement('span');
      span.textContent = text;
      b.appendChild(span);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.notifyTouch();
        b.classList.add('down');
        this.held.add(action);
        this.input.press(action);
        this.input.lastDevice = 'touch';
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          // 무시
        }
      });
      const release = () => {
        b.classList.remove('down');
        this.held.delete(action);
      };
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      root.appendChild(b);
      this.buttons[action] = { el: b, label: span };
      return b;
    };
    makeBtn('attack', 'attack', '공격');
    makeBtn('skill1', 'skill s1', '스킬1');
    makeBtn('skill2', 'skill s2', '스킬2');
    makeBtn('skill3', 'skill s3', '스킬3');
    makeBtn('jump', 'jump', '점프');
    makeBtn('interact', 'interact', '대화');
    const cam = makeBtn('toggleCamera', 'cam', '시점');
    cam.title = '카메라 전환';

    this.game.overlayRoot.appendChild(root);
  }

  /** 터치를 한 번이라도 쓰면 조작 버튼을 보여 준다 */
  notifyTouch() {
    if (!this.isTouchDevice) {
      this.isTouchDevice = true;
      this._applyVisible();
    }
  }

  setVisible(v) {
    this.wantVisible = v;
    this._applyVisible();
  }

  _applyVisible() {
    this.root.classList.toggle('on', this.wantVisible && this.isTouchDevice);
  }

  /** 스킬 이름과 쿨타임 표시. slots: combat.getSlots() */
  updateSlots(slots) {
    const actions = ['attack', 'skill1', 'skill2', 'skill3'];
    actions.forEach((action, i) => {
      const btn = this.buttons[action];
      const slot = slots[i];
      if (!slot) {
        if (i > 0) btn.el.style.display = 'none';
        return;
      }
      btn.el.style.display = '';
      const name = i === 0 ? '공격' : slot.name.length > 4 ? slot.name.slice(0, 4) : slot.name;
      if (btn.label.textContent !== name) btn.label.textContent = name;
      const cd = slot.cooldownTotal > 0 ? Math.min(1, slot.cooldown / slot.cooldownTotal) : 0;
      btn.el.style.setProperty('--cd', cd.toFixed(3));
    });
  }

  setInteract(text) {
    const btn = this.buttons.interact;
    btn.el.classList.toggle('show', !!text);
    if (text) btn.label.textContent = text;
  }

  isHeld(action) {
    return this.held.has(action);
  }

  releaseAll() {
    this.held.clear();
    for (const b of Object.values(this.buttons)) b.el.classList.remove('down');
    this.joystick.active = false;
    this.joystick.x = 0;
    this.joystick.y = 0;
    if (this._joy) {
      this._joy.id = null;
      this._joy.base.style.display = 'none';
      this._joy.hint.style.display = '';
    }
  }
}
