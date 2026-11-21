// 캐릭터의 "저장되는" 상태와 규칙: 레벨·경험치·골드·인벤토리·장비·해금한 섬·퀘스트 진행.
// three.js를 쓰지 않는 순수 로직이라 Node에서도 테스트할 수 있다.
// 화면 위치·HP 같은 실시간 상태는 entities/localPlayer.js가 가진다.

import { EQUIP_SLOTS, STAT_KEYS } from '../core/dataBuilder.js';
import { clamp } from '../core/mathUtils.js';

export const SAVE_VERSION = 1;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function computeStats(classDef, level, equipment, data) {
  const s = {};
  for (const k of STAT_KEYS) {
    s[k] = (classDef.baseStats[k] ?? 0) + (classDef.statsPerLevel[k] ?? 0) * (level - 1);
  }
  for (const itemId of Object.values(equipment)) {
    const item = data.items.get(itemId);
    if (!item) continue;
    for (const [k, v] of Object.entries(item.stats)) s[k] = (s[k] ?? 0) + v;
  }
  s.maxHp = Math.max(1, Math.round(s.maxHp));
  s.attack = Math.max(0, s.attack);
  s.defense = Math.max(0, s.defense);
  s.moveSpeed = clamp(s.moveSpeed, 1, 15);
  s.critRate = clamp(s.critRate, 0, 1);
  s.critDamage = Math.max(1, s.critDamage);
  return s;
}

export class Character {
  /**
   * @param {object} save  저장 형식 (toSave()가 만드는 모양)
   * @param {object} data  loadGameData() 결과
   * @param {import('../core/events.js').EventBus} [events]
   */
  constructor(save, data, events = null) {
    this.data = data;
    this.events = events;
    this.id = save.id;
    this.name = save.name;
    this.classId = data.classes.has(save.classId) ? save.classId : data.defaultClassId;
    this.level = clamp(Math.round(save.level || 1), 1, data.levels.maxLevel);
    this.exp = Math.max(0, Math.round(save.exp || 0));
    this.gold = Math.max(0, Math.round(save.gold || 0));
    this.createdAt = save.createdAt ?? null;

    const d = isObj(save.data) ? save.data : {};
    this.islandId = typeof d.islandId === 'string' ? d.islandId : null;
    this.pos = isObj(d.pos) && Number.isFinite(d.pos.x) && Number.isFinite(d.pos.z) ? { x: d.pos.x, z: d.pos.z } : null;
    this.inventory = [];
    for (const it of Array.isArray(d.inventory) ? d.inventory : []) {
      if (isObj(it) && data.items.has(it.itemId) && it.count > 0) this._addStack(it.itemId, Math.round(it.count));
    }
    this.equipment = {};
    if (isObj(d.equipment)) {
      for (const [slot, itemId] of Object.entries(d.equipment)) {
        const item = data.items.get(itemId);
        if (item && item.slot === slot) this.equipment[slot] = itemId;
      }
    }
    this.unlockedIslands = new Set((Array.isArray(d.unlockedIslands) ? d.unlockedIslands : []).filter((id) => data.islands.has(id)));
    this.quests = isObj(d.quests) ? d.quests : {};
    this.flags = isObj(d.flags) ? d.flags : {};
    this.appearance = { color: isObj(d.appearance) && d.appearance.color ? d.appearance.color : this.classDef.color };
    this.playTimeSec = Math.max(0, Number(d.playTimeSec) || 0);
    this._stats = null;
  }

  /** 새 캐릭터 저장 형식을 만든다 (직업의 시작 아이템·장비 포함) */
  static newSave({ id, name, classId }, data) {
    const classDef = data.getClass(classId);
    const inventory = classDef.startingItems.map((it) => ({ ...it }));
    return {
      id,
      name,
      classId: classDef.id,
      level: 1,
      exp: 0,
      gold: 0,
      data: {
        version: SAVE_VERSION,
        islandId: data.hubId,
        pos: null,
        inventory,
        equipment: { ...classDef.startingEquipment },
        unlockedIslands: [],
        quests: {},
        flags: {},
        appearance: { color: classDef.color },
        playTimeSec: 0,
      },
    };
  }

  get classDef() {
    return this.data.getClass(this.classId);
  }

  get expToNext() {
    return this.data.levels.expToNext(this.level);
  }

  get isMaxLevel() {
    return this.level >= this.data.levels.maxLevel;
  }

  /** 레벨·장비가 반영된 능력치 */
  get stats() {
    if (!this._stats) this._stats = computeStats(this.classDef, this.level, this.equipment, this.data);
    return this._stats;
  }

  _emit(type, payload) {
    if (this.events) this.events.emit(type, payload);
  }

  _changed(kind, important) {
    this._emit('character:changed', { kind, important });
  }

  _statsChanged() {
    this._stats = null;
    this._emit('player:stats', { ...this.stats });
  }

  expInfo() {
    return { level: this.level, exp: this.exp, expToNext: this.expToNext, isMaxLevel: this.isMaxLevel };
  }

  /** @returns {number} 오른 레벨 수 */
  addExp(amount) {
    amount = Math.round(amount);
    if (!(amount > 0) || this.isMaxLevel) return 0;
    this.exp += amount;
    let gained = 0;
    while (!this.isMaxLevel && this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level += 1;
      gained += 1;
    }
    if (this.isMaxLevel) this.exp = 0;
    this._emit('player:exp', { ...this.expInfo(), gainedExp: amount });
    if (gained) {
      this._statsChanged();
      this._emit('player:levelUp', { level: this.level, gained });
    }
    this._changed('exp', gained > 0);
    return gained;
  }

  addGold(amount) {
    amount = Math.round(amount);
    if (!amount) return;
    this.gold = Math.max(0, this.gold + amount);
    this._emit('player:gold', { gold: this.gold, delta: amount });
    this._changed('gold', false);
  }

  countItem(itemId) {
    const stack = this.inventory.find((s) => s.itemId === itemId);
    return stack ? stack.count : 0;
  }

  _addStack(itemId, count) {
    const stack = this.inventory.find((s) => s.itemId === itemId);
    if (stack) stack.count += count;
    else this.inventory.push({ itemId, count });
  }

  addItem(itemId, count = 1) {
    if (!this.data.items.has(itemId) || !(count > 0)) return false;
    this._addStack(itemId, Math.round(count));
    this._emit('inventory:changed', { inventory: this.inventory.map((s) => ({ ...s })) });
    this._changed('inventory', true);
    return true;
  }

  removeItem(itemId, count = 1) {
    const idx = this.inventory.findIndex((s) => s.itemId === itemId);
    if (idx < 0 || this.inventory[idx].count < count) return false;
    this.inventory[idx].count -= count;
    if (this.inventory[idx].count <= 0) this.inventory.splice(idx, 1);
    this._emit('inventory:changed', { inventory: this.inventory.map((s) => ({ ...s })) });
    this._changed('inventory', true);
    return true;
  }

  canEquip(itemId) {
    const item = this.data.items.get(itemId);
    if (!item) return { ok: false, reason: '없는 아이템입니다' };
    if (!item.slot) return { ok: false, reason: '장착할 수 없는 아이템입니다' };
    if (this.level < item.levelReq) return { ok: false, reason: `레벨 ${item.levelReq}부터 낄 수 있습니다` };
    if (this.countItem(itemId) < 1) return { ok: false, reason: '가방에 없습니다' };
    return { ok: true, slot: item.slot };
  }

  equip(itemId) {
    const check = this.canEquip(itemId);
    if (!check.ok) return check;
    const slot = check.slot;
    this.removeItem(itemId, 1);
    const prev = this.equipment[slot];
    if (prev) this._addStack(prev, 1);
    this.equipment[slot] = itemId;
    this._emit('equipment:changed', { equipment: { ...this.equipment }, slot });
    this._emit('inventory:changed', { inventory: this.inventory.map((s) => ({ ...s })) });
    this._statsChanged();
    this._changed('equipment', true);
    return { ok: true, slot, previous: prev ?? null };
  }

  unequip(slot) {
    const itemId = this.equipment[slot];
    if (!itemId) return { ok: false, reason: '비어 있는 칸입니다' };
    delete this.equipment[slot];
    this._addStack(itemId, 1);
    this._emit('equipment:changed', { equipment: { ...this.equipment }, slot });
    this._emit('inventory:changed', { inventory: this.inventory.map((s) => ({ ...s })) });
    this._statsChanged();
    this._changed('equipment', true);
    return { ok: true, itemId };
  }

  /** 소비 아이템 사용. 효과(예: { heal: 30 })를 돌려주고, 실제 적용은 플레이어가 한다. */
  useItem(itemId) {
    const item = this.data.items.get(itemId);
    if (!item || !item.effect) return { ok: false, reason: '사용할 수 없는 아이템입니다' };
    if (!this.removeItem(itemId, 1)) return { ok: false, reason: '가방에 없습니다' };
    return { ok: true, effect: { ...item.effect } };
  }

  isIslandUnlocked(islandId) {
    return !this.data.lockedIslands.has(islandId) || this.unlockedIslands.has(islandId);
  }

  /** @returns {boolean} 새로 열었으면 true */
  unlockIsland(islandId) {
    if (!this.data.islands.has(islandId) || this.unlockedIslands.has(islandId)) return false;
    this.unlockedIslands.add(islandId);
    this._emit('island:unlocked', { islandId, name: this.data.getIsland(islandId).name });
    this._changed('unlock', true);
    return true;
  }

  setLocation(islandId, pos) {
    this.islandId = islandId;
    this.pos = pos ? { x: Math.round(pos.x * 100) / 100, z: Math.round(pos.z * 100) / 100 } : null;
  }

  // ---- 퀘스트·플래그: B의 퀘스트 시스템이 자유롭게 쓰는 저장 공간 (JSON으로 저장 가능한 값만)
  getQuest(questId) {
    return this.quests[questId] ?? null;
  }

  setQuest(questId, state) {
    if (state == null) delete this.quests[questId];
    else this.quests[questId] = state;
    this._emit('quest:changed', { questId, state });
    this._changed('quest', true);
  }

  getFlag(key) {
    return this.flags[key];
  }

  setFlag(key, value) {
    if (value === undefined) delete this.flags[key];
    else this.flags[key] = value;
    this._changed('flag', false);
  }

  toSave() {
    return {
      id: this.id,
      name: this.name,
      classId: this.classId,
      level: this.level,
      exp: this.exp,
      gold: this.gold,
      data: {
        version: SAVE_VERSION,
        islandId: this.islandId,
        pos: this.pos,
        inventory: this.inventory.map((s) => ({ ...s })),
        equipment: { ...this.equipment },
        unlockedIslands: [...this.unlockedIslands],
        quests: this.quests,
        flags: this.flags,
        appearance: { ...this.appearance },
        playTimeSec: Math.round(this.playTimeSec),
      },
    };
  }
}

export { EQUIP_SLOTS };
