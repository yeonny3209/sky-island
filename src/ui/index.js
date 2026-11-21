// B의 화면 전체. 엔진의 공개 API(game.*)와 이벤트(game.events)만 쓴다 (src/engine/README.md).
// main.js: const game = await startGame(el, { devUI: false }); mountUI(game);
import './ui.css';
import { h } from './dom.js';
import { createScreens } from './screens.js';
import { createQuestBook } from './quests.js';
import { createPlayerFrame } from './hud/playerFrame.js';
import { createExpBar } from './hud/expBar.js';
import { createSkillBar, POTION_KEY_CODE } from './hud/skillBar.js';
import { createTargetFrame } from './hud/targetFrame.js';
import { createQuestTracker } from './hud/questTracker.js';
import { createChat } from './hud/chat.js';
import { createMenu } from './hud/menu.js';
import { createFeed } from './hud/feed.js';
import { createInventoryWindow } from './windows/inventory.js';
import { createDialog } from './windows/dialog.js';
import { createHelpWindow } from './windows/help.js';
import { josa } from './text.js';

export function mountUI(game) {
  const root = h('div', { class: 'si-root' });
  document.body.append(root);
  const coarse = window.matchMedia('(pointer: coarse)');
  const applyInput = () => {
    root.dataset.input = coarse.matches ? 'touch' : 'mouse';
  };
  applyInput();
  coarse.addEventListener('change', applyInput);

  const ctx = { game, book: createQuestBook(game), isTouch: () => root.dataset.input === 'touch' };
  ctx.setModal = (name, open) => root.classList.toggle(`si-root--${name}`, open);
  ctx.feed = createFeed(ctx);
  ctx.menu = createMenu(ctx);
  ctx.chat = createChat(ctx);
  const screens = createScreens(ctx);
  const player = createPlayerFrame();
  const exp = createExpBar();
  const skills = createSkillBar(ctx);
  const target = createTargetFrame(ctx);
  const tracker = createQuestTracker(ctx);
  const inventory = createInventoryWindow(ctx);
  const dialog = createDialog(ctx);
  const help = createHelpWindow();
  const hint = h('div', { class: 'si-hint si-panel', hidden: true });
  const death = h('div', { class: 'si-death', hidden: true });

  ctx.toggleInventory = () => {
    help.close();
    dialog.close();
    inventory.toggle();
  };
  ctx.toggleHelp = () => {
    inventory.close();
    help.toggle();
  };
  ctx.logout = async () => {
    inventory.close();
    help.close();
    dialog.close();
    await game.session.signOut();
    screens.showLogin();
  };

  const hud = h('div', { class: 'si-hud', hidden: true },
    h('div', { class: 'si-area si-area--tl' }, player.el),
    target.el,
    h('div', { class: 'si-area si-area--tr' }, ctx.menu.el, tracker.el),
    h('div', { class: 'si-area si-area--bl' }, ctx.chat.el),
    ctx.feed.loot, skills.el, ctx.feed.center, ctx.feed.alerts, hint, exp.el, dialog.el, death);
  root.append(hud, inventory.el, help.el, screens.el);

  // ---------- 퀘스트 알림: 상태가 바뀐 퀘스트를 찾아 배너를 띄운다
  let questSnap = new Map();
  function refreshQuests(announce = true) {
    const next = ctx.book.snapshot();
    if (announce) {
      for (const [id, sig] of next) {
        const prev = questSnap.get(id);
        if (!prev || prev === sig) continue;
        const [was] = prev.split('|');
        const [now] = sig.split('|');
        const quest = ctx.book.quest(id);
        if (now === 'ready' && was !== 'ready') ctx.feed.banner('퀘스트 목표 달성', `${quest.name} · ${ctx.book.npc(quest.turnIn).name}에게 보고하기`, 'quest');
        else if (now === 'active' && was === 'available') ctx.feed.banner('새 퀘스트', quest.name, 'quest');
        else if (now === 'done' && was !== 'done') ctx.feed.banner('퀘스트 완료', quest.name, 'quest');
        if (now === 'active' || now === 'ready') setTimeout(() => tracker.flash(id), 0);
      }
    }
    questSnap = next;
    tracker.render();
  }

  // ---------- 엔진 이벤트
  const on = (type, fn) => game.events.on(type, fn);
  on('world:entered', ({ name }) => {
    hud.hidden = false;
    player.setIdentity(name, game.character.classDef);
    ctx.chat.clear();
    ctx.chat.add({ system: true, text: '조작법은 H 키 (또는 오른쪽 위 "도움말")' });
    refreshQuests(false);
  });
  on('world:left', () => {
    hud.hidden = true;
    target.clear();
    inventory.close();
    dialog.close();
  });
  on('island:entered', ({ islandId }) => {
    const island = game.data.getIsland(islandId);
    if (!island) return;
    ctx.menu.setIsland(island);
    target.clear();
    const sub = Array.isArray(island.levelRange) ? `권장 레벨 ${island.levelRange[0]}~${island.levelRange[1]}` : island.description;
    ctx.feed.banner(island.name, sub, 'island');
  });
  on('player:hp', ({ hp, maxHp }) => player.setHp(hp, maxHp));
  on('player:exp', (info) => {
    exp.set(info);
    player.setLevel(info.level);
    if (info.gainedExp > 0) ctx.feed.exp(info.gainedExp);
  });
  on('player:levelUp', ({ level }) => {
    ctx.feed.banner(`레벨 업!  Lv.${level}`, '능력치가 올랐어요', 'level');
    refreshQuests();
  });
  on('player:gold', ({ gold, delta }) => {
    player.setGold(gold);
    if (delta > 0) ctx.feed.gold(delta);
  });
  on('loot', ({ itemId, count }) => ctx.feed.item(itemId, count));
  on('skills:changed', ({ slots }) => skills.render(slots));
  on('inventory:changed', () => {
    skills.refreshPotion();
    inventory.refresh();
    refreshQuests();
  });
  on('equipment:changed', () => inventory.refresh());
  on('player:stats', () => inventory.refresh());
  on('quest:changed', () => refreshQuests());
  on('monster:killed', ({ monsterId }) => ctx.book.record('kill', monsterId));
  on('monster:hp', (m) => target.onMonsterHp(m));
  on('boss:hp', (info) => target.onBossHp(info));
  on('chat:message', (m) => ctx.chat.add(m));
  on('net:status', (st) => ctx.menu.setNet(st));
  on('save:status', (st) => ctx.menu.setSave(st));
  on('camera:mode', ({ mode }) => ctx.feed.alert(mode === 'third' ? '3인칭 시점' : '쿼터뷰 시점'));
  on('island:unlocked', ({ name }) => ctx.feed.banner('새 섬이 열렸어요', name, 'level'));
  on('portal:locked', ({ name }) => ctx.feed.alert(`${josa(name, '은/는')} 아직 잠겨 있어요. 보스를 쓰러뜨리면 열려요.`, 'error'));
  on('session:duplicate', () => ctx.feed.alert('같은 캐릭터가 다른 창에서도 접속 중이에요.', 'error'));

  let deathTimer = 0;
  on('player:died', ({ respawnSec, sourceName }) => {
    let left = respawnSec;
    const draw = () => {
      death.textContent = `${sourceName ? `${sourceName}에게 ` : ''}쓰러졌어요… ${Math.ceil(left)}초 뒤 마을에서 다시 일어나요`;
    };
    death.hidden = false;
    draw();
    clearInterval(deathTimer);
    deathTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) clearInterval(deathTimer);
      else draw();
    }, 1000);
  });
  on('player:respawned', () => {
    death.hidden = true;
    clearInterval(deathTimer);
  });

  on('interact:changed', ({ npc }) => {
    hint.hidden = !npc || ctx.isTouch();
    if (npc) hint.textContent = `F  ${josa(npc.name, '과/와')} 대화`;
    else if (dialog.isOpen()) dialog.close();
  });
  on('npc:interact', ({ npcId }) => {
    inventory.close();
    help.close();
    dialog.open(npcId);
  });

  // ---------- 키 (엔진이 쓰지 않는 키만)
  window.addEventListener('keydown', (e) => {
    if (hud.hidden || screens.isOpen() || e.isComposing) return;
    const typing = game.input.isTyping();
    if (e.key === 'Enter' && !typing) {
      e.preventDefault();
      ctx.chat.focus();
      return;
    }
    if (typing) return;
    if (e.key === 'Escape') {
      if (inventory.isOpen()) inventory.escape();
      else if (help.isOpen()) help.close();
      else if (dialog.isOpen()) dialog.close();
    } else if (e.code === 'KeyI') ctx.toggleInventory();
    else if (e.code === 'KeyH') ctx.toggleHelp();
    else if (e.code === POTION_KEY_CODE && !e.repeat) skills.usePotion();
  });

  // ---------- 매 프레임: 스킬 재사용 대기
  const loop = () => {
    if (!hud.hidden) skills.tick();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  screens.start();
  return { root, book: ctx.book };
}
