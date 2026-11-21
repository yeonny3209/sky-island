// 왼쪽 위: 초상화, 레벨, 이름·직업, 체력 바, 골드
import { h, replace } from '../dom.js';
import { entryIcon, glyph } from '../icons.js';
import { formatNumber } from '../format.js';

export function createPlayerFrame() {
  const portrait = h('div', { class: 'si-portrait' }, glyph('wind'));
  const levelBadge = h('div', { class: 'si-portrait__level' }, '1');
  const nameEl = h('span', { class: 'si-player__name' });
  const classEl = h('span', { class: 'si-player__class' });
  const hpGhost = h('div', { class: 'si-bar__ghost' });
  const hpFill = h('div', { class: 'si-bar__fill' });
  const hpText = h('div', { class: 'si-bar__text' });
  const goldEl = h('span', { class: 'si-player__gold-value' }, '0');
  const el = h('div', { class: 'si-player si-panel' },
    h('div', { class: 'si-portrait-wrap' }, portrait, levelBadge),
    h('div', { class: 'si-player__body' },
      h('div', { class: 'si-player__title' }, nameEl, classEl),
      h('div', { class: 'si-bar si-bar--hp' }, hpGhost, hpFill, hpText),
      h('div', { class: 'si-player__gold' }, glyph('coin'), goldEl)));

  return {
    el,
    setIdentity(name, cls) {
      nameEl.textContent = name;
      classEl.textContent = cls?.name ?? '';
      portrait.style.setProperty('--class-color', cls?.color ?? '#5b8def');
      // 직업 초상화(icon)가 있으면 그림을, 없으면 바람 모양 임시 그림을 쓴다
      replace(portrait, cls?.icon ? entryIcon(cls) : glyph('wind'));
      portrait.classList.toggle('si-portrait--img', Boolean(cls?.icon));
    },
    setLevel(level) {
      levelBadge.textContent = String(level);
    },
    setHp(hp, maxHp) {
      const max = Math.max(1, maxHp);
      const pct = Math.min(100, Math.max(0, (hp / max) * 100));
      hpFill.style.width = `${pct}%`;
      hpGhost.style.width = `${pct}%`;
      hpText.textContent = `${Math.ceil(hp)} / ${max}`;
      el.classList.toggle('si-player--low', pct <= 30);
    },
    setGold(gold) {
      goldEl.textContent = formatNumber(gold);
    },
  };
}
