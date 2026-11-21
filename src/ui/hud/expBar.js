// 화면 맨 아래 경험치 바. 엔진의 'player:exp' 값을 그대로 받는다.
import { h } from '../dom.js';
import { formatNumber } from '../format.js';

export function createExpBar() {
  const fill = h('div', { class: 'si-exp__fill' });
  const text = h('div', { class: 'si-exp__text' });
  const el = h('div', { class: 'si-exp' }, fill, text);

  return {
    el,
    /** { level, exp, expToNext, isMaxLevel } */
    set({ level, exp, expToNext, isMaxLevel }) {
      const pct = isMaxLevel ? 100 : (exp / expToNext) * 100;
      fill.style.width = `${pct}%`;
      text.textContent = isMaxLevel
        ? `Lv.${level}  ·  최고 레벨`
        : `Lv.${level}  ·  ${formatNumber(exp)} / ${formatNumber(expToNext)}  (${pct.toFixed(1)}%)`;
    },
  };
}
