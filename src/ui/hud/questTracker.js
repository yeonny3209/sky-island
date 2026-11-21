// 오른쪽: 진행 중인 퀘스트 목표. 머리를 누르면 접힌다.
import { h, replace } from '../dom.js';
import { glyph } from '../icons.js';

export function createQuestTracker(ctx) {
  const { book } = ctx;
  const count = h('span', { class: 'si-quests__count' });
  const head = h('button', { class: 'si-quests__head si-interactive', type: 'button', 'aria-expanded': 'true' },
    glyph('scroll'), h('span', { class: 'si-quests__label' }, '퀘스트'), count, h('span', { class: 'si-quests__chevron' }, '▾'));
  const list = h('div', { class: 'si-quests__list' });
  const el = h('div', { class: 'si-quests', hidden: true }, head, list);

  head.addEventListener('click', () => {
    const collapsed = el.classList.toggle('si-quests--collapsed');
    head.setAttribute('aria-expanded', String(!collapsed));
  });

  function render() {
    const tracked = book.tracked();
    el.hidden = tracked.length === 0;
    count.textContent = String(tracked.length);
    replace(list, tracked.map(({ quest, status, objectives }) => h('div', { class: `si-quest si-quest--${status}`, dataset: { quest: quest.id } },
      h('div', { class: 'si-quest__name' }, quest.name),
      status === 'ready'
        ? h('div', { class: 'si-quest__ready' }, `완료! ${book.npc(quest.turnIn).name}에게 보고하기`)
        : objectives.map((o) => h('div', { class: `si-quest__obj${o.done ? ' si-quest__obj--done' : ''}` },
          h('span', null, o.label), h('span', { class: 'si-quest__num' }, `${o.current}/${o.required}`))))));
  }

  function flash(questId) {
    const row = list.querySelector(`[data-quest="${questId}"]`);
    if (!row) return;
    row.classList.remove('si-quest--flash');
    void row.offsetWidth;
    row.classList.add('si-quest--flash');
  }

  return { el, render, flash };
}
