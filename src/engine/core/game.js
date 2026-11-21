// 게임 본체: 렌더러·장면·루프를 만들고 모든 시스템을 연결한다.
// UI(B)는 이 객체의 공개 API와 game.events만 쓰면 된다 (src/engine/README.md).

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { EventBus } from './events.js';
import { loadGameData } from './data.js';
import { Sky } from '../world/sky.js';
import { World } from '../world/world.js';
import { LabelLayer, injectEngineStyles } from '../fx/labels.js';
import { DamageText } from '../fx/damageText.js';
import { Effects } from '../fx/effects.js';
import { InputManager } from '../input/input.js';
import { CameraRig } from '../camera/cameraRig.js';
import { LocalPlayer } from '../entities/localPlayer.js';
import { MonsterManager } from '../combat/monsterManager.js';
import { CombatSystem } from '../combat/combatSystem.js';
import { NetSync } from '../net/netSync.js';
import { Session } from '../save/session.js';
import { SaveManager } from '../save/saveManager.js';

const ORIGIN = new THREE.Vector3();

export class Game {
  constructor(container) {
    this.container = container;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.style.touchAction = 'none';
    injectEngineStyles();

    this.events = new EventBus();
    this.data = loadGameData();
    this.time = 0;
    this.inWorld = false;
    this.traveling = false;
    this.character = null;
    this.player = null;
    this.portalCooldown = 0;
    this._nearNpc = null;
    this._lockedNotified = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.render.fov, 1, CONFIG.render.near, CONFIG.render.far);

    this.overlayRoot = document.createElement('div');
    this.overlayRoot.className = 'si-overlay';
    container.appendChild(this.overlayRoot);
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'si-fade';
    container.appendChild(this.fadeEl);

    this.labels = new LabelLayer(this.overlayRoot, this.camera);
    this.damageText = new DamageText(this.overlayRoot, this.camera);
    this.fx = new Effects(this.scene);
    this.sky = new Sky(this.scene);
    this.input = new InputManager(this);
    this.input.enabled = false;
    this.cameraRig = new CameraRig(this);
    this.world = new World(this);
    this.monsters = new MonsterManager(this);
    this.combat = new CombatSystem(this);
    this.session = new Session(this);
    this.save = new SaveManager(this);
    this.net = new NetSync(this);

    this._resize();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this._resize()).observe(container);
    window.addEventListener('resize', () => this._resize());

    this.showPreview();
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  /** 실제 시간(초). 네트워크 보간 등에 쓴다 */
  get now() {
    return performance.now() / 1000;
  }

  _resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    const aspect = w / h;
    this.camera.aspect = aspect;
    // 세로 화면(폰 세로)에서는 좌우가 너무 좁아지지 않게 세로 시야각을 넓힌다
    const base = CONFIG.render.fov;
    this.camera.fov =
      aspect >= 1 ? base : Math.min(CONFIG.render.portraitMaxFov, (2 * Math.atan(Math.tan((base * Math.PI) / 360) / aspect) * 180) / Math.PI);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /** 로그인 화면 뒤 배경: 허브 섬을 천천히 돌며 보여 준다 */
  showPreview() {
    const hub = this.data.getIsland(this.data.hubId);
    this.world.load(hub);
    this.cameraRig.setOrbit(new THREE.Vector3(0, 0, 0));
  }

  // ---------- 월드 들어가기/나가기/섬 이동

  async enterWorld() {
    if (this.inWorld) return { ok: true };
    const ch = this.session.character;
    if (!ch) return { ok: false, error: '캐릭터가 없습니다' };
    this.character = ch;
    this.save.attach(ch);
    this.combat.setupForClass(ch.classDef);
    this.player = new LocalPlayer(this, ch);
    this.cameraRig.setOrbit(null);

    let islandId = ch.islandId;
    if (!islandId || !this.data.getIsland(islandId) || !ch.isIslandUnlocked(islandId)) islandId = this.data.hubId;
    const restorePos = islandId === ch.islandId ? ch.pos : null;

    this.inWorld = true;
    this.net.connectGlobal().catch((err) => console.warn('[네트워크] 전체 채널 접속 실패', err));
    await this.travel(islandId, { restorePos, instant: true, force: true });
    this.input.enabled = true;
    this.input.touch.setVisible(true);

    this.events.emit('world:entered', { name: ch.name, islandId });
    this._emitInitialState();
    return { ok: true };
  }

  _emitInitialState() {
    const ch = this.character;
    this.events.emit('player:stats', { ...ch.stats });
    this.events.emit('player:hp', { hp: Math.round(this.player.hp), maxHp: this.player.maxHp });
    this.events.emit('player:exp', ch.expInfo());
    this.events.emit('player:gold', { gold: ch.gold, delta: 0 });
    this.events.emit('inventory:changed', { inventory: ch.inventory.map((s) => ({ ...s })) });
    this.events.emit('equipment:changed', { equipment: { ...ch.equipment } });
    this.events.emit('skills:changed', { slots: this.combat.getSlots() });
    this.events.emit('net:status', this.net.status());
  }

  async leaveWorld() {
    if (!this.inWorld) return;
    await this.save.saveNow('leave');
    this.inWorld = false;
    this.input.enabled = false;
    this.input.releaseAll();
    this.input.touch.setVisible(false);
    await this.net.disconnect();
    this.monsters.clear();
    this.fx.clear();
    this.damageText.clear();
    if (this.player) this.player.dispose();
    this.player = null;
    this.character = null;
    this.save.attach(null);
    this.showPreview();
    this.events.emit('world:left', {});
  }

  /**
   * 섬 이동.
   * @param {string} islandId
   * @param {{from?:string, restorePos?:{x:number,z:number}, instant?:boolean, force?:boolean}} opts
   */
  async travel(islandId, { from = null, restorePos = null, instant = false, force = false } = {}) {
    const island = this.data.getIsland(islandId);
    if (!island) return { ok: false, error: '없는 섬입니다' };
    if (!this.inWorld || !this.player) return { ok: false, error: '월드에 들어가 있지 않습니다' };
    if (this.traveling && !force) return { ok: false, error: '이동 중입니다' };
    if (!this.character.isIslandUnlocked(islandId)) return { ok: false, error: '아직 잠긴 섬입니다' };

    this.traveling = true;
    this.combat.cancel();
    this.events.emit('island:leaving', { islandId: this.world.island ? this.world.island.id : null });
    if (!instant) await this._fade(true);

    this.monsters.clear();
    this.fx.clear();
    this.damageText.clear();
    this.world.load(island);
    let spawn = this.world.spawnPosition(from);
    if (restorePos && Math.hypot(restorePos.x, restorePos.z) < this.world.radius - 1) {
      spawn = { x: restorePos.x, y: 0, z: restorePos.z, yaw: Math.PI };
    }
    this.player.teleport(spawn.x, spawn.y, spawn.z, spawn.yaw);
    this.world.resolveCircle(this.player.pos, this.player.radius);
    this.cameraRig.initialized = false;
    this.monsters.spawnForIsland(this.world.layout);
    this.character.setLocation(islandId, this.player.pos);
    this.save.markDirty(true);
    this.portalCooldown = 1;
    this._nearNpc = null;
    this.input.touch.setInteract(null);

    // 접속은 기다리지 않는다 (느린 망에서도 바로 움직일 수 있게). 접속되면 다른 사람이 보인다.
    this.net.joinIsland(islandId).catch((err) => console.warn('[네트워크] 섬 채널 접속 실패', err));
    this.traveling = false;
    if (!instant) this._fade(false);
    this.events.emit('island:entered', { islandId, name: island.name, type: island.type });
    return { ok: true };
  }

  _fade(on) {
    this.fadeEl.classList.toggle('on', on);
    return new Promise((resolve) => setTimeout(resolve, 260));
  }

  // ---------- UI가 부르는 편의 함수

  /** 소비 아이템 사용 (회복 등) */
  useItem(itemId) {
    if (!this.character || !this.player) return { ok: false, reason: '월드에 들어가 있지 않습니다' };
    if (this.player.dead) return { ok: false, reason: '쓰러진 상태입니다' };
    const res = this.character.useItem(itemId);
    if (res.ok && res.effect.heal) this.player.heal(res.effect.heal);
    return res;
  }

  /** 현재 상태 한 번에 보기 (UI 첫 그리기용) */
  getState() {
    const ch = this.character;
    if (!ch || !this.player) return null;
    return {
      name: ch.name,
      classId: ch.classId,
      level: ch.level,
      exp: ch.exp,
      expToNext: ch.expToNext,
      gold: ch.gold,
      hp: Math.round(this.player.hp),
      maxHp: this.player.maxHp,
      stats: { ...ch.stats },
      inventory: ch.inventory.map((s) => ({ ...s })),
      equipment: { ...ch.equipment },
      islandId: this.world.island ? this.world.island.id : null,
      islandName: this.world.island ? this.world.island.name : '',
      skills: this.combat.getSlots(),
      cameraMode: this.cameraRig.mode,
      net: this.net.status(),
    };
  }

  // ---------- 루프

  _frame() {
    const nowMs = performance.now();
    const dt = Math.min(0.1, Math.max(0, (nowMs - this._last) / 1000));
    this._last = nowMs;
    this.time += dt;
    const input = this.input;
    input.update();

    // 한 시스템에서 오류가 나도 나머지(저장·네트워크·그리기)는 계속 돌도록 나눠서 감싼다
    if (this.inWorld && this.player) {
      const cd = input.cameraDelta;
      if (cd.x || cd.y) this.cameraRig.rotate(cd.x, cd.y, cd.speed);
      if (input.zoomDelta) this.cameraRig.zoom(input.zoomDelta);
      if (input.consumePressed('toggleCamera')) this.cameraRig.toggleMode(this.player.yaw);

      this._safe('player', () => this.player.update(dt));
      this._safe('combat', () => this.combat.update(dt));
      this._safe('monsters', () => this.monsters.update(dt));
      this._safe('net', () => this.net.update(dt));
      this._safe('interact', () => this._checkInteractions(dt));
      this._safe('save', () => this.save.update(dt));
      this.cameraRig.update(dt, this.player.pos);
      input.touch.updateSlots(this.combat.getSlots());
    } else {
      this.cameraRig.update(dt, ORIGIN);
    }

    this._safe('world', () => {
      this.world.update(dt);
      this.fx.update(dt);
      this.sky.update(dt, this.camera.position);
    });
    this.renderer.render(this.scene, this.camera);
    this.labels.update(this.width, this.height);
    this.damageText.update(dt, this.width, this.height);
    input.endFrame();
  }

  /** 매 프레임 같은 오류로 콘솔이 넘치지 않게, 같은 곳의 오류는 5초에 한 번만 찍는다 */
  _safe(name, fn) {
    try {
      fn();
    } catch (err) {
      if (!this._errAt) this._errAt = {};
      const now = performance.now();
      if (!this._errAt[name] || now - this._errAt[name] > 5000) {
        this._errAt[name] = now;
        console.error(`[엔진:${name}] 프레임 처리 중 오류`, err);
      }
    }
  }

  _checkInteractions(dt) {
    const p = this.player;
    if (this.traveling || p.dead) return;
    this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    const portal = this.world.portalAt(p.pos.x, p.pos.z);
    if (portal && this.portalCooldown <= 0) {
      if (portal.locked) {
        if (!this._lockedNotified) {
          this._lockedNotified = true;
          const target = this.data.getIsland(portal.to);
          this.events.emit('portal:locked', { islandId: portal.to, name: target ? target.name : portal.to });
        }
      } else {
        this.travel(portal.to, { from: this.world.island.id });
      }
    } else if (!portal) {
      this._lockedNotified = false;
    }

    const npc = this.world.npcNear(p.pos.x, p.pos.z);
    if (npc !== this._nearNpc) {
      this._nearNpc = npc;
      this.input.touch.setInteract(npc ? '대화' : null);
      this.events.emit('interact:changed', { npc: npc ? { id: npc.id, name: npc.name } : null });
    }
    if (this.input.consumePressed('interact') && npc) {
      this.events.emit('npc:interact', { npcId: npc.id, name: npc.name, islandId: this.world.island.id });
    }
  }
}
