// 카메라: 쿼터뷰(위에서 비스듬히) ↔ 3인칭(등 뒤) 전환.
//  - 마우스 오른쪽 드래그 / 터치 드래그: 회전 (쿼터뷰는 좌우만)
//  - 휠 / 두 손가락 벌리기: 줌
// 선택한 모드는 이 기기의 localStorage에 기억한다.

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, dampAngle } from '../core/mathUtils.js';

const SETTINGS_KEY = 'sky-island:settings';
const DEG = Math.PI / 180;

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(patch) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...patch }));
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)는 무시
  }
}

export class CameraRig {
  constructor(game) {
    this.game = game;
    this.camera = game.camera;
    const saved = loadSettings();
    this.mode = saved.cameraMode === 'third' || saved.cameraMode === 'quarter' ? saved.cameraMode : CONFIG.camera.defaultMode;
    const q = CONFIG.camera.quarter;
    const t = CONFIG.camera.third;
    // 목표값(want)과 화면에 보이는 현재값(cur)을 따로 두고 부드럽게 따라간다
    this.want = {
      quarter: { yaw: q.yawDeg * DEG, pitch: q.pitchDeg * DEG, distance: q.distance },
      third: { yaw: Math.PI, pitch: t.pitchDeg * DEG, distance: t.distance },
    };
    this.cur = { ...this.want[this.mode] };
    this.target = new THREE.Vector3();
    this.initialized = false;
    this.orbit = null; // 로그인 화면 등에서 천천히 도는 연출
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ndc = new THREE.Vector2();
    this._hit = new THREE.Vector3();
  }

  /** 이동 기준 각도 (카메라가 서 있는 방향) */
  get yaw() {
    return this.cur.yaw;
  }

  /** 카메라가 바라보는 방향의 yaw */
  get forwardYaw() {
    return this.cur.yaw + Math.PI;
  }

  setMode(mode, facingYaw = null) {
    if (mode !== 'quarter' && mode !== 'third') return;
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'third' && facingYaw !== null) {
      this.want.third.yaw = facingYaw + Math.PI; // 캐릭터 등 뒤에서 시작
    }
    const w = this.want[mode];
    this.cur.pitch = w.pitch;
    this.cur.distance = w.distance;
    this.cur.yaw = mode === 'third' ? w.yaw : this.cur.yaw;
    if (mode === 'quarter') this.cur.yaw = w.yaw;
    saveSettings({ cameraMode: mode });
    this.game.events.emit('camera:mode', { mode });
  }

  toggleMode(facingYaw = null) {
    this.setMode(this.mode === 'quarter' ? 'third' : 'quarter', facingYaw);
  }

  rotate(dx, dy, speed = CONFIG.camera.rotateSpeed) {
    const w = this.want[this.mode];
    w.yaw -= dx * speed;
    if (this.mode === 'third') {
      const t = CONFIG.camera.third;
      w.pitch = clamp(w.pitch + dy * speed, t.minPitchDeg * DEG, t.maxPitchDeg * DEG);
    }
  }

  zoom(delta) {
    const cfg = CONFIG.camera[this.mode];
    const w = this.want[this.mode];
    w.distance = clamp(w.distance * Math.exp(delta * 0.0012), cfg.minDistance, cfg.maxDistance);
  }

  /** 로그인 화면용: 한 점을 중심으로 천천히 돈다. null이면 해제 */
  setOrbit(center) {
    this.orbit = center ? { center: center.clone(), angle: 0 } : null;
    this.initialized = false;
  }

  update(dt, focus) {
    if (this.orbit) {
      this.orbit.angle += dt * 0.06;
      const c = this.orbit.center;
      this.camera.position.set(c.x + Math.sin(this.orbit.angle) * 34, c.y + 16, c.z + Math.cos(this.orbit.angle) * 34);
      this.camera.lookAt(c);
      return;
    }
    const cfg = CONFIG.camera[this.mode];
    const w = this.want[this.mode];
    const desiredX = focus.x;
    const desiredY = Math.max(0, focus.y) * (this.mode === 'third' ? 1 : 0.5) + cfg.targetHeight;
    const desiredZ = focus.z;
    if (!this.initialized) {
      this.target.set(desiredX, desiredY, desiredZ);
      this.cur.yaw = w.yaw;
      this.cur.pitch = w.pitch;
      this.cur.distance = w.distance;
      this.initialized = true;
    } else {
      const lambda = CONFIG.camera.followLambda;
      this.target.x = damp(this.target.x, desiredX, lambda, dt);
      this.target.y = damp(this.target.y, desiredY, lambda * 0.6, dt);
      this.target.z = damp(this.target.z, desiredZ, lambda, dt);
      this.cur.yaw = dampAngle(this.cur.yaw, w.yaw, 18, dt);
      this.cur.pitch = damp(this.cur.pitch, w.pitch, 18, dt);
      this.cur.distance = damp(this.cur.distance, w.distance, 10, dt);
    }
    const { yaw, pitch, distance } = this.cur;
    const cp = Math.cos(pitch);
    this.camera.position.set(
      this.target.x + Math.sin(yaw) * cp * distance,
      this.target.y + Math.sin(pitch) * distance,
      this.target.z + Math.cos(yaw) * cp * distance
    );
    if (this.camera.position.y < 0.5) this.camera.position.y = 0.5;
    this.camera.lookAt(this.target);
  }

  /** 화면 좌표(-1~1)가 가리키는 바닥 위치. 못 찾으면 null */
  screenToGround(ndcX, ndcY, groundY = 0) {
    this._ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this._ndc, this.camera);
    this.plane.constant = -groundY;
    return this.raycaster.ray.intersectPlane(this.plane, this._hit);
  }
}
