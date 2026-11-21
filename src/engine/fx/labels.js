// 머리 위 이름표·HP바 (3D 위치를 화면 좌표로 바꿔 HTML로 그린다. 한글이 선명하다).

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const STYLE_ID = 'si-engine-styles';

export function injectEngineStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.si-overlay { position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:2;
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; }
.si-label { position:absolute; left:0; top:0; white-space:nowrap; text-align:center; pointer-events:none;
  font-size:12px; font-weight:700; line-height:1.25; color:#fff; will-change:transform;
  text-shadow:0 1px 2px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.6); }
.si-label .si-sub { font-size:10px; font-weight:600; opacity:.85; }
.si-label .si-hp { width:46px; height:5px; margin:2px auto 0; background:rgba(0,0,0,.55); border-radius:3px; overflow:hidden; display:none; }
.si-label .si-hp > i { display:block; height:100%; background:#ef4444; transform-origin:left center; }
.si-label.si-boss .si-hp { width:90px; height:7px; }
.si-label.si-ally .si-hp > i { background:#22c55e; }
.si-dmg { position:absolute; left:0; top:0; pointer-events:none; font-weight:800; white-space:nowrap; will-change:transform,opacity;
  text-shadow:0 2px 2px rgba(0,0,0,.7), 0 0 4px rgba(0,0,0,.5); }
.si-fade { position:absolute; inset:0; background:#cfe8ff; opacity:0; transition:opacity .25s ease; pointer-events:none; z-index:3; }
.si-fade.on { opacity:1; }
`;
  document.head.appendChild(style);
}

const tmp = new THREE.Vector3();

export class Label {
  constructor(layer, { text = '', sub = '', color = '#ffffff', hp = false, className = '', offsetY = 2.2, alwaysShow = false }) {
    this.layer = layer;
    this.el = document.createElement('div');
    this.el.className = `si-label ${className}`;
    this.nameEl = document.createElement('div');
    this.subEl = document.createElement('div');
    this.subEl.className = 'si-sub';
    this.hpEl = document.createElement('div');
    this.hpEl.className = 'si-hp';
    this.hpFill = document.createElement('i');
    this.hpEl.appendChild(this.hpFill);
    this.el.append(this.nameEl, this.subEl, this.hpEl);
    this.offsetY = offsetY;
    this.alwaysShow = alwaysShow;
    this.target = null;
    this.visible = true;
    this._shown = null;
    this.setText(text, sub);
    this.setColor(color);
    this.showHp(hp);
    layer.overlay.appendChild(this.el);
  }

  follow(object3D) {
    this.target = object3D;
    return this;
  }

  setText(text, sub = '') {
    if (this._text !== text) {
      this._text = text;
      this.nameEl.textContent = text;
    }
    if (this._sub !== sub) {
      this._sub = sub;
      this.subEl.textContent = sub;
      this.subEl.style.display = sub ? '' : 'none';
    }
  }

  setColor(color) {
    this.nameEl.style.color = color;
  }

  showHp(show) {
    this.hpEl.style.display = show ? 'block' : 'none';
  }

  setHp(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    if (this._hp !== r) {
      this._hp = r;
      this.hpFill.style.transform = `scaleX(${r})`;
    }
  }

  setVisible(v) {
    this.visible = v;
  }

  dispose() {
    this.el.remove();
    this.layer.labels.delete(this);
  }
}

export class LabelLayer {
  constructor(overlay, camera) {
    this.overlay = overlay;
    this.camera = camera;
    this.labels = new Set();
  }

  create(opts) {
    const label = new Label(this, opts);
    this.labels.add(label);
    return label;
  }

  update(width, height) {
    const camPos = this.camera.position;
    const maxD = CONFIG.world.labelMaxDistance;
    for (const label of this.labels) {
      let show = label.visible && label.target && label.target.visible !== false;
      if (show) {
        label.target.getWorldPosition(tmp);
        tmp.y += label.offsetY;
        if (!label.alwaysShow && tmp.distanceTo(camPos) > maxD) show = false;
      }
      if (show) {
        tmp.project(this.camera);
        if (tmp.z > 1 || tmp.x < -1.2 || tmp.x > 1.2 || tmp.y < -1.2 || tmp.y > 1.2) show = false;
      }
      if (show) {
        const x = (tmp.x * 0.5 + 0.5) * width;
        const y = (-tmp.y * 0.5 + 0.5) * height;
        label.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      }
      if (label._shown !== show) {
        label._shown = show;
        label.el.style.display = show ? '' : 'none';
      }
    }
  }
}
