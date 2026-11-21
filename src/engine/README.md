# 엔진 (src/engine/) — 담당 A

조작 · 카메라 · 전투 판정 · 멀티 동기화 · 저장을 맡는다.
화면(로그인·HUD·인벤토리·채팅창)은 B가 `src/ui/`에서 이 문서의 **API와 이벤트**만으로 만든다.
콘텐츠 수치는 전부 `data/*.json`에서 읽는다. 엔진 코드에는 몬스터·아이템·스킬·섬 내용이 없다.

## 바로 해 보기

```bash
npm install
npm run dev
```

- `.env`가 없으면 **오프라인 모드**: 이름만 넣고 들어가고, 이 브라우저(localStorage)에 저장된다.
- 오프라인에서도 **탭을 두 개** 열어 다른 이름으로 들어가면 멀티플레이를 시험할 수 있다 (같은 브라우저 탭끼리 BroadcastChannel로 통신).
- `.env`가 있어도 주소 뒤에 `?offline`을 붙이면 오프라인 모드로 켠다.
- 개발 서버에서는 브라우저 콘솔의 `window.skyIsland`가 게임 객체다.

## 조작

| 동작 | PC | 폰·태블릿 |
|---|---|---|
| 이동 | WASD / 방향키 | 왼쪽 아래를 끌기 (떠다니는 조이스틱) |
| 평타 | 마우스 왼쪽 / J (누르고 있으면 연속) | 공격 버튼 |
| 스킬 1~3 | Q E R / 1 2 3 | 스킬 버튼 |
| 점프 | Space (보스 충격파는 점프로 피함) | 점프 버튼 |
| 대화 | F | 대화 버튼 (NPC 근처에서만 보임) |
| 카메라 | V: 쿼터뷰 ↔ 3인칭, 오른쪽 드래그: 돌리기, 휠: 줌 | 시점 버튼, 빈 곳 드래그, 두 손가락 줌 |

- 키는 `e.code`(자판 위치)로 받으므로 한글 입력 상태여도 동작한다. 입력창에 글을 쓰는 중에는 게임 키를 무시한다.
- 조준: 쿼터뷰+마우스면 커서 쪽, 3인칭이면 카메라 정면, 그 외엔 이동 방향. 그 방향 45°(터치 75°) 안의 가까운 몬스터로 살짝 보정한다. 서서 공격하면 앞에 없을 때 뒤쪽 몬스터라도 바라보고 친다.
- 키 바꾸기: `game.input.setBinding('skill1', ['KeyQ'])` (이름은 `input/bindings.js`의 `DEFAULT_BINDINGS`).
- 카메라 모드는 localStorage `sky-island:settings`에 기억된다.

## UI(B)가 쓰는 법

`src/main.js`:

```js
import { startGame } from './engine/index.js';
startGame(document.getElementById('app'), { devUI: true });
```

- `devUI: true`면 엔진 확인용 **임시 화면**(`src/engine/dev/devUI.js`)이 뜬다. B의 UI가 준비되면 `devUI: false`로 바꾸고 `startGame()`이 돌려주는 `game`으로 화면을 만든다.
- 임시 화면 코드는 공개 API만 쓰므로 그대로 사용 예시로 봐도 된다.

```js
const game = await startGame(el, { devUI: false });
game.events.on('player:hp', ({ hp, maxHp }) => { /* HP바 */ });
```

### 흐름

1. `await game.session.signIn(email, pw)` (오프라인: `signInOffline(name)`) → `{ ok, error }`
2. `await game.session.loadCharacter()` → `{ ok, character }` (캐릭터가 없으면 `character: null`)
3. 없으면 `await game.session.createCharacter(name)` → `{ ok, error }`
4. `await game.enterWorld()` → 월드 입장. 이후는 이벤트로 화면을 갱신한다.
5. 로그아웃: `await game.session.signOut()` (저장 후 나간다, `world:left` 이벤트)

### API

| 위치 | 내용 |
|---|---|
| `game.session` | `mode`('online'/'offline'), `isOnline`, `configError`, `user`, `character`, `signUp(email, pw)`(이메일 확인이 켜져 있으면 `needsConfirm: true`), `signIn`, `signInOffline(name)`, `offlineProfiles()`, `lastOfflineProfile()`, `signOut()`, `loadCharacter()`, `createCharacter(name, classId?)` |
| `game` | `enterWorld()`, `leaveWorld()`, `travel(islandId)`, `useItem(itemId)` → `{ ok, reason }`, `getState()`(화면 첫 그리기용 묶음), `inWorld`, `data`(읽은 게임 데이터), `character`, `player` |
| `game.character` | `name`, `level`, `exp`, `expToNext`, `gold`, `stats`, `inventory`([{itemId, count}]), `equipment`({slot: itemId}), `equip(itemId)`, `unequip(slot)`, `addItem`, `removeItem`, `countItem`, `addGold`, `addExp`, `isIslandUnlocked`, `unlockIsland`, `getQuest`/`setQuest`, `getFlag`/`setFlag` (퀘스트·플래그는 B가 자유롭게 쓰는 저장 칸) |
| `game.combat` | `useSlot(i)`(0 = 평타, 1~3 = 스킬. 화면 버튼용), `getSlots()` → `[{ slot, skillId, name, description, cooldown, cooldownTotal, keys }]` |
| `game.net` | `sendChat(text)` → `{ ok, reason }`, `roomPlayers()`(같은 섬), `onlinePlayers()`(접속자 전체), `status()` |
| `game.cameraRig` | `mode`, `setMode('quarter' \| 'third')`, `toggleMode()` |
| `game.save` | `saveNow()` (보통은 자동 저장이라 부를 일이 없다) |
| `game.input` | `setBinding(action, codes)`, `isTyping()` |

`game.data`: `getItem(id)`, `getSkill(id)`, `getMonster(id)`, `getClass(id)`, `getIsland(id)`, `items`/`monsters`/`islands`(Map), `hubId`, `levels.maxLevel`.

### 이벤트 (`game.events.on(이름, fn)` → 끄는 함수를 돌려준다)

| 이벤트 | 내용 |
|---|---|
| `session:ready` / `auth:changed` | `{ mode, user }` / `{ user }` |
| `world:entered` / `world:left` | `{ name, islandId }` / `{}` |
| `island:leaving` / `island:entered` | `{ islandId }` / `{ islandId, name, type }` |
| `island:unlocked` | `{ islandId, name }` (보스를 잡아 새 섬이 열림) |
| `portal:locked` | `{ islandId, name }` (잠긴 포탈에 들어감) |
| `player:hp` | `{ hp, maxHp }` |
| `player:damaged` | `{ amount, sourceName, hp, maxHp }` |
| `player:died` / `player:respawned` | `{ respawnSec, sourceName }` / `{}` |
| `player:exp` | `{ level, exp, expToNext, isMaxLevel, gainedExp? }` |
| `player:levelUp` | `{ level, gained }` |
| `player:gold` | `{ gold, delta }` |
| `player:stats` | `{ maxHp, attack, defense, moveSpeed, critRate, critDamage }` |
| `inventory:changed` / `equipment:changed` | `{ inventory }` / `{ equipment, slot? }` |
| `loot` | `{ itemId, name, count }` (드롭 획득) |
| `skills:changed` | `{ slots }` (getSlots()와 같은 모양) |
| `skill:used` / `combat:hit` | `{ slot, skillId, name, cooldownSec }` / `{ skillId, targets }` |
| `monster:hp` / `monster:died` / `monster:killed` | 몬스터 체력·죽음 / 내가 보상을 받은 처치 `{ monsterId, islandId, isBoss }` (퀘스트 진행용) |
| `boss:hp` | `{ name, hp, maxHp, ... }` 또는 `null` (근처에서 싸우는 보스가 없음) |
| `camera:mode` | `{ mode }` |
| `interact:changed` | `{ npc: { id, name } \| null }` (가까운 NPC가 바뀜) |
| `npc:interact` | `{ npcId, name, islandId }` (F / 대화 버튼 → B가 대화·퀘스트를 연결) |
| `quest:changed` | `{ questId, state }` |
| `chat:message` | `{ nid, name, text, time, self }` 또는 `{ system: true, text }` |
| `players:changed` / `online:changed` | 같은 섬 사람 / 전체 접속자 목록 |
| `net:status` | `{ mode, connected, isHost, players, online, sendIntervalMs }` |
| `save:status` | `{ state: 'saving' \| 'saved' \| 'error', at?, error? }` |
| `session:duplicate` | 같은 캐릭터가 다른 창에서도 접속 중 |

엔진이 그리는 것: 3D 장면, 머리 위 이름표·HP, 데미지 숫자, 공격 예고 장판, 화면 전환 페이드, 터치 버튼(`.si-touch` 클래스로 모양 변경 가능).

## B가 데이터에 쓸 수 있는 필드

빠진 필드는 엔진 기본값으로 채운다. 잘못된 참조(없는 아이템 id 등)는 브라우저 콘솔의 **"[데이터] 확인할 것 N개"**에 나온다. 필드 이름은 영어 camelCase, 보이는 글은 한국어.

### data/classes.json (없으면 임시 전사를 쓴다)
```json
[{
  "id": "warrior", "name": "전사", "color": "#3b82f6",
  "baseStats": { "maxHp": 100, "attack": 10, "defense": 2, "moveSpeed": 5, "critRate": 0.1, "critDamage": 1.5 },
  "statsPerLevel": { "maxHp": 12, "attack": 2, "defense": 1 },
  "basicAttack": { "name": "평타", "cooldownSec": 0.45, "range": 2.2, "angleDeg": 110 },
  "skills": ["slash", "whirlwind", "dash-strike"],
  "startingItems": [{ "itemId": "small-potion", "count": 3 }],
  "startingEquipment": { "weapon": "wooden-sword" }
}]
```
`skills`를 빼면 skills.json에서 `class`가 같은 스킬을 순서대로 최대 3개 쓴다.

### data/levels.json (선택)
`{ "maxLevel": 30, "formula": { "base": 20, "exponent": 1.5 } }` → 다음 레벨까지 경험치 = base × 레벨^exponent. 또는 `"expTable": [20, 57, 104, ...]`.

### skills.json
| 필드 | 기본값 | 설명 |
|---|---|---|
| `class`, `name`, `description` | | |
| `cooldownSec` | 1 | 재사용 대기 |
| `damageMultiplier` | 1 | 공격력 배수 |
| `shape` | `arc` | `arc`(부채꼴) · `circle`(내 주변 원) · `line`(앞으로 직사각형) |
| `range` | 2.2 | 반지름/길이 |
| `angleDeg` | 100 | arc의 각도 |
| `width` | 1.2 | line의 폭 |
| `castSec` / `recoverSec` | 0.18 / 0.22 | 맞기 전 준비 / 맞은 뒤 경직 |
| `hits` / `hitIntervalSec` | 1 / 0.15 | 여러 번 때리기 |
| `dashDistance` | 0 | 시전하며 앞으로 돌진 (line이면 지나간 길 전체 판정) |
| `knockback` | 0.4 | 밀어내기 |
| `anim` | 모양에 따라 | `slash` · `spin` · `thrust` · `slam` |
| `color` | `#ffffff` | 이펙트 색 |

### monsters.json
| 필드 | 기본값 (보스) | 설명 |
|---|---|---|
| `maxHp`, `attack`, `defense`, `exp` | 20, 3, 0, 1 | |
| `moveSpeed` | 2.2 (2.6) | |
| `aggroRange` / `leashRange` | 7 / 15 (12 / 26) | 알아채는 거리 / 집에서 이만큼 멀어지면 돌아감 |
| `attackRange` | 0.9 | 몸 가장자리에서 닿는 거리 |
| `attackWindupSec` / `attackCooldownSec` | 0.6 / 1.8 | 빨간 예고 장판 시간 / 공격 간격 |
| `respawnSec` | 10 (60) | |
| `model` | `slime` (`golem`) | `slime` · `beast` · `mushroom` · `golem` · `bat` |
| `color`, `size` | `#7dd3fc`, 1 (2.4) | |
| `drops` | | `[{ "itemId", "chance": 0~1, "min", "max" }]` (처치에 참여한 사람마다 따로 굴림) |
| `gold` | 없음 | 숫자 또는 `[최소, 최대]` |
| `isBoss` | 섬의 `boss`면 자동 | |
| `patterns` | 일반: 근접 1개 / 보스: 근접+충격파+돌진 | `[{ "type": "melee" \| "slam" \| "charge", "damageMultiplier", "windupSec", "cooldownSec", "recoverSec", "weight", "reach", "angleDeg", "radius", "length", "width" }]` |

### items.json
`type`(`material` · `consumable` · `weapon` · `armor` · `helmet` · `boots` · `accessory`), `slot`(빼면 type이 장비 칸 이름일 때 그 칸), `stats`(`{ "attack": 2 }`처럼 능력치 키), `levelReq`, `effect`(`{ "heal": 30 }`), `description`.

### islands/*.json
| 필드 | 설명 |
|---|---|
| `type` | `hub` · `hunting` · `boss` (반지름 기본 16 / 24 / 20, `radius`로 바꿈) |
| `connectsTo` | 포탈로 이어지는 섬 id들. 사냥 섬은 허브로 돌아가는 포탈이 자동으로 생긴다 (`returnTo`로 바꿈) |
| `monsters`, `monsterCountEach` | 자동 배치할 몬스터 id들과 종류별 마릿수(기본 5) |
| `spawns` | 직접 배치: `[{ "monsterId", "x", "z", "count", "radius" }]` |
| `boss`, `bossSpawn` | 보스 몬스터 id, 위치 `{x, z}` |
| `unlocksIsland` | 이 섬 보스를 잡으면 열리는 섬. 이렇게 가리켜진 섬은 그 전까지 잠겨 있다 |
| `npcs` | `[{ "id", "name", "x", "z", "color" }]` → F로 대화하면 `npc:interact` |
| `portals`, `props` | 직접 배치(선택). 없으면 섬 id를 시드로 자동 배치 (모든 브라우저에서 같은 배치). props `type`: tree, pine, rock, bush, flower, house, lamp, well, crystal, stump, sign |
| `theme` | `{ ground, dirt, rock, skyTop, skyHorizon, fog }` 색 |

## Supabase 설정 (온라인 모드)

1. supabase.com에서 프로젝트를 만든다.
2. SQL Editor에서 `supabase/migrations/20261118000000_characters.sql`을 실행한다 (characters 테이블 + RLS).
3. Authentication → Sign In / Providers → Email에서 **Confirm email을 끄면** 가입 즉시 로그인된다 (켜 두면 메일 링크를 눌러야 함).
4. `.env.example`을 `.env`로 복사하고 Project Settings → API의 **URL**과 **anon(또는 publishable) 키**만 넣는다. service_role / secret 키는 넣지 않는다 (엔진이 감지하면 거부한다).
5. `npm run dev`를 다시 켠다. 로그인 화면에 "온라인"이 보이면 성공.

Realtime은 Broadcast·Presence만 쓰므로 테이블 설정이 필요 없다 (공개 채널).

## 멀티플레이 구조

- 채널: 섬마다 `island:<섬id>`(위치·전투), 전체 `global`(채팅·접속자). Supabase 채널 이름은 `sky:` 접두어.
- **호스트**: 그 섬에 가장 먼저 들어온 사람(탭을 숨기면 다음 사람에게 넘어감)이 몬스터 AI를 돌리고 상태를 보낸다. 나가면 다음 사람이 이어받는다.
- 내 공격의 명중은 내 브라우저에서 판정하고, 피해를 호스트에게 보낸다 (화면에는 바로 보임). 몬스터 공격은 각자 자기 캐릭터만 판정한다.
- 처치 직전 30초 안에 때린 사람은 모두 경험치를 다 받고, 드롭은 각자 따로 굴린다.
- 무료 플랜 메시지 한도를 넘지 않게: 혼자면 보내지 않고, 한 번에 묶어 보내고, 사람이 많을수록 간격을 늘린다 (100ms~1초).
- 판정이 브라우저에 있으므로 마음먹으면 조작할 수 있다. 2인용이라 받아들인 설계다.

## 파일

| 폴더 | 내용 |
|---|---|
| `config.js` | 조정용 숫자(카메라 거리, 중력, 조준 보정, 네트워크 간격, 자동 저장 주기 등) |
| `core/` | 게임 루프(`game.js`), 이벤트, 데이터 읽기·정리 |
| `input/` | 키보드·마우스·터치 입력, 터치 버튼 |
| `camera/` | 쿼터뷰/3인칭 카메라 |
| `entities/` | 내 캐릭터, 다른 플레이어, 몬스터, 3D 모델 |
| `combat/` | 피해 공식, 판정 도형, 스킬 시전, 몬스터 AI, 보상 |
| `world/` | 섬 배치·모델, 하늘, 소품 |
| `fx/` | 이펙트, 이름표, 데미지 숫자 |
| `net/` | 동기화(`netSync.js`), Supabase/탭 간 통신, 호스트 선출 |
| `save/` | 로그인, 캐릭터, 자동 저장 |
| `dev/` | 임시 화면 (B의 UI가 생기면 꺼짐) |
