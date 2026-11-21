// NPC 대화창 (화면 아래). 엔진의 'npc:interact'(F 키·대화 버튼)로 열린다.
// 열 때 'talk' 목표를 채우고, 퀘스트 수락·완료를 처리한다.
import { h, replace } from '../dom.js';
import { entryIcon, glyph } from '../icons.js';
import { formatNumber } from '../format.js';

export function createDialog(ctx) {
  const { game, book } = ctx;
  const nameEl = h('div', { class: 'si-dialog__name' });
  const titleEl = h('div', { class: 'si-dialog__npc-title' });
  const closeBtn = h('button', { class: 'si-dialog__close', type: 'button', 'aria-label': '대화 닫기' }, glyph('close'));
  const questName = h('div', { class: 'si-dialog__quest', hidden: true });
  const textEl = h('p', { class: 'si-dialog__text' });
  const nextEl = h('div', { class: 'si-dialog__next', hidden: true }, '▼');
  const rewardsEl = h('div', { class: 'si-dialog__rewards', hidden: true });
  const optionsEl = h('div', { class: 'si-dialog__options' });
  const textBox = h('div', { class: 'si-dialog__textbox' }, questName, textEl, nextEl);
  const el = h('div', { class: 'si-dialog si-panel si-interactive', role: 'dialog', 'aria-live': 'polite', hidden: true },
    h('div', { class: 'si-dialog__head' }, h('div', { class: 'si-dialog__plate' }, nameEl, titleEl), closeBtn),
    textBox, rewardsEl, optionsEl);

  let npcId = null;
  let lines = [];
  let lineIndex = 0;
  let afterLines = null;

  closeBtn.addEventListener('click', () => close());
  textBox.addEventListener('click', () => advance());

  const option = (label, onClick, kind = '') => {
    const btn = h('button', { class: `si-dialog__opt${kind ? ` si-dialog__opt--${kind}` : ''}`, type: 'button' }, label);
    btn.addEventListener('click', onClick);
    return btn;
  };

  function rewardChips(quest) {
    const r = quest.rewards ?? {};
    return [
      r.exp ? h('span', { class: 'si-chip' }, h('span', { class: 'si-chip__exp' }, 'EXP'), formatNumber(r.exp)) : null,
      r.gold ? h('span', { class: 'si-chip' }, glyph('coin'), formatNumber(r.gold)) : null,
      (r.items ?? []).map((it) => {
        const item = game.data.getItem(it.itemId);
        if (!item) return null;
        return h('span', { class: 'si-chip', dataset: { rarity: item.rarity ?? 'common' } }, entryIcon(item), it.count > 1 ? `${item.name} ×${it.count}` : item.name);
      }),
    ];
  }

  function showRewards(quest) {
    rewardsEl.hidden = !quest;
    if (quest) replace(rewardsEl, h('span', { class: 'si-dialog__rewards-label' }, '보상'), rewardChips(quest));
  }

  function showMenu() {
    const npc = book.npc(npcId);
    const q = book.forNpc(npcId);
    lines = [];
    questName.hidden = true;
    nextEl.hidden = true;
    showRewards(null);
    textEl.textContent = npc.greeting ?? '…';
    replace(optionsEl,
      q.ready.map((quest) => option([h('span', { class: 'si-mark si-mark--ready' }, '?'), quest.name], () => play(quest, 'complete'), 'ready')),
      q.available.map((quest) => option([h('span', { class: 'si-mark si-mark--new' }, '!'), quest.name], () => play(quest, 'offer'), 'new')),
      q.active.filter((quest) => !q.ready.includes(quest)).map((quest) => option([h('span', { class: 'si-mark' }, '…'), `${quest.name} (진행 중)`], () => play(quest, 'progress'))),
      option('대화 끝내기', () => close(), 'leave'));
  }

  function play(quest, part) {
    lines = quest.dialogue?.[part]?.length ? quest.dialogue[part] : ['…'];
    lineIndex = 0;
    questName.hidden = false;
    questName.textContent = quest.name;
    showRewards(part === 'progress' ? null : quest);
    afterLines = () => {
      if (part === 'offer') {
        replace(optionsEl,
          option('수락하기', () => {
            const r = book.accept(quest.id);
            if (!r.ok) ctx.feed.alert(r.reason, 'error');
            showMenu();
          }, 'primary'),
          option('다음에 할게요', () => showMenu()));
      } else if (part === 'complete') {
        replace(optionsEl, option('보상 받기', () => {
          const r = book.complete(quest.id, npcId);
          if (!r.ok) ctx.feed.alert(r.reason, 'error');
          showMenu();
        }, 'primary'));
      } else {
        replace(optionsEl, option('알겠어요', () => showMenu()));
      }
    };
    showLine();
  }

  function showLine() {
    textEl.textContent = lines[lineIndex];
    textEl.classList.remove('si-dialog__text--in');
    void textEl.offsetWidth;
    textEl.classList.add('si-dialog__text--in');
    const last = lineIndex >= lines.length - 1;
    nextEl.hidden = last;
    if (last) afterLines?.();
    else replace(optionsEl, option('다음 ▸', () => advance()));
  }

  function advance() {
    if (!lines.length || lineIndex >= lines.length - 1) return false;
    lineIndex += 1;
    showLine();
    return true;
  }

  function open(id) {
    npcId = id;
    const npc = book.npc(id);
    nameEl.textContent = npc.name;
    titleEl.textContent = npc.title ?? '';
    el.style.setProperty('--npc-color', npc.color ?? '#e9c46a');
    el.hidden = false;
    book.record('talk', id);
    showMenu();
    ctx.setModal('dialog', true);
  }

  function close() {
    if (npcId === null) return;
    npcId = null;
    lines = [];
    el.hidden = true;
    ctx.setModal('dialog', false);
  }

  return { el, open, close, advance, isOpen: () => npcId !== null, npcId: () => npcId };
}
