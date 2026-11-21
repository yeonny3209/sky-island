// 잠깐 떴다 사라지는 것들: 획득 알림, 가운데 배너(레벨업·섬 이름·퀘스트), 안내 문구, 피해 숫자
import { h } from '../dom.js';
import { entryIcon, glyph } from '../icons.js';
import { formatNumber } from '../format.js';

const LOOT_MS = 3800;
const MAX_LOOT = 6;
const MAX_DAMAGE = 40;

/** 애니메이션이 끝나면 지운다 (애니메이션이 꺼진 환경에서도 지워지도록 시간 제한을 함께 건다). */
function removeAfter(el, ms) {
  const timer = setTimeout(() => el.remove(), ms + 400);
  el.addEventListener('animationend', (e) => {
    if (e.target === el && e.animationName.startsWith('si-out')) {
      clearTimeout(timer);
      el.remove();
    }
  });
}

export function createFeed(ctx) {
  const loot = h('div', { class: 'si-loot', 'aria-live': 'polite' });
  const center = h('div', { class: 'si-center' });
  const alerts = h('div', { class: 'si-alerts', role: 'status' });
  const damage = h('div', { class: 'si-damage-layer' });
  const merged = new Map(); // 같은 아이템은 한 줄로 합친다

  function scheduleOut(info) {
    clearTimeout(info.timer);
    info.timer = setTimeout(() => {
      info.row.classList.add('si-loot__row--out');
      info.timer = setTimeout(() => {
        info.row.remove();
        if (merged.get(info.key) === info) merged.delete(info.key);
      }, 450);
    }, LOOT_MS);
  }

  function lootRow(key, icon, label, count, rarity) {
    const prev = merged.get(key);
    if (prev && prev.row.isConnected && !prev.row.classList.contains('si-loot__row--out')) {
      prev.count += count;
      prev.countEl.textContent = `×${formatNumber(prev.count)}`;
      prev.row.classList.remove('si-loot__row--bump');
      void prev.row.offsetWidth;
      prev.row.classList.add('si-loot__row--bump');
      scheduleOut(prev);
      return;
    }
    const countEl = h('span', { class: 'si-loot__count' }, count ? `×${formatNumber(count)}` : '');
    const row = h('div', { class: 'si-loot__row', dataset: { rarity: rarity ?? 'common' } },
      h('span', { class: 'si-loot__icon' }, icon), h('span', { class: 'si-loot__name' }, label), countEl);
    loot.append(row);
    while (loot.children.length > MAX_LOOT) loot.firstChild.remove();
    const info = { key, row, countEl, count, timer: 0 };
    merged.set(key, info);
    scheduleOut(info);
  }

  function item(itemId, count) {
    const it = ctx.game.data.getItem(itemId);
    if (!it) return;
    lootRow(`item:${itemId}`, entryIcon(it), it.name, count, it.rarity);
  }

  function gold(amount) {
    lootRow('gold', glyph('coin'), '골드', amount, 'gold');
  }

  function exp(amount) {
    lootRow('exp', h('span', { class: 'si-loot__exp' }, 'EXP'), '경험치', amount, 'exp');
  }

  /** kind: 'level' | 'island' | 'quest' */
  function banner(title, sub, kind = 'quest') {
    const el = h('div', { class: `si-banner si-banner--${kind}` },
      h('div', { class: 'si-banner__title' }, title), sub ? h('div', { class: 'si-banner__sub' }, sub) : null);
    center.append(el);
    while (center.children.length > 3) center.firstChild.remove();
    removeAfter(el, kind === 'level' ? 3200 : 2800);
  }

  /** kind: 'error' | 'info' */
  function alert(text, kind = 'info') {
    const last = alerts.lastElementChild;
    if (last && last.textContent === text) last.remove();
    const el = h('div', { class: `si-alert si-alert--${kind}` }, text);
    alerts.append(el);
    while (alerts.children.length > 3) alerts.firstChild.remove();
    removeAfter(el, 2400);
  }

  /** 피해 숫자. x, y는 화면 좌표(px). opts: { crit, heal, self } */
  function damageText(x, y, value, opts = {}) {
    const kind = opts.heal ? 'heal' : opts.self ? 'self' : opts.crit ? 'crit' : 'hit';
    const jitter = (Math.random() - 0.5) * 24;
    const el = h('div', { class: `si-dmgtext si-dmgtext--${kind}`, style: { left: `${x + jitter}px`, top: `${y}px` } },
      opts.heal ? `+${formatNumber(value)}` : formatNumber(value));
    damage.append(el);
    while (damage.children.length > MAX_DAMAGE) damage.firstChild.remove();
    removeAfter(el, 900);
  }

  return { loot, center, alerts, damage, item, gold, exp, banner, alert, damageText };
}
