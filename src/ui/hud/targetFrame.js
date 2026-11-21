// 위쪽 가운데: 방금 때린 몬스터의 체력 ('monster:hp'), 근처 보스와 싸우면 큰 보스 바 ('boss:hp').
import { h } from '../dom.js';
import { formatNumber } from '../format.js';

const TARGET_SHOW_MS = 6000;

function bar(extraClass) {
  const ghost = h('div', { class: 'si-bar__ghost' });
  const fill = h('div', { class: 'si-bar__fill' });
  const text = h('div', { class: 'si-bar__text' });
  return { el: h('div', { class: `si-bar ${extraClass}` }, ghost, fill, text), ghost, fill, text };
}

function fillBar(b, hp, maxHp) {
  const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
  b.fill.style.width = `${pct}%`;
  b.ghost.style.width = `${pct}%`;
  b.text.textContent = `${formatNumber(Math.max(0, hp))} / ${formatNumber(maxHp)}`;
}

export function createTargetFrame(ctx) {
  const { game } = ctx;
  const tLevel = h('span', { class: 'si-target__level' });
  const tName = h('span', { class: 'si-target__name' });
  const tBar = bar('si-bar--enemy');
  const target = h('div', { class: 'si-target si-panel', hidden: true }, h('div', { class: 'si-target__title' }, tLevel, tName), tBar.el);

  const bTitle = h('div', { class: 'si-bossbar__title' });
  const bName = h('div', { class: 'si-bossbar__name' });
  const bBar = bar('si-bar--boss');
  const boss = h('div', { class: 'si-bossbar', hidden: true }, h('div', { class: 'si-bossbar__head' }, bTitle, bName), bBar.el);

  const el = h('div', { class: 'si-top-center' }, boss, target);
  let hideTimer = 0;
  let bossShown = false;

  /** 'monster:hp' { monsterId, name, hp, maxHp, isBoss } */
  function onMonsterHp(m) {
    if (m.isBoss || bossShown) return;
    const def = game.data.getMonster(m.monsterId);
    tName.textContent = m.name;
    tLevel.textContent = def?.level ? `Lv.${def.level}` : '';
    const gap = (def?.level ?? 0) - (game.character?.level ?? 0);
    target.dataset.danger = gap >= 3 ? 'high' : gap <= -3 ? 'low' : 'normal';
    fillBar(tBar, m.hp, m.maxHp);
    target.hidden = false;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (target.hidden = true), m.hp <= 0 ? 900 : TARGET_SHOW_MS);
  }

  /** 'boss:hp' { monsterId, name, hp, maxHp } 또는 null */
  function onBossHp(info) {
    bossShown = Boolean(info);
    boss.hidden = !info;
    if (!info) return;
    target.hidden = true;
    const def = game.data.getMonster(info.monsterId);
    bTitle.textContent = def?.title ?? '보스';
    bName.textContent = def?.level ? `Lv.${def.level} ${info.name}` : info.name;
    fillBar(bBar, info.hp, info.maxHp);
  }

  function clear() {
    target.hidden = true;
    boss.hidden = true;
    bossShown = false;
  }

  return { el, onMonsterHp, onBossHp, clear };
}
