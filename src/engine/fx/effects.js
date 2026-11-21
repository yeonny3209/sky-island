// 전투 이펙트: 베기 궤적, 원형 충격파, 찌르기, 타격 번쩍임, 몬스터 공격 예고 장판, 레벨업.

import * as THREE from 'three';
import { easeOutCubic } from '../core/mathUtils.js';

function flatMaterial(color, opacity, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** 바닥에 눕힌 도형. 앞쪽 = +Z */
export function groundShapeGeometry(shape, params) {
  if (shape === 'circle') {
    const g = new THREE.CircleGeometry(params.range, 40);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  if (shape === 'line') {
    const g = new THREE.PlaneGeometry(params.width ?? 1.2, params.range);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, params.range / 2);
    return g;
  }
  const half = ((params.angleDeg ?? 100) * Math.PI) / 360;
  const g = new THREE.CircleGeometry(params.range, 32, -Math.PI / 2 - half, half * 2);
  g.rotateX(-Math.PI / 2);
  return g;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  _add(obj, life, onUpdate) {
    this.scene.add(obj);
    const fx = { obj, t: 0, life, onUpdate, done: false };
    this.active.push(fx);
    return fx;
  }

  /** 부채꼴 베기 궤적 */
  slash({ x, y = 0.9, z, yaw, range, angleDeg = 110, color = '#ffffff' }) {
    const half = (angleDeg * Math.PI) / 360;
    const geo = new THREE.RingGeometry(range * 0.35, range, 28, 1, -Math.PI / 2 - half, half * 2);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, flatMaterial(color, 0.7));
    const g = new THREE.Group();
    g.add(mesh);
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    this._add(g, 0.22, (p) => {
      mesh.material.opacity = 0.7 * (1 - p);
      g.scale.setScalar(0.85 + 0.25 * easeOutCubic(p));
    });
  }

  /** 원형 충격파 */
  burst({ x, y = 0.15, z, radius, color = '#ffffff' }) {
    const geo = new THREE.RingGeometry(0.75, 1, 40);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, flatMaterial(color, 0.8));
    mesh.position.set(x, y, z);
    this._add(mesh, 0.35, (p) => {
      mesh.scale.setScalar(Math.max(0.01, radius * easeOutCubic(p)));
      mesh.material.opacity = 0.8 * (1 - p);
    });
  }

  /** 앞으로 뻗는 찌르기/돌진 궤적 */
  thrust({ x, y = 0.9, z, yaw, length, width = 1, color = '#ffffff' }) {
    const geo = groundShapeGeometry('line', { range: length, width });
    const mesh = new THREE.Mesh(geo, flatMaterial(color, 0.6));
    const g = new THREE.Group();
    g.add(mesh);
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    this._add(g, 0.25, (p) => {
      mesh.material.opacity = 0.6 * (1 - p);
      mesh.scale.set(1 - p * 0.6, 1, 0.3 + 0.7 * easeOutCubic(Math.min(1, p * 3)));
    });
  }

  /** 맞은 자리 번쩍 */
  hit({ x, y, z, color = '#ffffff', size = 0.5 }) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), flatMaterial(color, 0.9));
    mesh.position.set(x, y, z);
    this._add(mesh, 0.18, (p) => {
      mesh.scale.setScalar(0.5 + p * 1.2);
      mesh.material.opacity = 0.9 * (1 - p);
      mesh.rotation.y += 0.3;
    });
  }

  /** 레벨업: 금색 고리가 위로 올라간다 */
  levelUp(target) {
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.TorusGeometry(0.8, 0.05, 6, 32);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, flatMaterial('#fde047', 0.9));
      const delay = i * 0.15;
      this._add(mesh, 1.2 + delay, (p, t) => {
        const q = Math.max(0, t - delay) / 1.2;
        mesh.position.set(target.position.x, target.position.y + 0.1 + q * 2.4, target.position.z);
        mesh.scale.setScalar(1 + q * 0.4);
        mesh.material.opacity = q <= 0 ? 0 : 0.9 * (1 - q);
      });
    }
  }

  /**
   * 몬스터 공격 예고 장판. 안쪽이 바깥까지 차오르면 그때 판정한다.
   * @returns {{ finish:Function, cancel:Function }}
   */
  telegraph({ shape, params, x, z, yaw, duration, color = '#ef4444' }) {
    const g = new THREE.Group();
    g.position.set(x, 0.05, z);
    g.rotation.y = yaw;
    const outer = new THREE.Mesh(groundShapeGeometry(shape, params), flatMaterial(color, 0.22, false));
    const inner = new THREE.Mesh(groundShapeGeometry(shape, params), flatMaterial(color, 0.38, false));
    inner.position.y = 0.01;
    g.add(outer, inner);
    const fx = this._add(g, Infinity, (p, t) => {
      if (fx.finishing != null) {
        const q = (t - fx.finishing) / 0.25;
        outer.material.opacity = 0.5 * (1 - q);
        inner.material.opacity = 0.6 * (1 - q);
        if (q >= 1) fx.done = true;
        return;
      }
      const u = Math.min(1, t / Math.max(0.05, duration));
      if (shape === 'line') inner.scale.set(1, 1, Math.max(0.001, u));
      else inner.scale.set(Math.max(0.001, u), 1, Math.max(0.001, u));
    });
    return {
      finish: () => {
        if (fx.finishing == null) fx.finishing = fx.t;
      },
      cancel: () => {
        fx.done = true;
      },
    };
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      fx.t += dt;
      const p = Number.isFinite(fx.life) ? Math.min(1, fx.t / fx.life) : 0;
      fx.onUpdate(p, fx.t);
      if (fx.done || (Number.isFinite(fx.life) && fx.t >= fx.life)) {
        this._remove(fx.obj);
        this.active.splice(i, 1);
      }
    }
  }

  _remove(obj) {
    obj.removeFromParent();
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  clear() {
    for (const fx of this.active) this._remove(fx.obj);
    this.active.length = 0;
  }
}
