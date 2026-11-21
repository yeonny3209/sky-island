// data/*.json → 엔진이 쓰는 형태로 정리한다.
// - 빠진 필드는 엔진 기본값으로 채운다 (B가 필드를 하나씩 늘려 가도 게임이 깨지지 않게).
// - 잘못된 참조(없는 몬스터 id 등)는 warnings에 모아 콘솔에 보여 준다.
// Vite 전용 기능을 쓰지 않는 순수 함수라 Node에서도 테스트할 수 있다.

import { clamp } from './mathUtils.js';

export const EQUIP_SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'accessory'];
export const STAT_KEYS = ['maxHp', 'attack', 'defense', 'moveSpeed', 'critRate', 'critDamage'];
export const SKILL_SHAPES = ['arc', 'circle', 'line'];
export const MONSTER_MODELS = ['slime', 'beast', 'mushroom', 'golem', 'bat'];
export const PATTERN_TYPES = ['melee', 'slam', 'charge'];

// data/classes.json이 없을 때만 쓰는 임시 직업. 실제 직업 수치는 B가 data/classes.json에 둔다.
export const FALLBACK_CLASS = {
  id: 'warrior',
  name: '전사',
  baseStats: { maxHp: 100, attack: 10, defense: 2, moveSpeed: 5, critRate: 0.1, critDamage: 1.5 },
  statsPerLevel: { maxHp: 12, attack: 2, defense: 1 },
  basicAttack: {
    id: 'basic-attack',
    name: '평타',
    cooldownSec: 0.45,
    damageMultiplier: 1,
    range: 2.2,
    shape: 'arc',
    angleDeg: 110,
    castSec: 0.12,
    recoverSec: 0.18,
  },
  skills: null, // null이면 skills.json에서 class가 같은 스킬을 순서대로 쓴다
  color: '#3b82f6',
  startingItems: [],
  startingEquipment: {},
};

const SKILL_DEFAULTS = {
  name: '스킬',
  cooldownSec: 1,
  damageMultiplier: 1,
  range: 2.2,
  shape: 'arc',
  angleDeg: 100,
  width: 1.2,
  castSec: 0.18,
  recoverSec: 0.22,
  hits: 1,
  hitIntervalSec: 0.15,
  dashDistance: 0,
  knockback: 0.4,
  anim: null,
  color: '#ffffff',
  description: '',
};

const MONSTER_DEFAULTS = {
  name: '이름 없는 몬스터',
  maxHp: 20,
  attack: 3,
  defense: 0,
  exp: 1,
  moveSpeed: 2.2,
  aggroRange: 7,
  attackRange: 0.9, // 몸 가장자리에서 더 닿는 거리
  attackCooldownSec: 1.8,
  attackWindupSec: 0.6, // 공격 예고(빨간 장판) 시간
  leashRange: 15,
  respawnSec: 10,
  model: 'slime',
  color: '#7dd3fc',
  size: 1,
};

const BOSS_DEFAULTS = {
  size: 2.4,
  aggroRange: 12,
  leashRange: 26,
  respawnSec: 60,
  moveSpeed: 2.6,
  model: 'golem',
  color: '#a78bfa',
};

export const THEME_DEFAULTS = {
  ground: '#6cc24a',
  dirt: '#8b5e3c',
  rock: '#6b7280',
  skyTop: '#3d8fd6',
  skyHorizon: '#bfe3ff',
  fog: '#cfe8ff',
};

const ISLAND_RADIUS_BY_TYPE = { hub: 16, hunting: 24, boss: 20 };

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v : fallback);

function pickNumbers(obj) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const [k, v] of Object.entries(obj)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

/** 스킬(평타 포함) 하나를 정리 */
export function normalizeSkill(raw, warn, fallbackId = 'skill') {
  const r = isObj(raw) ? raw : {};
  const id = str(r.id, fallbackId);
  let shape = r.shape ?? SKILL_DEFAULTS.shape;
  if (!SKILL_SHAPES.includes(shape)) {
    warn(`스킬 "${id}": shape "${shape}"은 모르는 값이라 "arc"로 처리합니다 (가능: ${SKILL_SHAPES.join(', ')})`);
    shape = 'arc';
  }
  const s = {
    ...SKILL_DEFAULTS,
    ...r,
    id,
    name: str(r.name, SKILL_DEFAULTS.name),
    shape,
    cooldownSec: Math.max(0, num(r.cooldownSec, SKILL_DEFAULTS.cooldownSec)),
    damageMultiplier: Math.max(0, num(r.damageMultiplier, SKILL_DEFAULTS.damageMultiplier)),
    range: Math.max(0.3, num(r.range, SKILL_DEFAULTS.range)),
    angleDeg: clamp(num(r.angleDeg, SKILL_DEFAULTS.angleDeg), 1, 360),
    width: Math.max(0.2, num(r.width, SKILL_DEFAULTS.width)),
    castSec: Math.max(0, num(r.castSec, SKILL_DEFAULTS.castSec)),
    recoverSec: Math.max(0, num(r.recoverSec, SKILL_DEFAULTS.recoverSec)),
    hits: Math.max(1, Math.round(num(r.hits, SKILL_DEFAULTS.hits))),
    hitIntervalSec: Math.max(0.05, num(r.hitIntervalSec, SKILL_DEFAULTS.hitIntervalSec)),
    dashDistance: Math.max(0, num(r.dashDistance, SKILL_DEFAULTS.dashDistance)),
    knockback: Math.max(0, num(r.knockback, SKILL_DEFAULTS.knockback)),
    color: str(r.color, SKILL_DEFAULTS.color),
  };
  s.anim = str(r.anim, { arc: 'slash', circle: 'spin', line: 'thrust' }[shape]);
  s.totalSec = s.castSec + (s.hits - 1) * s.hitIntervalSec + s.recoverSec;
  return s;
}

function normalizePattern(raw, m, warn) {
  const r = isObj(raw) ? raw : {};
  let type = r.type ?? 'melee';
  if (!PATTERN_TYPES.includes(type)) {
    warn(`몬스터 "${m.id}": 공격 패턴 "${type}"은 모르는 값이라 "melee"로 처리합니다 (가능: ${PATTERN_TYPES.join(', ')})`);
    type = 'melee';
  }
  const p = {
    type,
    damageMultiplier: Math.max(0, num(r.damageMultiplier, 1)),
    windupSec: Math.max(0.1, num(r.windupSec, m.attackWindupSec)),
    cooldownSec: Math.max(0.2, num(r.cooldownSec, m.attackCooldownSec)),
    recoverSec: Math.max(0, num(r.recoverSec, 0.4)),
    weight: Math.max(0, num(r.weight, 1)),
  };
  if (type === 'melee') {
    p.reach = Math.max(0.2, num(r.reach, m.attackRange));
    p.angleDeg = clamp(num(r.angleDeg, 100), 10, 360);
  } else if (type === 'slam') {
    p.radius = Math.max(0.5, num(r.radius, m.radius + 2.5));
  } else if (type === 'charge') {
    p.length = Math.max(1, num(r.length, 8));
    p.width = Math.max(0.5, num(r.width, Math.max(1.2, m.radius * 2)));
  }
  return p;
}

function defaultPatterns(m) {
  const melee = {};
  if (!m.isBoss) return [melee];
  return [
    melee,
    { type: 'slam', damageMultiplier: 1.6, windupSec: 1.1, cooldownSec: 6, recoverSec: 0.8, weight: 2 },
    { type: 'charge', damageMultiplier: 1.3, windupSec: 0.9, cooldownSec: 8, recoverSec: 0.6, weight: 2 },
  ];
}

export function normalizeMonster(raw, isBossByIsland, warn) {
  const r = isObj(raw) ? raw : {};
  const id = str(r.id, 'monster');
  const isBoss = typeof r.isBoss === 'boolean' ? r.isBoss : isBossByIsland;
  const base = isBoss ? { ...MONSTER_DEFAULTS, ...BOSS_DEFAULTS } : MONSTER_DEFAULTS;
  const m = {
    ...base,
    ...r,
    id,
    isBoss,
    name: str(r.name, base.name),
    maxHp: Math.max(1, Math.round(num(r.maxHp, base.maxHp))),
    attack: Math.max(0, num(r.attack, base.attack)),
    defense: Math.max(0, num(r.defense, base.defense)),
    exp: Math.max(0, Math.round(num(r.exp, base.exp))),
    moveSpeed: Math.max(0, num(r.moveSpeed, base.moveSpeed)),
    aggroRange: Math.max(0, num(r.aggroRange, base.aggroRange)),
    attackRange: Math.max(0.1, num(r.attackRange, base.attackRange)),
    attackCooldownSec: Math.max(0.2, num(r.attackCooldownSec, base.attackCooldownSec)),
    attackWindupSec: Math.max(0.1, num(r.attackWindupSec, base.attackWindupSec)),
    leashRange: Math.max(2, num(r.leashRange, base.leashRange)),
    respawnSec: Math.max(1, num(r.respawnSec, base.respawnSec)),
    size: clamp(num(r.size, base.size), 0.2, 10),
    color: str(r.color, base.color),
  };
  m.model = str(r.model, base.model);
  if (!MONSTER_MODELS.includes(m.model)) {
    warn(`몬스터 "${id}": model "${m.model}"은 엔진에 없는 모양이라 "slime"으로 그립니다 (가능: ${MONSTER_MODELS.join(', ')})`);
    m.model = 'slime';
  }
  m.radius = 0.5 * m.size;
  m.drops = asArray(r.drops)
    .filter(isObj)
    .map((d) => {
      const min = Math.max(1, Math.round(num(d.min, 1)));
      return {
        itemId: String(d.itemId ?? ''),
        chance: clamp(num(d.chance, 1), 0, 1),
        min,
        max: Math.max(min, Math.round(num(d.max, min))),
      };
    });
  if (Array.isArray(r.gold)) m.gold = { min: num(r.gold[0], 0), max: num(r.gold[1], num(r.gold[0], 0)) };
  else if (typeof r.gold === 'number') m.gold = { min: r.gold, max: r.gold };
  else m.gold = null;
  const patternsRaw = Array.isArray(r.patterns) && r.patterns.length ? r.patterns : defaultPatterns(m);
  m.patterns = patternsRaw.map((p) => normalizePattern(p, m, warn));
  return m;
}

export function normalizeItem(raw) {
  const r = isObj(raw) ? raw : {};
  const type = str(r.type, 'material');
  const slot = str(r.slot, EQUIP_SLOTS.includes(type) ? type : null);
  return {
    ...r,
    id: str(r.id, 'item'),
    name: str(r.name, '이름 없는 아이템'),
    type,
    slot: EQUIP_SLOTS.includes(slot) ? slot : null,
    stats: pickNumbers(r.stats),
    levelReq: Math.max(0, Math.round(num(r.levelReq, 0))),
    effect: isObj(r.effect) ? pickNumbers(r.effect) : null,
    description: typeof r.description === 'string' ? r.description : '',
  };
}

function normalizeClass(raw, skills, items, warn) {
  const r = isObj(raw) ? raw : {};
  const id = str(r.id, FALLBACK_CLASS.id);
  const c = {
    ...r,
    id,
    name: str(r.name, FALLBACK_CLASS.name),
    baseStats: { ...FALLBACK_CLASS.baseStats, ...pickNumbers(r.baseStats) },
    statsPerLevel: isObj(r.statsPerLevel) ? pickNumbers(r.statsPerLevel) : { ...FALLBACK_CLASS.statsPerLevel },
    basicAttack: normalizeSkill({ ...FALLBACK_CLASS.basicAttack, ...(isObj(r.basicAttack) ? r.basicAttack : {}) }, warn, 'basic-attack'),
    color: str(r.color, FALLBACK_CLASS.color),
  };
  let skillIds;
  if (Array.isArray(r.skills)) {
    skillIds = r.skills.filter((sid) => {
      if (skills.has(sid)) return true;
      warn(`직업 "${id}": skills에 있는 "${sid}" 스킬이 skills.json에 없습니다`);
      return false;
    });
  } else {
    skillIds = [...skills.values()].filter((s) => s.class === id).map((s) => s.id);
  }
  if (skillIds.length > 3) {
    warn(`직업 "${id}": 스킬 슬롯은 3칸이라 앞의 3개만 씁니다 (${skillIds.slice(3).join(', ')} 제외)`);
    skillIds = skillIds.slice(0, 3);
  }
  c.skills = skillIds;
  c.startingItems = asArray(r.startingItems)
    .filter(isObj)
    .filter((it) => {
      if (items.has(it.itemId)) return true;
      warn(`직업 "${id}": startingItems의 "${it.itemId}" 아이템이 items.json에 없습니다`);
      return false;
    })
    .map((it) => ({ itemId: it.itemId, count: Math.max(1, Math.round(num(it.count, 1))) }));
  c.startingEquipment = {};
  if (isObj(r.startingEquipment)) {
    for (const [slot, itemId] of Object.entries(r.startingEquipment)) {
      const item = items.get(itemId);
      if (!item) warn(`직업 "${id}": startingEquipment의 "${itemId}" 아이템이 items.json에 없습니다`);
      else if (item.slot !== slot) warn(`직업 "${id}": "${itemId}"는 ${slot} 칸에 낄 수 없습니다 (아이템 slot: ${item.slot})`);
      else c.startingEquipment[slot] = itemId;
    }
  }
  return c;
}

function normalizeIsland(raw, hubId, warn) {
  const r = isObj(raw) ? raw : {};
  const id = str(r.id, 'island');
  const type = str(r.type, 'hunting');
  const sp = isObj(r.spawnPoint) ? r.spawnPoint : {};
  const island = {
    ...r,
    id,
    name: str(r.name, id),
    type,
    radius: Math.max(6, num(r.radius, ISLAND_RADIUS_BY_TYPE[type] ?? 22)),
    spawnPoint: { x: num(sp.x, 0), y: Math.max(0, num(sp.y, 0)), z: num(sp.z, 0) },
    connectsTo: asArray(r.connectsTo).filter((v) => typeof v === 'string'),
    monsters: asArray(r.monsters).filter((v) => typeof v === 'string'),
    monsterCountEach: Math.max(0, Math.round(num(r.monsterCountEach, 5))),
    spawns: Array.isArray(r.spawns) ? r.spawns.filter(isObj) : null,
    boss: typeof r.boss === 'string' && r.boss ? r.boss : null,
    bossSpawn: isObj(r.bossSpawn) ? { x: num(r.bossSpawn.x, 0), z: num(r.bossSpawn.z, 0) } : null,
    unlocksIsland: typeof r.unlocksIsland === 'string' && r.unlocksIsland ? r.unlocksIsland : null,
    returnTo: type === 'hub' ? null : str(r.returnTo, hubId),
    portals: Array.isArray(r.portals) ? r.portals.filter(isObj) : null,
    props: Array.isArray(r.props) ? r.props.filter(isObj) : null,
    npcs: asArray(r.npcs)
      .filter(isObj)
      .map((n, i) => ({
        id: str(n.id, `${id}-npc-${i}`),
        name: str(n.name, '주민'),
        x: num(n.x, 0),
        z: num(n.z, 0),
        color: str(n.color, '#f59e0b'),
        yaw: num(n.yaw, 0),
      })),
    theme: { ...THEME_DEFAULTS, ...(isObj(r.theme) ? r.theme : {}) },
  };
  if (r.spawnPoint && Math.hypot(island.spawnPoint.x, island.spawnPoint.z) > island.radius - 1) {
    warn(`섬 "${id}": spawnPoint가 섬 밖에 있습니다 (반지름 ${island.radius})`);
  }
  return island;
}

/**
 * @param {Record<string, any>} files  '/data/monsters.json' 같은 경로 → JSON 내용
 */
export function buildGameData(files) {
  const warnings = [];
  const warn = (msg) => warnings.push(msg);
  const get = (path) => files[path];

  // ---- 섬 (먼저 읽어서 보스 몬스터 id와 허브를 안다)
  const islandRaws = [];
  for (const [path, content] of Object.entries(files)) {
    if (/^\/data\/islands\/.+\.json$/.test(path)) islandRaws.push(...asArray(content));
  }
  islandRaws.push(...asArray(get('/data/islands.json')));
  const validIslandRaws = islandRaws.filter((r) => isObj(r) && typeof r.id === 'string');
  if (!validIslandRaws.length) {
    warn('섬 데이터가 없어 임시 허브 섬을 만듭니다 (data/islands/*.json)');
    validIslandRaws.push({ id: 'hub', name: '허브 마을', type: 'hub' });
  }
  const hubRaw = validIslandRaws.find((r) => r.type === 'hub') ?? validIslandRaws.find((r) => r.id === 'hub') ?? validIslandRaws[0];
  const hubId = hubRaw.id;
  const bossIds = new Set(validIslandRaws.map((r) => r.boss).filter((b) => typeof b === 'string' && b));

  // ---- 아이템
  const items = new Map();
  for (const raw of asArray(get('/data/items.json'))) {
    if (!isObj(raw) || typeof raw.id !== 'string') {
      warn('items.json: id가 없는 아이템이 있습니다');
      continue;
    }
    if (items.has(raw.id)) warn(`items.json: id "${raw.id}"가 두 번 나옵니다`);
    items.set(raw.id, normalizeItem(raw));
  }

  // ---- 스킬
  const skills = new Map();
  for (const raw of asArray(get('/data/skills.json'))) {
    if (!isObj(raw) || typeof raw.id !== 'string') {
      warn('skills.json: id가 없는 스킬이 있습니다');
      continue;
    }
    if (skills.has(raw.id)) warn(`skills.json: id "${raw.id}"가 두 번 나옵니다`);
    skills.set(raw.id, normalizeSkill(raw, warn, raw.id));
  }

  // ---- 몬스터
  const monsters = new Map();
  for (const raw of asArray(get('/data/monsters.json'))) {
    if (!isObj(raw) || typeof raw.id !== 'string') {
      warn('monsters.json: id가 없는 몬스터가 있습니다');
      continue;
    }
    if (monsters.has(raw.id)) warn(`monsters.json: id "${raw.id}"가 두 번 나옵니다`);
    const m = normalizeMonster(raw, bossIds.has(raw.id), warn);
    for (const d of m.drops) {
      if (!items.has(d.itemId)) warn(`몬스터 "${m.id}": 드롭 아이템 "${d.itemId}"가 items.json에 없습니다`);
    }
    m.drops = m.drops.filter((d) => items.has(d.itemId));
    monsters.set(m.id, m);
  }

  // ---- 직업
  const classes = new Map();
  const classRaws = asArray(get('/data/classes.json')).filter(isObj);
  if (!classRaws.length) classRaws.push(FALLBACK_CLASS);
  for (const raw of classRaws) {
    const c = normalizeClass(raw, skills, items, warn);
    classes.set(c.id, c);
  }
  const defaultClassId = classes.keys().next().value;

  // ---- 레벨
  const lv = isObj(get('/data/levels.json')) ? get('/data/levels.json') : {};
  const maxLevel = Math.max(1, Math.round(num(lv.maxLevel, 30)));
  const expTable = Array.isArray(lv.expTable) ? lv.expTable : null;
  const formula = isObj(lv.formula) ? lv.formula : {};
  const expBase = num(formula.base, 20);
  const expExponent = num(formula.exponent, 1.5);
  const levels = {
    maxLevel,
    expToNext(level) {
      if (level >= maxLevel) return Infinity;
      const fromTable = expTable ? num(expTable[level - 1], NaN) : NaN;
      return Math.max(1, Math.round(Number.isFinite(fromTable) ? fromTable : expBase * Math.pow(level, expExponent)));
    },
  };

  // ---- 섬 정리 + 참조 검사
  const islands = new Map();
  for (const raw of validIslandRaws) {
    if (islands.has(raw.id)) warn(`섬 id "${raw.id}"가 두 번 나옵니다`);
    islands.set(raw.id, normalizeIsland(raw, hubId, warn));
  }
  const lockedIslands = new Set();
  for (const island of islands.values()) {
    island.monsters = island.monsters.filter((mid) => {
      if (monsters.has(mid)) return true;
      warn(`섬 "${island.id}": monsters의 "${mid}"가 monsters.json에 없습니다`);
      return false;
    });
    if (island.spawns) {
      island.spawns = island.spawns.filter((s) => {
        if (monsters.has(s.monsterId)) return true;
        warn(`섬 "${island.id}": spawns의 "${s.monsterId}"가 monsters.json에 없습니다`);
        return false;
      });
    }
    if (island.boss && !monsters.has(island.boss)) {
      warn(`섬 "${island.id}": boss "${island.boss}"가 monsters.json에 없습니다`);
      island.boss = null;
    }
    island.connectsTo = island.connectsTo.filter((to) => {
      if (islands.has(to) || validIslandRaws.some((r) => r.id === to)) return true;
      warn(`섬 "${island.id}": connectsTo의 "${to}" 섬이 없습니다`);
      return false;
    });
    if (island.unlocksIsland) {
      if (validIslandRaws.some((r) => r.id === island.unlocksIsland)) lockedIslands.add(island.unlocksIsland);
      else {
        warn(`섬 "${island.id}": unlocksIsland "${island.unlocksIsland}" 섬이 없습니다`);
        island.unlocksIsland = null;
      }
    }
    if (island.returnTo && !validIslandRaws.some((r) => r.id === island.returnTo)) island.returnTo = hubId;
  }
  lockedIslands.delete(hubId);

  return {
    items,
    skills,
    monsters,
    classes,
    islands,
    levels,
    hubId,
    defaultClassId,
    lockedIslands,
    warnings,
    raw: files,
    getItem: (id) => items.get(id) ?? null,
    getSkill: (id) => skills.get(id) ?? null,
    getMonster: (id) => monsters.get(id) ?? null,
    getClass: (id) => classes.get(id) ?? classes.get(defaultClassId),
    getIsland: (id) => islands.get(id) ?? null,
  };
}
