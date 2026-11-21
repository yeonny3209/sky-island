// 하늘(그라데이션 돔), 조명, 섬 아래 구름 바다.

import * as THREE from 'three';
import { THEME_DEFAULTS } from '../core/dataBuilder.js';
import { createRng, randRange } from '../core/mathUtils.js';
import { sharedMat } from './materials.js';

const DOME_RADIUS = 450;

export class Sky {
  constructor(scene) {
    this.scene = scene;

    const domeGeo = new THREE.SphereGeometry(DOME_RADIUS, 32, 16);
    domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(domeGeo.attributes.position.count * 3), 3));
    this.dome = new THREE.Mesh(
      domeGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5d7a4a, 1.2);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
    this.sun.position.set(30, 50, 20);
    scene.add(this.hemi, this.sun);

    scene.fog = new THREE.Fog(THEME_DEFAULTS.fog, 60, 230);

    this.clouds = new THREE.Group();
    scene.add(this.clouds);
    this._buildClouds();
    this.setTheme(THEME_DEFAULTS);
  }

  _buildClouds() {
    const rng = createRng('clouds');
    const mat = sharedMat('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.15 });
    const puff = new THREE.IcosahedronGeometry(1, 0);
    puff.userData.shared = true;
    const make = (x, y, z, s, flat) => {
      const cloud = new THREE.Group();
      const n = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(puff, mat);
        m.position.set((i - n / 2) * s * 0.9 + randRange(rng, -0.3, 0.3) * s, randRange(rng, -0.2, 0.3) * s, randRange(rng, -0.4, 0.4) * s);
        m.scale.setScalar(s * randRange(rng, 0.8, 1.4));
        cloud.add(m);
      }
      cloud.scale.y = flat;
      cloud.position.set(x, y, z);
      cloud.userData.speed = randRange(rng, 0.4, 1.2);
      this.clouds.add(cloud);
    };
    // 섬 아래 구름 바다
    for (let i = 0; i < 34; i++) {
      const a = rng() * Math.PI * 2;
      const r = randRange(rng, 15, 200);
      make(Math.cos(a) * r, randRange(rng, -48, -24), Math.sin(a) * r, randRange(rng, 5, 11), 0.45);
    }
    // 멀리 떠 있는 구름
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2;
      const r = randRange(rng, 90, 220);
      make(Math.cos(a) * r, randRange(rng, -6, 30), Math.sin(a) * r, randRange(rng, 3, 7), 0.6);
    }
  }

  setTheme(theme) {
    const top = new THREE.Color(theme.skyTop ?? THEME_DEFAULTS.skyTop);
    const horizon = new THREE.Color(theme.skyHorizon ?? THEME_DEFAULTS.skyHorizon);
    const below = horizon.clone().lerp(new THREE.Color('#ffffff'), 0.35);
    const pos = this.dome.geometry.attributes.position;
    const col = this.dome.geometry.attributes.color;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / DOME_RADIUS;
      if (y >= 0) c.copy(horizon).lerp(top, Math.pow(y, 0.55));
      else c.copy(horizon).lerp(below, Math.min(1, -y * 2));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    this.scene.fog.color.set(theme.fog ?? THEME_DEFAULTS.fog);
  }

  update(dt, cameraPosition) {
    this.dome.position.copy(cameraPosition);
    for (const cloud of this.clouds.children) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 230) cloud.position.x -= 460;
    }
  }
}
