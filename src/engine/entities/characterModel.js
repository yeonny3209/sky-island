// 로우폴리 사람 모델 + 코드로 만든 애니메이션 (걷기·점프·공격·피격·쓰러짐).
// 플레이어·다른 플레이어·NPC가 같이 쓴다. 앞쪽은 +Z.
// 나중에 .glb 모델로 바꿀 때도 update()/playAttack()/flash() 모양만 맞추면 된다.

import * as THREE from 'three';
import { clamp, lerp, easeOutCubic, easeInQuad } from '../core/mathUtils.js';
import { ownMat, createBlobShadow, disposeObject } from '../world/materials.js';

function limb(w, h, d, mat, offsetY) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = offsetY;
  pivot.add(m);
  return pivot;
}

function buildWeapon(item) {
  const g = new THREE.Group();
  const kind = item.model ?? 'sword';
  const metal = ownMat(item.color ?? '#cbd5e1', { metalness: 0.4, roughness: 0.45 });
  const wood = ownMat('#7a5230');
  const gold = ownMat('#d4a72c', { metalness: 0.5, roughness: 0.4 });
  if (kind === 'axe') {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), wood);
    handle.position.y = -0.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.34), metal);
    head.position.set(0, -0.75, 0.14);
    g.add(handle, head);
  } else if (kind === 'staff') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), wood);
    rod.position.y = -0.45;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), ownMat(item.color ?? '#a78bfa', { emissive: item.color ?? '#a78bfa', emissiveIntensity: 0.6 }));
    gem.position.y = -1.15;
    g.add(rod, gem);
  } else {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.03), metal);
    blade.position.y = -0.6;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.09), gold);
    guard.position.y = -0.1;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), wood);
    grip.position.y = -0.0;
    g.add(blade, guard, grip);
  }
  return g;
}

export class CharacterModel {
  constructor({ color = '#3b82f6', skin = '#f2c9a0', hair = '#4b3621', pants = '#374151' } = {}) {
    this.root = new THREE.Group();
    this.mats = {
      body: ownMat(color),
      skin: ownMat(skin),
      hair: ownMat(hair),
      pants: ownMat(pants),
      dark: ownMat('#1f2937'),
      boots: ownMat('#5b3a29'),
    };
    const m = this.mats;

    this.body = new THREE.Group();
    this.root.add(this.body);
    this.hips = new THREE.Group();
    this.hips.position.y = 0.9;
    this.body.add(this.hips);

    this.legL = limb(0.22, 0.9, 0.24, m.pants, -0.45);
    this.legL.position.x = -0.15;
    this.legR = limb(0.22, 0.9, 0.24, m.pants, -0.45);
    this.legR.position.x = 0.15;
    for (const leg of [this.legL, this.legR]) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.32), m.boots);
      boot.position.set(0, -0.82, 0.04);
      leg.add(boot);
    }
    this.hips.add(this.legL, this.legR);

    this.upper = new THREE.Group();
    this.hips.add(this.upper);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), m.body);
    torso.position.y = 0.35;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.38), m.dark);
    belt.position.y = 0.05;
    this.upper.add(torso, belt);

    this.head = new THREE.Group();
    this.head.position.y = 0.95;
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.42), m.skin);
    const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.46), m.hair);
    hairMesh.position.y = 0.22;
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.1), m.hair);
    hairBack.position.set(0, 0.08, -0.2);
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.08, 0.02);
    const eyeL = new THREE.Mesh(eyeGeo, m.dark);
    eyeL.position.set(-0.1, 0.02, 0.215);
    const eyeR = new THREE.Mesh(eyeGeo, m.dark);
    eyeR.position.set(0.1, 0.02, 0.215);
    this.head.add(headMesh, hairMesh, hairBack, eyeL, eyeR);
    this.upper.add(this.head);

    this.armL = limb(0.17, 0.62, 0.18, m.body, -0.29);
    this.armL.position.set(-0.41, 0.62, 0);
    this.armR = limb(0.17, 0.62, 0.18, m.body, -0.29);
    this.armR.position.set(0.41, 0.62, 0);
    for (const arm of [this.armL, this.armR]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), m.skin);
      hand.position.y = -0.64;
      arm.add(hand);
    }
    this.weaponMount = new THREE.Group();
    this.weaponMount.position.y = -0.66;
    this.armR.add(this.weaponMount);
    this.upper.add(this.armL, this.armR);

    this.shadow = createBlobShadow(0.5);
    this.root.add(this.shadow);

    this.height = 2.05;
    this.phase = 0;
    this.t = 0;
    this.attack = null;
    this.flashT = 0;
    this.flashColor = new THREE.Color('#ff3b3b');
    this.deadT = 0;
    this.weaponItemId = null;
    this.opacity = 1;
  }

  setWeapon(item) {
    const id = item ? item.id : null;
    if (id === this.weaponItemId) return;
    this.weaponItemId = id;
    for (const c of [...this.weaponMount.children]) {
      this.weaponMount.remove(c);
      disposeObject(c);
    }
    if (item) this.weaponMount.add(buildWeapon(item));
  }

  /** @param {'slash'|'spin'|'thrust'|'slam'} style */
  playAttack(style, castSec, totalSec) {
    this.attack = { style, t: 0, hit: Math.max(0.05, castSec), total: Math.max(totalSec, castSec + 0.1) };
  }

  flash(color = '#ff3b3b', sec = 0.15) {
    this.flashColor.set(color);
    this.flashT = sec;
  }

  /**
   * @param {number} dt
   * @param {{speed:number, grounded:boolean, dead:boolean}} s
   */
  update(dt, s) {
    this.t += dt;
    const moving = s.speed > 0.3 && s.grounded && !s.dead;
    if (moving) this.phase += dt * (5 + s.speed * 1.3);
    const k = clamp(s.speed / 5, 0, 1);
    const swing = moving ? Math.sin(this.phase) * 0.85 * k : 0;

    // 기본 자세 (걷기/서 있기)
    this.body.position.set(0, moving ? Math.abs(Math.sin(this.phase)) * 0.07 : Math.sin(this.t * 2.2) * 0.012, 0);
    this.body.rotation.set(0, 0, 0);
    this.upper.rotation.set(0, 0, 0);
    this.legL.rotation.set(swing, 0, 0);
    this.legR.rotation.set(-swing, 0, 0);
    this.armL.rotation.set(-swing * 0.7, 0, 0.06);
    this.armR.rotation.set(swing * 0.7 - (this.weaponItemId ? 0.18 : 0), 0, -0.06);

    if (!s.grounded && !s.dead) {
      this.legL.rotation.x = -0.7;
      this.legR.rotation.x = 0.35;
      this.armL.rotation.set(-0.6, 0, 0.35);
      this.armR.rotation.set(-0.6, 0, -0.35);
    }

    if (this.attack) this._applyAttack(dt);

    // 쓰러짐
    if (s.dead) {
      this.deadT = Math.min(1, this.deadT + dt * 2.5);
      const e = easeOutCubic(this.deadT);
      this.body.rotation.x = -Math.PI / 2 * e;
      this.body.position.y = 0.2 * e;
      this.body.position.z = -0.6 * e;
      this.attack = null;
    } else {
      this.deadT = 0;
    }

    // 그림자는 늘 땅(y=0)에
    const h = this.root.position.y;
    this.shadow.position.y = -h + 0.03;
    this.shadow.scale.setScalar(clamp(1 - h * 0.12, 0.4, 1));
    this.shadow.visible = h > -1;

    // 맞았을 때 번쩍
    if (this.flashT > 0) {
      this.flashT -= dt;
      const on = this.flashT > 0;
      for (const mat of Object.values(this.mats)) {
        if (on) mat.emissive.copy(this.flashColor);
        else mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = on ? 0.6 : 1;
      }
    }
  }

  _applyAttack(dt) {
    const a = this.attack;
    a.t += dt;
    const windEnd = a.hit * 0.75;
    const strikeEnd = a.hit + 0.1;
    const u = clamp(a.t / windEnd, 0, 1); // 준비
    const v = clamp((a.t - windEnd) / (strikeEnd - windEnd), 0, 1); // 휘두름
    const w = clamp((a.t - strikeEnd) / Math.max(0.05, a.total - strikeEnd), 0, 1); // 복귀
    const back = 1 - easeOutCubic(w);

    if (a.style === 'spin') {
      this.body.position.y -= 0.1 * u * back;
      this.armR.rotation.set(-1.4 * Math.max(u, v) * back, 0, -1.1 * Math.max(u, v) * back);
      this.armL.rotation.set(-0.3, 0, 0.9 * Math.max(u, v) * back);
      this.body.rotation.y = Math.PI * 2 * easeOutCubic(clamp((a.t - windEnd) / (a.total - windEnd) * 1.6, 0, 1));
    } else if (a.style === 'thrust') {
      const arm = v > 0 ? lerp(0.6, -1.55, easeOutCubic(v)) : lerp(0, 0.6, u);
      this.armR.rotation.set(arm * back, 0, 0);
      this.upper.rotation.y = (v > 0 ? lerp(0.5, -0.35, easeOutCubic(v)) : 0.5 * u) * back;
      this.body.position.z = (v > 0 ? 0.35 * easeOutCubic(v) : -0.1 * u) * back;
      this.legL.rotation.x = -0.4 * back;
      this.legR.rotation.x = 0.3 * back;
    } else if (a.style === 'slam') {
      const arm = v > 0 ? lerp(-2.9, -0.5, easeInQuad(v)) : lerp(0, -2.9, easeOutCubic(u));
      this.armR.rotation.set(arm * back, 0, 0);
      this.armL.rotation.set(arm * back * 0.9, 0, 0);
      this.body.rotation.x = (v > 0 ? 0.25 * v : -0.15 * u) * back;
    } else {
      // slash: 오른쪽으로 비틀었다가 왼쪽으로 크게 벤다
      const twist = v > 0 ? lerp(0.9, -1.1, easeOutCubic(v)) : 0.9 * easeOutCubic(u);
      this.upper.rotation.y = twist * back;
      this.armR.rotation.set(-1.4 * Math.max(u, v > 0 ? 1 : 0) * back, 0, -0.3 * back);
      this.legL.rotation.x = -0.25 * back;
      this.legR.rotation.x = 0.2 * back;
    }
    if (a.t >= a.total) this.attack = null;
  }

  setOpacity(opacity) {
    if (opacity === this.opacity) return;
    this.opacity = opacity;
    this.root.traverse((o) => {
      if (o.material && !o.material.userData.shared) {
        o.material.transparent = opacity < 1;
        o.material.opacity = opacity;
      }
    });
  }

  dispose() {
    this.root.removeFromParent();
    disposeObject(this.root);
  }
}

export function createCharacterModel(opts) {
  return new CharacterModel(opts);
}
