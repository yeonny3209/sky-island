// 키보드·마우스·터치 입력을 하나로 모은다.
// 다른 시스템은 매 프레임 input.move / consumePressed() / isHeld()만 본다.

import { CONFIG } from '../config.js';
import { DEFAULT_BINDINGS } from './bindings.js';
import { TouchControls } from './touchControls.js';

export class InputManager {
  constructor(game) {
    this.game = game;
    this.dom = game.renderer.domElement;
    this.bindings = structuredCloneSafe(DEFAULT_BINDINGS);
    this.enabled = true; // false면 게임 조작을 받지 않는다 (로그인 화면 등)
    this.keys = new Set();
    this.pressed = new Set(); // 이번 프레임에 눌린 액션
    this.move = { x: 0, y: 0 }; // x: 오른쪽+, y: 앞쪽+
    this.cameraDelta = { x: 0, y: 0, speed: CONFIG.camera.rotateSpeed };
    this.zoomDelta = 0;
    this.pointer = { ndcX: 0, ndcY: 0, inside: false, type: 'mouse' };
    this.lastDevice = 'keyboard'; // 'keyboard' | 'mouse' | 'touch'
    this.mouseAttackHeld = false;
    this._rightDrag = null;
    this._touchPointers = new Map(); // 캔버스 위 터치(카메라 회전·핀치 줌)
    this._codeToActions = this._buildCodeMap();
    this.touch = new TouchControls(game, this);
    this._listen();
  }

  _buildCodeMap() {
    const map = new Map();
    for (const [action, codes] of Object.entries(this.bindings)) {
      for (const code of codes) {
        if (!map.has(code)) map.set(code, []);
        map.get(code).push(action);
      }
    }
    return map;
  }

  /** 키 설정 바꾸기 (예: setBinding('skill1', ['KeyQ'])) */
  setBinding(action, codes) {
    this.bindings[action] = [...codes];
    this._codeToActions = this._buildCodeMap();
  }

  isTyping() {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  _listen() {
    window.addEventListener('keydown', (e) => {
      if (this.isTyping() || e.isComposing) return;
      const actions = this._codeToActions.get(e.code);
      if (!actions) return;
      e.preventDefault();
      this.lastDevice = 'keyboard';
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.enabled) for (const a of actions) this.pressed.add(a);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });

    const dom = this.dom;
    dom.style.touchAction = 'none';
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this._touchDown(e);
        return;
      }
      this.lastDevice = 'mouse';
      this.pointer.type = 'mouse';
      this._updatePointer(e);
      if (e.button === 0 && this.enabled) {
        this.pressed.add('attack');
        this.mouseAttackHeld = true;
      } else if (e.button === 2) {
        this._rightDrag = { x: e.clientX, y: e.clientY };
      }
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        // 일부 브라우저는 캡처를 지원하지 않는다
      }
    });
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        this._touchMove(e);
        return;
      }
      this._updatePointer(e);
      if (this._rightDrag) {
        this.cameraDelta.x += e.clientX - this._rightDrag.x;
        this.cameraDelta.y += e.clientY - this._rightDrag.y;
        this.cameraDelta.speed = CONFIG.camera.rotateSpeed;
        this._rightDrag.x = e.clientX;
        this._rightDrag.y = e.clientY;
      }
    });
    const up = (e) => {
      if (e.pointerType === 'touch') {
        this._touchUp(e);
        return;
      }
      if (e.button === 0) this.mouseAttackHeld = false;
      if (e.button === 2) this._rightDrag = null;
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') this.pointer.inside = false;
    });
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomDelta += e.deltaY;
      },
      { passive: false }
    );
  }

  _updatePointer(e) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.pointer.inside = true;
  }

  // ---- 캔버스 위 터치: 한 손가락 = 카메라 회전, 두 손가락 = 줌
  _touchDown(e) {
    this.lastDevice = 'touch';
    this.pointer.type = 'touch';
    this.pointer.inside = false;
    this.touch.notifyTouch();
    this._touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      this.dom.setPointerCapture(e.pointerId);
    } catch {
      // 무시
    }
  }

  _touchMove(e) {
    const p = this._touchPointers.get(e.pointerId);
    if (!p) return;
    if (this._touchPointers.size >= 2) {
      const [a, b] = [...this._touchPointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX;
      p.y = e.clientY;
      const [a2, b2] = [...this._touchPointers.values()];
      const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
      this.zoomDelta += (before - after) * 4;
      return;
    }
    this.cameraDelta.x += e.clientX - p.x;
    this.cameraDelta.y += e.clientY - p.y;
    this.cameraDelta.speed = CONFIG.camera.touchRotateSpeed;
    p.x = e.clientX;
    p.y = e.clientY;
  }

  _touchUp(e) {
    this._touchPointers.delete(e.pointerId);
  }

  releaseAll() {
    this.keys.clear();
    this.mouseAttackHeld = false;
    this._rightDrag = null;
    this._touchPointers.clear();
    this.touch.releaseAll();
  }

  /** 매 프레임 처음에 부른다 */
  update() {
    const k = (action) => this.bindings[action].some((c) => this.keys.has(c));
    let x = (k('moveRight') ? 1 : 0) - (k('moveLeft') ? 1 : 0);
    let y = (k('moveForward') ? 1 : 0) - (k('moveBack') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const joy = this.touch.joystick;
    if (joy.active) {
      x = joy.x;
      y = joy.y;
    }
    if (!this.enabled) {
      x = 0;
      y = 0;
    }
    this.move.x = x;
    this.move.y = y;
  }

  /** 이번 프레임에 눌렸으면 true를 돌려주고 지운다 */
  consumePressed(action) {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  /** 누르고 있는 중인지 (평타 연타용) */
  isHeld(action) {
    if (!this.enabled) return false;
    if (action === 'attack' && this.mouseAttackHeld) return true;
    if (this.touch.isHeld(action)) return true;
    const codes = this.bindings[action];
    return !!codes && codes.some((c) => this.keys.has(c));
  }

  /** UI 버튼 등에서 액션을 직접 누를 때 */
  press(action) {
    if (this.enabled) this.pressed.add(action);
  }

  /** 매 프레임 끝에 부른다 */
  endFrame() {
    this.pressed.clear();
    this.cameraDelta.x = 0;
    this.cameraDelta.y = 0;
    this.zoomDelta = 0;
  }
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}
