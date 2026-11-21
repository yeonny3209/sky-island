// 가방 창: 왼쪽 장비·능력치, 오른쪽 가방 칸. 칸을 누르면 정보 카드와 [장착]/[사용]/[해제] 버튼이 뜬다.
// PC에서는 마우스를 올리면 미리 보고, 두 번 누르면 바로 장착·사용한다.
// 엔진의 가방은 칸 제한이 없는 목록([{ itemId, count }])이라 최소 24칸을 그리고 넘치면 늘린다.
import { append, h, replace } from '../dom.js';
import { entryIcon, glyph } from '../icons.js';
import { RARITY_LABEL, SLOT_LABEL, STAT_LABEL, TYPE_LABEL, formatNumber, formatStat } from '../format.js';
import { createWindowFrame } from './frame.js';
import { EQUIP_SLOTS } from '../../engine/core/dataBuilder.js';

const MIN_CELLS = 24;
const STAT_ORDER = ['maxHp', 'attack', 'defense', 'critRate', 'moveSpeed'];

export function createInventoryWindow(ctx) {
  const { game } = ctx;
  const frame = createWindowFrame({ title: '가방', className: 'si-inv', onClose: () => close() });

  const equipButtons = {};
  const equipGrid = h('div', { class: 'si-equip-grid' }, EQUIP_SLOTS.map((slot) => {
    equipButtons[slot] = h('button', { class: 'si-slot si-slot--equip', type: 'button', 'aria-label': SLOT_LABEL[slot] ?? slot });
    return h('div', { class: 'si-equip' }, equipButtons[slot], h('span', { class: 'si-equip__label' }, SLOT_LABEL[slot] ?? slot));
  }));
  const statsEl = h('dl', { class: 'si-stats' });
  const grid = h('div', { class: 'si-grid' });
  const goldEl = h('span', { class: 'si-gold__value' });
  const capEl = h('span', { class: 'si-inv__cap' });
  frame.body.append(
    h('div', { class: 'si-inv__equip' }, h('div', { class: 'si-inv__section' }, '장비'), equipGrid, h('div', { class: 'si-inv__section' }, '능력치'), statsEl),
    h('div', { class: 'si-inv__bag' }, grid, h('div', { class: 'si-inv__footer' }, h('span', { class: 'si-gold' }, glyph('coin'), goldEl), capEl)));
  const card = h('div', { class: 'si-card', hidden: true });
  frame.el.append(card);

  let isOpen = false;
  let selected = null; // { kind: 'bag', itemId } | { kind: 'equip', slot }
  let hovering = false;

  const ch = () => game.character;
  const itemOf = (sel) => {
    const id = sel.kind === 'bag' ? sel.itemId : ch()?.equipment[sel.slot];
    return id ? game.data.getItem(id) : null;
  };
  const anchorOf = (sel) => (sel.kind === 'equip'
    ? equipButtons[sel.slot]
    : grid.querySelector(`[data-item="${CSS.escape(sel.itemId)}"]`));
  const same = (a, b) => a && b && a.kind === b.kind && a.itemId === b.itemId && a.slot === b.slot;

  function fillSlot(btn, item, count) {
    btn.replaceChildren();
    btn.classList.toggle('si-slot--empty', !item);
    btn.classList.remove('si-slot--unusable');
    if (!item) {
      delete btn.dataset.rarity;
      return;
    }
    btn.dataset.rarity = item.rarity ?? 'common';
    append(btn, [entryIcon(item), count > 1 ? h('span', { class: 'si-slot__count' }, formatNumber(count)) : null]);
    if (item.slot && item.levelReq > ch().level) btn.classList.add('si-slot--unusable');
  }

  function bindSlot(btn, sel) {
    btn.addEventListener('click', () => select(sel, btn));
    btn.addEventListener('dblclick', () => primaryAction(sel));
    btn.addEventListener('pointerenter', () => hoverPreview(sel, btn));
    btn.addEventListener('pointerleave', hoverEnd);
  }
  for (const slot of EQUIP_SLOTS) bindSlot(equipButtons[slot], { kind: 'equip', slot });

  function render() {
    const c = ch();
    if (!c) return;
    const cells = Math.max(MIN_CELLS, Math.ceil(c.inventory.length / 6) * 6);
    replace(grid, Array.from({ length: cells }, (_, i) => {
      const stack = c.inventory[i];
      const btn = h('button', { class: 'si-slot', type: 'button', dataset: stack ? { item: stack.itemId } : null });
      fillSlot(btn, stack ? game.data.getItem(stack.itemId) : null, stack?.count ?? 0);
      if (stack) bindSlot(btn, { kind: 'bag', itemId: stack.itemId });
      btn.classList.toggle('si-slot--selected', Boolean(stack) && same(selected, { kind: 'bag', itemId: stack.itemId }));
      return btn;
    }));
    for (const slot of EQUIP_SLOTS) {
      const id = c.equipment[slot];
      fillSlot(equipButtons[slot], id ? game.data.getItem(id) : null, 1);
      equipButtons[slot].classList.toggle('si-slot--selected', same(selected, { kind: 'equip', slot }));
    }
    goldEl.textContent = formatNumber(c.gold);
    capEl.textContent = `${c.inventory.length}종류`;
    const st = c.stats;
    replace(statsEl, STAT_ORDER.map((key) => [h('dt', null, STAT_LABEL[key]), h('dd', null, formatStat(key, st[key] ?? 0))]));
    if (selected) {
      if (!itemOf(selected)) clearSelection();
      else showCard(selected, anchorOf(selected), true);
    }
  }

  function select(sel, btn) {
    if (same(selected, sel) || !itemOf(sel)) {
      clearSelection();
      return;
    }
    selected = sel;
    hovering = false;
    for (const b of frame.panel.querySelectorAll('.si-slot')) b.classList.toggle('si-slot--selected', b === btn);
    showCard(sel, btn, true);
  }

  function clearSelection() {
    selected = null;
    card.hidden = true;
    for (const b of frame.panel.querySelectorAll('.si-slot--selected')) b.classList.remove('si-slot--selected');
  }

  function hoverPreview(sel, btn) {
    if (ctx.isTouch() || selected || !itemOf(sel)) return;
    hovering = true;
    showCard(sel, btn, false);
  }

  function hoverEnd() {
    if (hovering && !selected) card.hidden = true;
    hovering = false;
  }

  function act(fn) {
    const r = fn();
    if (r && !r.ok && r.reason) ctx.feed.alert(r.reason, 'error');
  }

  function primaryAction(sel) {
    const item = itemOf(sel);
    if (!item) return;
    if (sel.kind === 'equip') act(() => ch().unequip(sel.slot));
    else if (item.slot) act(() => ch().equip(item.id));
    else if (item.effect) act(() => game.useItem(item.id));
  }

  function statLines(item, compare) {
    const cur = compare && item.slot ? ch().equipment[item.slot] : null;
    const curItem = cur && cur !== item.id ? game.data.getItem(cur) : null;
    const keys = new Set([...Object.keys(item.stats ?? {}), ...Object.keys(curItem?.stats ?? {})]);
    return STAT_ORDER.filter((k) => keys.has(k)).map((key) => {
      const value = item.stats?.[key] ?? 0;
      let diff = null;
      if (curItem) {
        const d = Math.round((value - (curItem.stats?.[key] ?? 0)) * 1000) / 1000;
        if (d !== 0) diff = h('span', { class: `si-card__diff si-card__diff--${d > 0 ? 'up' : 'down'}` }, `${d > 0 ? '▲' : '▼'} ${formatStat(key, Math.abs(d))}`);
      }
      return h('div', { class: 'si-card__stat' }, h('span', null, STAT_LABEL[key] ?? key), h('b', null, formatStat(key, value, { sign: true })), diff);
    });
  }

  function showCard(sel, anchor, withActions) {
    const item = itemOf(sel);
    if (!item || !anchor) return;
    const lowLevel = item.slot && item.levelReq > ch().level;
    const actions = [];
    if (withActions) {
      if (sel.kind === 'equip') actions.push(['해제', () => ch().unequip(sel.slot)]);
      else if (item.slot) actions.push(['장착', () => ch().equip(item.id), lowLevel]);
      else if (item.effect) actions.push(['사용', () => game.useItem(item.id)]);
    }
    const kindLabel = item.slot ? SLOT_LABEL[item.slot] ?? item.slot : TYPE_LABEL[item.type] ?? item.type;
    replace(card,
      h('div', { class: 'si-card__head' },
        h('div', { class: 'si-slot si-card__icon', dataset: { rarity: item.rarity ?? 'common' } }, entryIcon(item)),
        h('div', null,
          h('div', { class: 'si-card__name', dataset: { rarity: item.rarity ?? 'common' } }, item.name),
          h('div', { class: 'si-card__meta' }, `${RARITY_LABEL[item.rarity] ?? '일반'} · ${kindLabel}`))),
      item.slot && item.levelReq ? h('div', { class: `si-card__req${lowLevel ? ' si-card__req--bad' : ''}` }, `레벨 ${item.levelReq} 이상`) : null,
      Object.keys(item.stats ?? {}).length ? h('div', { class: 'si-card__stats' }, statLines(item, sel.kind === 'bag')) : null,
      item.effect?.heal ? h('div', { class: 'si-card__use' }, `사용: 체력 ${item.effect.heal} 회복`) : null,
      item.description ? h('p', { class: 'si-card__desc' }, item.description) : null,
      actions.length
        ? h('div', { class: 'si-card__actions' }, actions.map(([label, fn, disabled]) => {
          const btn = h('button', { class: 'si-button si-button--primary', type: 'button', disabled: disabled || null }, label);
          btn.addEventListener('click', () => {
            clearSelection();
            act(fn);
          });
          return btn;
        }))
        : null);
    card.classList.toggle('si-card--preview', !withActions);
    placeCard(anchor);
  }

  function placeCard(anchor) {
    card.hidden = false;
    const m = 8;
    const a = anchor.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    let left = a.right + m;
    let top = a.top;
    if (left + c.width > window.innerWidth - m) left = a.left - c.width - m;
    if (left < m) {
      left = Math.min(window.innerWidth - c.width - m, Math.max(m, a.left + a.width / 2 - c.width / 2));
      top = a.bottom + m;
      if (top + c.height > window.innerHeight - m) top = a.top - c.height - m;
    }
    top = Math.min(Math.max(m, top), window.innerHeight - c.height - m);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  frame.panel.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.si-slot, .si-card')) clearSelection();
  });

  function open() {
    if (isOpen) return;
    isOpen = true;
    frame.el.hidden = false;
    render();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    clearSelection();
    frame.el.hidden = true;
  }

  return {
    el: frame.el,
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    isOpen: () => isOpen,
    refresh: () => isOpen && render(),
    escape() {
      if (selected) clearSelection();
      else close();
    },
  };
}
