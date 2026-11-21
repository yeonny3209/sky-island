// 아래 가운데 스킬 버튼 (PC 전용. 터치 화면은 엔진이 공격·스킬 버튼을 그린다).
// 버튼을 누르면 game.combat.useSlot(i). 재사용 대기는 매 프레임 game.combat.getSlots()에서 읽는다.
// 맨 오른쪽은 물약 칸: 가방에 가장 많은 회복 아이템을 game.useItem으로 쓴다.
import { h, replace } from '../dom.js';
import { glyph } from '../icons.js';
import { formatSeconds } from '../format.js';
import { keyLabel } from '../../engine/input/bindings.js';

export const POTION_KEY_CODE = 'Digit4';
const SKILL_GLYPHS = ['slash', 'dash', 'whirl', 'blessing'];

export function createSkillBar(ctx) {
  const { game } = ctx;
  const el = h('div', { class: 'si-skills' });
  let buttons = [];
  let potion = null;

  function makeButton(slot, i) {
    const cd = h('div', { class: 'si-skill__cd' });
    const cdText = h('div', { class: 'si-skill__cdtext' });
    const keys = slot.keys.map(keyLabel);
    if (i === 0) keys.unshift('클릭');
    const skill = i === 0 ? null : game.data.getSkill(slot.skillId);
    const btn = h('button', {
      class: `si-skill si-skill--${i === 0 ? 'basic' : `s${i}`} si-interactive`,
      type: 'button',
      title: `${slot.name}${slot.description ? ` — ${slot.description}` : ''}`,
      'aria-label': slot.name,
    },
    h('div', { class: 'si-skill__icon' }, glyph(SKILL_GLYPHS[i] ?? 'slash', skill?.color ?? '#dfe9ff')),
    cd, cdText,
    h('div', { class: 'si-skill__key' }, keys.slice(0, 2).join('/')),
    h('div', { class: 'si-skill__name' }, slot.name));
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.combat.useSlot(i);
    });
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    return { btn, cd, cdText, wasCooling: false };
  }

  function makePotion() {
    const icon = h('div', { class: 'si-skill__icon' }, glyph('potion', '#ff7a7a'));
    const count = h('div', { class: 'si-skill__count' });
    const btn = h('button', { class: 'si-skill si-skill--potion si-interactive', type: 'button', 'aria-label': '물약' },
      icon, count, h('div', { class: 'si-skill__key' }, keyLabel(POTION_KEY_CODE)));
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      usePotion();
    });
    return { btn, icon, count, itemId: null };
  }

  /** 가방에서 회복 아이템 중 가장 많이 가진 것 */
  function pickPotion() {
    const c = game.character;
    if (!c) return null;
    let best = null;
    for (const stack of c.inventory) {
      const item = game.data.getItem(stack.itemId);
      if (item?.effect?.heal && (!best || stack.count > best.count)) best = { item, count: stack.count };
    }
    return best;
  }

  function usePotion() {
    const best = pickPotion();
    if (!best) {
      ctx.feed.alert('물약이 없어요.', 'error');
      return;
    }
    const r = game.useItem(best.item.id);
    if (!r.ok) ctx.feed.alert(r.reason, 'error');
  }

  function render(slots) {
    buttons = slots.map(makeButton);
    potion = makePotion();
    replace(el, buttons.map((b) => b.btn), potion.btn);
    refreshPotion();
  }

  function refreshPotion() {
    if (!potion) return;
    const best = pickPotion();
    potion.count.textContent = best ? String(best.count) : '';
    potion.btn.classList.toggle('si-skill--empty', !best);
    potion.btn.title = best ? `${best.item.name} (${keyLabel(POTION_KEY_CODE)})` : '물약 없음';
  }

  /** 매 프레임: 재사용 대기 표시 */
  function tick() {
    if (!game.inWorld || !buttons.length) return;
    game.combat.getSlots().forEach((s, i) => {
      const b = buttons[i];
      if (!b) return;
      const ratio = s.cooldownTotal > 0 ? s.cooldown / s.cooldownTotal : 0;
      b.cd.style.setProperty('--cd', `${ratio * 360}deg`);
      b.cdText.textContent = s.cooldown > 0.05 && s.cooldownTotal >= 1 ? formatSeconds(s.cooldown) : '';
      const cooling = s.cooldown > 0.05;
      if (b.wasCooling && !cooling && s.cooldownTotal >= 1) {
        b.btn.classList.remove('si-skill--ready');
        void b.btn.offsetWidth;
        b.btn.classList.add('si-skill--ready');
      }
      b.wasCooling = cooling;
    });
  }

  return { el, render, refreshPotion, usePotion, tick };
}
