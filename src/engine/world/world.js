// 현재 섬: 지형·소품·포탈·NPC를 만들고, 충돌(소품·가장자리)과 포탈/NPC 근처 검사를 맡는다.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { dirToYaw } from '../core/mathUtils.js';
import { buildIslandLayout } from './islandLayout.js';
import { buildIslandMesh } from './islandBuilder.js';
import { createPropMesh } from './props.js';
import { disposeObject, sharedMat } from './materials.js';
import { CharacterModel } from '../entities/characterModel.js';

const PORTAL_OPEN = { ring: '#a78bfa', glow: '#8b5cf6', inner: '#c4b5fd' };
const PORTAL_LOCKED = { ring: '#6b7280', glow: '#374151', inner: '#9ca3af' };

export class World {
  constructor(game) {
    this.game = game;
    this.island = null;
    this.layout = null;
    this.group = null;
    this.floaters = [];
    this.portals = [];
    this.npcs = [];
    this.time = 0;
  }

  get radius() {
    return this.layout ? this.layout.radius : 20;
  }

  load(island) {
    this.unload();
    const game = this.game;
    this.island = island;
    this.layout = buildIslandLayout(island, game.data);
    this.group = new THREE.Group();
    const { group, floaters } = buildIslandMesh(island, this.layout);
    this.group.add(group);
    this.floaters = floaters;
    for (const p of this.layout.props) this.group.add(createPropMesh(p));
    this.portals = this.layout.portals.map((p) => this._createPortal(p));
    this.npcs = this.layout.npcs.map((n) => this._createNpc(n));
    game.scene.add(this.group);
    game.sky.setTheme(island.theme);
    this.refreshPortals();
  }

  unload() {
    for (const p of this.portals) p.label.dispose();
    for (const n of this.npcs) {
      n.label.dispose();
      n.model.dispose();
    }
    if (this.group) {
      this.group.removeFromParent();
      disposeObject(this.group);
    }
    this.group = null;
    this.portals = [];
    this.npcs = [];
    this.floaters = [];
    this.island = null;
    this.layout = null;
  }

  _createPortal(p) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.yaw;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 0.3, 10), sharedMat('#9aa0a8'));
    base.position.y = 0.15;
    const ringMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.5, emissiveIntensity: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.14, 8, 28), ringMat);
    ring.position.y = 1.6;
    const innerMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    const inner = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28), innerMat);
    inner.position.y = 1.6;
    const sparkles = [];
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), sparkMat);
      g.add(s);
      sparkles.push(s);
    }
    g.add(base, ring, inner);
    this.group.add(g);
    const label = this.game.labels.create({ text: '', offsetY: 3.3 }).follow(g);
    return { ...p, group: g, ring, inner, ringMat, innerMat, sparkles, label, locked: false };
  }

  _createNpc(n) {
    const model = new CharacterModel({ color: n.color, hair: '#2b2118' });
    model.root.position.set(n.x, 0, n.z);
    model.root.rotation.y = n.yaw;
    this.group.add(model.root);
    const label = this.game.labels.create({ text: n.name, color: '#fde68a', offsetY: 2.35 }).follow(model.root);
    return { ...n, model, label };
  }

  /** 섬 해금 상태가 바뀌면 포탈 색과 이름표를 다시 칠한다 */
  refreshPortals() {
    const { data, character } = this.game;
    for (const portal of this.portals) {
      const target = data.getIsland(portal.to);
      const locked = character ? !character.isIslandUnlocked(portal.to) : data.lockedIslands.has(portal.to);
      portal.locked = locked;
      const c = locked ? PORTAL_LOCKED : PORTAL_OPEN;
      portal.ringMat.color.set(c.ring);
      portal.ringMat.emissive.set(c.glow);
      portal.innerMat.color.set(c.inner);
      for (const s of portal.sparkles) s.visible = !locked;
      portal.label.setText(target ? target.name : portal.to, locked ? '잠김' : '포탈');
      portal.label.setColor(locked ? '#d1d5db' : '#e9d5ff');
    }
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    for (const f of this.floaters) f.obj.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * 0.6;
    for (const p of this.portals) {
      p.ring.rotation.z = t * (p.locked ? 0.2 : 0.8);
      p.innerMat.opacity = p.locked ? 0.2 : 0.4 + Math.sin(t * 3) * 0.12;
      p.sparkles.forEach((s, i) => {
        const a = t * 1.5 + (i / p.sparkles.length) * Math.PI * 2;
        s.position.set(Math.cos(a) * 1.25, 1.6 + Math.sin(a) * 1.25, Math.sin(t * 2 + i) * 0.15);
      });
    }
    for (const n of this.npcs) n.model.update(dt, { speed: 0, grounded: true, dead: false });
  }

  /** 소품과 겹치지 않게 밀어내고, 섬 가장자리 밖으로 못 나가게 한다 */
  resolveCircle(pos, radius, edgeMargin = CONFIG.player.edgeMargin) {
    if (!this.layout) return;
    for (const c of this.layout.colliders) {
      let dx = pos.x - c.x;
      let dz = pos.z - c.z;
      let d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min) {
        if (d < 1e-4) {
          dx = 1;
          dz = 0;
          d = 1;
        }
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
    const maxR = this.layout.radius - edgeMargin;
    const d = Math.hypot(pos.x, pos.z);
    if (d > maxR) {
      pos.x *= maxR / d;
      pos.z *= maxR / d;
    }
  }

  isOnIsland(x, z) {
    return !!this.layout && Math.hypot(x, z) <= this.layout.radius;
  }

  /** 도착 위치. 다른 섬에서 포탈로 왔으면 그 섬으로 가는 포탈 앞에 선다 */
  spawnPosition(fromIslandId = null) {
    const portal = fromIslandId ? this.portals.find((p) => p.to === fromIslandId) : null;
    if (portal) {
      const len = Math.hypot(portal.x, portal.z) || 1;
      const dx = -portal.x / len;
      const dz = -portal.z / len;
      return { x: portal.x + dx * 2.8, y: 0, z: portal.z + dz * 2.8, yaw: dirToYaw(dx, dz) };
    }
    const s = this.layout.spawn;
    return { x: s.x, y: s.y, z: s.z, yaw: Math.PI };
  }

  portalAt(x, z) {
    const r = CONFIG.world.portalTriggerRadius;
    return this.portals.find((p) => Math.hypot(p.x - x, p.z - z) <= r) ?? null;
  }

  npcNear(x, z) {
    let best = null;
    let bestD = CONFIG.world.interactRadius;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - x, n.z - z);
      if (d <= bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }
}
