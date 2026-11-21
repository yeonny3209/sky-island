// 몬스터 로우폴리 모양 5종: slime, beast, mushroom, golem, bat.
// monsters.json의 model 필드로 고르고, color·size로 색과 크기를 바꾼다.
// 앞쪽은 +Z. 크기 1 기준 몸 반지름 0.5.

import * as THREE from 'three';
import { clamp, easeOutCubic } from '../core/mathUtils.js';
import { ownMat, createBlobShadow, disposeObject } from '../world/materials.js';

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function eyes(group, mat, y, z, gap, size = 0.08) {
  const geo = new THREE.BoxGeometry(size, size * 1.3, size * 0.5);
  const l = new THREE.Mesh(geo, mat);
  l.position.set(-gap, y, z);
  const r = new THREE.Mesh(geo, mat);
  r.position.set(gap, y, z);
  group.add(l, r);
}

// 각 모양: build(model, color) → 부품 만들기, animate(model, a, dt) → 자세
const KINDS = {
  slime: {
    height: 1.15,
    build(md, color) {
      const mat = md.mat(color, { roughness: 0.35 });
      md.bodyMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), mat);
      md.bodyMesh.position.y = 0.44;
      md.bodyMesh.scale.set(1, 0.8, 1);
      md.pivot.add(md.bodyMesh);
      const face = new THREE.Group();
      eyes(face, md.mat('#1f2937'), 0.55, 0.47, 0.17, 0.1);
      md.pivot.add(face);
      md.face = face;
    },
    animate(md, a) {
      let y = 0.44;
      let sy = 0.8;
      let sxz = 1;
      let lunge = 0;
      if (a.state === 'windup') {
        const u = clamp(a.stateT / a.windupSec, 0, 1);
        sy = 0.8 - 0.28 * u;
        sxz = 1 + 0.22 * u;
      } else if (a.state === 'recover' && a.stateT < 0.3) {
        const v = a.stateT / 0.3;
        lunge = Math.sin(v * Math.PI) * 0.45;
        sy = 0.95;
        y += Math.sin(v * Math.PI) * 0.25;
      } else if (a.moving) {
        md.phase += a.dt * 7 * clamp(a.speed / 2, 0.6, 1.6);
        const h = Math.abs(Math.sin(md.phase));
        y += h * 0.35;
        sy = 0.8 + 0.12 * Math.cos(md.phase * 2);
      } else {
        sy = 0.8 + Math.sin(md.t * 3) * 0.03;
      }
      md.bodyMesh.position.set(0, y, lunge);
      md.bodyMesh.scale.set(sxz, sy, sxz);
      md.face.position.set(0, y - 0.44 + (sy - 0.8) * 0.4, lunge);
    },
  },

  beast: {
    height: 1.35,
    build(md, color) {
      const fur = md.mat(color);
      const dark = md.mat('#1f2937');
      md.torso = new THREE.Group();
      md.torso.position.y = 0.62;
      md.torso.add(box(0.6, 0.5, 1.1, fur));
      md.headG = new THREE.Group();
      md.headG.position.set(0, 0.2, 0.62);
      md.headG.add(box(0.46, 0.42, 0.46, fur));
      md.headG.add(box(0.26, 0.2, 0.28, fur, 0, -0.08, 0.3));
      md.headG.add(box(0.1, 0.08, 0.06, dark, 0, -0.04, 0.45));
      const ear = new THREE.ConeGeometry(0.09, 0.22, 4);
      const e1 = new THREE.Mesh(ear, fur);
      e1.position.set(-0.14, 0.3, -0.05);
      const e2 = new THREE.Mesh(ear, fur);
      e2.position.set(0.14, 0.3, -0.05);
      md.headG.add(e1, e2);
      eyes(md.headG, dark, 0.07, 0.235, 0.12);
      md.torso.add(md.headG);
      const tail = box(0.12, 0.12, 0.45, fur, 0, 0.15, -0.72);
      tail.rotation.x = 0.5;
      md.torso.add(tail);
      md.pivot.add(md.torso);
      md.legs = [];
      for (const [x, z] of [[-0.2, 0.38], [0.2, 0.38], [-0.2, -0.38], [0.2, -0.38]]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.45, z);
        leg.add(box(0.15, 0.45, 0.15, fur, 0, -0.22, 0));
        md.pivot.add(leg);
        md.legs.push(leg);
      }
    },
    animate(md, a) {
      let swing = 0;
      if (a.moving) {
        md.phase += a.dt * 11 * clamp(a.speed / 3, 0.6, 1.5);
        swing = Math.sin(md.phase) * 0.7;
      }
      md.legs[0].rotation.x = swing;
      md.legs[3].rotation.x = swing;
      md.legs[1].rotation.x = -swing;
      md.legs[2].rotation.x = -swing;
      md.torso.position.y = 0.62 + (a.moving ? Math.abs(Math.sin(md.phase)) * 0.06 : Math.sin(md.t * 3) * 0.01);
      md.torso.rotation.x = 0;
      md.torso.position.z = 0;
      if (a.state === 'windup') {
        const u = clamp(a.stateT / a.windupSec, 0, 1);
        md.torso.rotation.x = 0.25 * u;
        md.torso.position.z = -0.2 * u;
      } else if (a.state === 'recover' && a.stateT < 0.25) {
        const v = a.stateT / 0.25;
        md.torso.position.z = Math.sin(v * Math.PI) * 0.5;
        md.torso.rotation.x = -0.2 * Math.sin(v * Math.PI);
      }
    },
  },

  mushroom: {
    height: 1.45,
    build(md, color) {
      const stem = md.mat('#f1e4c8');
      const cap = md.mat(color);
      const dot = md.mat('#ffffff');
      md.bodyG = new THREE.Group();
      md.bodyG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.6, 8), stem));
      md.bodyG.children[0].position.y = 0.3;
      const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), cap);
      capMesh.position.y = 0.55;
      capMesh.scale.y = 0.85;
      md.bodyG.add(capMesh);
      for (const [x, z] of [[0.25, 0.25], [-0.3, 0.1], [0.05, -0.32], [-0.1, 0.35]]) {
        const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), dot);
        d.position.set(x, 0.85, z);
        md.bodyG.add(d);
      }
      eyes(md.bodyG, md.mat('#1f2937'), 0.38, 0.27, 0.1, 0.07);
      md.pivot.add(md.bodyG);
    },
    animate(md, a) {
      md.bodyG.rotation.set(0, 0, 0);
      md.bodyG.position.set(0, 0, 0);
      if (a.moving) {
        md.phase += a.dt * 9;
        md.bodyG.rotation.z = Math.sin(md.phase) * 0.18;
        md.bodyG.position.y = Math.abs(Math.sin(md.phase)) * 0.08;
      }
      if (a.state === 'windup') {
        const u = clamp(a.stateT / a.windupSec, 0, 1);
        md.bodyG.rotation.x = -0.45 * u;
      } else if (a.state === 'recover' && a.stateT < 0.25) {
        const v = a.stateT / 0.25;
        md.bodyG.rotation.x = 0.6 * Math.sin(v * Math.PI);
        md.bodyG.position.z = 0.3 * Math.sin(v * Math.PI);
      }
    },
  },

  golem: {
    height: 2.3,
    build(md, color) {
      const rock = md.mat(color);
      const darker = md.mat(new THREE.Color(color).multiplyScalar(0.7).getStyle());
      const glow = md.mat('#fde047', { emissive: '#fbbf24', emissiveIntensity: 0.9 });
      md.torso = new THREE.Group();
      md.torso.position.y = 1.2;
      md.torso.add(box(1.2, 1.0, 0.8, rock));
      md.torso.add(box(0.26, 0.26, 0.1, glow, 0, 0.1, 0.42));
      const head = box(0.5, 0.42, 0.5, darker, 0, 0.68, 0.1);
      md.torso.add(head);
      eyes(md.torso, glow, 0.72, 0.36, 0.12, 0.09);
      md.arms = [];
      for (const x of [-0.78, 0.78]) {
        const arm = new THREE.Group();
        arm.position.set(x, 0.35, 0);
        arm.add(box(0.42, 1.1, 0.42, darker, 0, -0.5, 0));
        arm.add(box(0.5, 0.4, 0.5, rock, 0, -1.1, 0));
        md.torso.add(arm);
        md.arms.push(arm);
      }
      md.pivot.add(md.torso);
      md.legs = [];
      for (const x of [-0.32, 0.32]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.7, 0);
        leg.add(box(0.42, 0.7, 0.45, darker, 0, -0.35, 0));
        md.pivot.add(leg);
        md.legs.push(leg);
      }
    },
    animate(md, a) {
      let swing = 0;
      if (a.moving) {
        md.phase += a.dt * 5;
        swing = Math.sin(md.phase) * 0.45;
      }
      md.legs[0].rotation.x = swing;
      md.legs[1].rotation.x = -swing;
      md.arms[0].rotation.set(-swing * 0.6, 0, 0);
      md.arms[1].rotation.set(swing * 0.6, 0, 0);
      md.torso.rotation.set(0, 0, a.moving ? Math.sin(md.phase) * 0.05 : 0);
      md.torso.position.y = 1.2 + (a.moving ? Math.abs(Math.sin(md.phase)) * 0.05 : Math.sin(md.t * 1.5) * 0.02);
      if (a.state === 'windup') {
        const u = easeOutCubic(clamp(a.stateT / a.windupSec, 0, 1));
        md.arms[0].rotation.x = -2.6 * u;
        md.arms[1].rotation.x = -2.6 * u;
        md.torso.rotation.x = -0.2 * u;
      } else if (a.state === 'recover' && a.stateT < 0.35) {
        const v = clamp(a.stateT / 0.12, 0, 1);
        md.arms[0].rotation.x = -2.6 + 2.2 * v;
        md.arms[1].rotation.x = -2.6 + 2.2 * v;
        md.torso.rotation.x = 0.25 * v;
      }
    },
  },

  bat: {
    height: 1.9,
    build(md, color) {
      const skin = md.mat(color);
      md.bodyG = new THREE.Group();
      md.bodyG.position.y = 1.3;
      md.bodyG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), skin));
      eyes(md.bodyG, md.mat('#f87171', { emissive: '#ef4444', emissiveIntensity: 0.8 }), 0.06, 0.27, 0.1, 0.07);
      const ear = new THREE.ConeGeometry(0.08, 0.2, 4);
      for (const x of [-0.13, 0.13]) {
        const e = new THREE.Mesh(ear, skin);
        e.position.set(x, 0.32, 0);
        md.bodyG.add(e);
      }
      const wingGeo = new THREE.BufferGeometry();
      wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.15, 0.85, 0.1, 0, 0, 0, -0.2, 0.85, 0.1, 0, 0.55, -0.15, -0.15, 0, 0, -0.2], 3));
      wingGeo.computeVertexNormals();
      const wingMat = md.mat(color, { side: THREE.DoubleSide });
      md.wingR = new THREE.Mesh(wingGeo, wingMat);
      md.wingR.position.x = 0.2;
      md.wingL = new THREE.Mesh(wingGeo, wingMat);
      md.wingL.position.x = -0.2;
      md.wingL.scale.x = -1;
      md.bodyG.add(md.wingR, md.wingL);
      md.pivot.add(md.bodyG);
    },
    animate(md, a) {
      const flap = Math.sin(md.t * (a.moving ? 16 : 11)) * 0.7;
      md.wingR.rotation.z = flap;
      md.wingL.rotation.z = -flap;
      md.bodyG.position.set(0, 1.3 + Math.sin(md.t * 2.5) * 0.12, 0);
      md.bodyG.rotation.x = a.moving ? 0.2 : 0;
      if (a.state === 'windup') {
        const u = clamp(a.stateT / a.windupSec, 0, 1);
        md.bodyG.position.y += 0.4 * u;
        md.bodyG.rotation.x = -0.4 * u;
      } else if (a.state === 'recover' && a.stateT < 0.25) {
        const v = a.stateT / 0.25;
        md.bodyG.position.y -= 0.6 * Math.sin(v * Math.PI);
        md.bodyG.position.z = 0.5 * Math.sin(v * Math.PI);
      }
    },
  },
};

export class MonsterModel {
  constructor(kind, { color = '#7dd3fc', size = 1 } = {}) {
    this.kindDef = KINDS[kind] ?? KINDS.slime;
    this.root = new THREE.Group();
    this.pivot = new THREE.Group(); // 크기 조절용
    this.pivot.scale.setScalar(size);
    this.root.add(this.pivot);
    this.materials = [];
    this.kindDef.build(this, color);
    this.shadow = createBlobShadow(0.55 * size);
    this.root.add(this.shadow);
    this.height = this.kindDef.height * size;
    this.size = size;
    this.t = Math.random() * 10;
    this.phase = Math.random() * 10;
    this.flashT = 0;
    this.flashColor = new THREE.Color('#ffffff');
    this.fade = 1; // 1 = 보임, 0 = 사라짐
    this.spawnT = 1;
  }

  mat(color, opts = {}) {
    const m = ownMat(color, opts);
    this.materials.push(m);
    return m;
  }

  flash(color = '#ffffff', sec = 0.12) {
    this.flashColor.set(color);
    this.flashT = sec;
  }

  /** 다시 나타날 때 커지며 등장 */
  playSpawn() {
    this.spawnT = 0;
    this.fade = 1;
    this.root.visible = true;
    this._setOpacity(1);
  }

  /**
   * @param {number} dt
   * @param {{moving:boolean, speed:number, state:string, stateT:number, windupSec:number}} a
   */
  update(dt, a) {
    this.t += dt;
    a.dt = dt;
    this.kindDef.animate(this, a, dt);

    // 죽음: 납작해지며 사라짐
    if (a.state === 'dead') {
      this.fade = Math.max(0, this.fade - dt * 1.8);
      this.pivot.scale.set(this.size * (1 + (1 - this.fade) * 0.3), this.size * Math.max(0.05, this.fade), this.size * (1 + (1 - this.fade) * 0.3));
      this._setOpacity(this.fade);
      this.root.visible = this.fade > 0;
    } else if (this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 2.5);
      this.pivot.scale.setScalar(this.size * easeOutCubic(this.spawnT));
    } else {
      this.pivot.scale.setScalar(this.size);
    }

    // 윈드업 중에는 빨갛게 깜빡이며 예고
    let emissive = null;
    let intensity = 0;
    if (this.flashT > 0) {
      this.flashT -= dt;
      emissive = this.flashColor;
      intensity = 0.8;
    } else if (a.state === 'windup') {
      emissive = WINDUP_COLOR;
      intensity = 0.25 + 0.25 * Math.sin(this.t * 18);
    }
    for (const m of this.materials) {
      if (m.userData.baseEmissive === undefined) {
        m.userData.baseEmissive = m.emissive.clone();
        m.userData.baseIntensity = m.emissiveIntensity;
      }
      if (emissive) {
        m.emissive.copy(emissive);
        m.emissiveIntensity = intensity;
      } else {
        m.emissive.copy(m.userData.baseEmissive);
        m.emissiveIntensity = m.userData.baseIntensity;
      }
    }
  }

  _setOpacity(o) {
    for (const m of this.materials) {
      m.transparent = o < 1;
      m.opacity = o;
    }
    this.shadow.visible = o > 0.3;
  }

  dispose() {
    this.root.removeFromParent();
    disposeObject(this.root);
  }
}

const WINDUP_COLOR = new THREE.Color('#ff2a2a');

export function createMonsterModel(kind, opts) {
  return new MonsterModel(kind, opts);
}
