// 왼쪽 아래 채팅. 엔진의 'chat:message'를 받아 그리고, 보낼 때는 game.net.sendChat.
// 다른 사람이 쓴 글은 textContent로만 넣는다. 터치 화면에서는 메뉴의 채팅 버튼으로 연다.
import { h } from '../dom.js';
import { glyph } from '../icons.js';

const MAX_MESSAGES = 60;

export function createChat(ctx) {
  const log = h('div', { class: 'si-chat__log', role: 'log', 'aria-live': 'polite' });
  const input = h('input', {
    class: 'si-chat__input', type: 'text', maxlength: '200', placeholder: 'Enter로 채팅',
    enterkeyhint: 'send', autocomplete: 'off', 'aria-label': '채팅 입력',
  });
  const form = h('form', { class: 'si-chat__form' }, input,
    h('button', { class: 'si-chat__send', type: 'submit', 'aria-label': '보내기' }, glyph('send')));
  const closeBtn = h('button', { class: 'si-chat__close', type: 'button', 'aria-label': '채팅 닫기' }, glyph('close'));
  const el = h('div', { class: 'si-chat si-panel si-interactive' }, closeBtn, log, form);

  let unread = 0;
  let open = false;

  function send() {
    const text = input.value.trim();
    if (text) {
      const r = ctx.game.net.sendChat(text);
      if (r.ok) input.value = '';
      else add({ system: true, text: r.reason });
    }
    input.blur();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // 글 쓰는 중에는 게임 키로 넘기지 않는다
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') input.blur();
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  closeBtn.addEventListener('click', () => setOpen(false));

  function setOpen(value) {
    open = value;
    el.classList.toggle('si-chat--open', open);
    if (open) {
      unread = 0;
      ctx.menu.setChatBadge(0);
    }
  }

  /** 엔진 메시지 { name, text, self } 또는 { system: true, text } */
  function add(m) {
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    const row = m.system
      ? h('div', { class: 'si-chat__msg si-chat__msg--system' }, h('span', { class: 'si-chat__text' }, `· ${m.text}`))
      : h('div', { class: `si-chat__msg${m.self ? ' si-chat__msg--self' : ''}` },
        h('span', { class: 'si-chat__from' }, `${m.name}: `), h('span', { class: 'si-chat__text' }, m.text));
    log.append(row);
    while (log.children.length > MAX_MESSAGES) log.firstChild.remove();
    if (nearBottom) log.scrollTop = log.scrollHeight;
    if (ctx.isTouch() && !open && !m.system && !m.self) {
      unread += 1;
      ctx.menu.setChatBadge(unread);
    }
  }

  function focus() {
    if (ctx.isTouch()) setOpen(true);
    input.focus();
  }

  return { el, add, focus, setOpen, toggle: () => setOpen(!open), clear: () => log.replaceChildren() };
}
