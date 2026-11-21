// 떠오르는 숫자 (피해량·치명타·받은 피해·회복·경험치·골드).

import * as THREE from 'three';

const KINDS = {
  dealt: { color: '#ffffff', size: 18 },
  crit: { color: '#fbbf24', size: 26 },
  taken: { color: '#f87171', size: 18 },
  heal: { color: '#4ade80', size: 18 },
  exp: { color: '#93c5fd', size: 14 },
  gold: { color: '#fde047', size: 14 },
  info: { color: '#e5e7eb', size: 14 },
  level: { color: '#fde68a', size: 24 },
};

const tmp = new THREE.Vector3();

export class DamageText {
  constructor(overlay, camera) {
    this.overlay = overlay;
    this.camera = camera;
    this.active = [];
    this.pool = [];
  }

  /**
   * @param {{x:number,y:number,z:number}} pos  월드 위치
   * @param {string|number} text
   * @param {keyof KINDS} kind
   */
  spawn(pos, text, kind = 'dealt') {
    const k = KINDS[kind] ?? KINDS.dealt;
    const el = this.pool.pop() ?? document.createElement('div');
    el.className = 'si-dmg';
    el.textContent = String(text);
    el.style.color = k.color;
    el.style.fontSize = `${k.size}px`;
    el.style.display = '';
    this.overlay.appendChild(el);
    this.active.push({
      el,
      x: pos.x + (Math.random() - 0.5) * 0.5,
      y: pos.y,
      z: pos.z + (Math.random() - 0.5) * 0.5,
      t: 0,
      life: kind === 'level' ? 1.6 : 0.9,
      pop: kind === 'crit' || kind === 'level',
    });
  }

  update(dt, width, height) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const d = this.active[i];
      d.t += dt;
      const p = d.t / d.life;
      if (p >= 1) {
        d.el.style.display = 'none';
        d.el.remove();
        this.pool.push(d.el);
        this.active.splice(i, 1);
        continue;
      }
      tmp.set(d.x, d.y + 0.4 + p * 1.3, d.z).project(this.camera);
      if (tmp.z > 1) {
        d.el.style.opacity = '0';
        continue;
      }
      const x = (tmp.x * 0.5 + 0.5) * width;
      const y = (-tmp.y * 0.5 + 0.5) * height;
      const scale = d.pop ? 1 + Math.max(0, 0.6 - d.t * 4) : 1;
      d.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(2)})`;
      d.el.style.opacity = String(1 - p * p);
    }
  }

  clear() {
    for (const d of this.active) d.el.remove();
    this.active.length = 0;
  }
}
