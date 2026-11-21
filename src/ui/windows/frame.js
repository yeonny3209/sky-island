// 가운데 뜨는 창의 공통 틀 (제목, 닫기 버튼, 바깥을 누르면 닫힘)
import { h } from '../dom.js';
import { glyph } from '../icons.js';

export function createWindowFrame({ title, className = '', onClose }) {
  const titleEl = h('h2', { class: 'si-window__title' }, title);
  const closeBtn = h('button', { class: 'si-window__close', type: 'button', 'aria-label': '닫기' }, glyph('close'));
  const body = h('div', { class: 'si-window__body' });
  const panel = h('div', { class: `si-window ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'si-window__head' }, titleEl, closeBtn), body);
  const el = h('div', { class: 'si-backdrop si-interactive', hidden: true }, panel);
  el.addEventListener('pointerdown', (e) => {
    if (e.target === el) onClose();
  });
  closeBtn.addEventListener('click', onClose);
  return { el, panel, body, titleEl };
}
