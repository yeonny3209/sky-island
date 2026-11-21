// 시작 화면: 로그인(온라인: 이메일, 오프라인: 테스트 이름) → 캐릭터 불러오기 → 없으면 만들기 → 월드 입장
import { h, replace } from './dom.js';
import { entryIcon, glyph } from './icons.js';

export function createScreens(ctx) {
  const { game } = ctx;
  const el = h('div', { class: 'si-screen si-interactive', hidden: true });
  const s = game.session;

  function show(...children) {
    el.hidden = false;
    replace(el, h('div', { class: 'si-login si-panel' },
      h('div', { class: 'si-login__logo' }, glyph('wind')),
      h('h1', { class: 'si-login__title' }, '하늘섬 연대기'),
      children));
  }

  function hide() {
    el.hidden = true;
    el.replaceChildren();
  }

  const errorLine = (text = '') => h('div', { class: 'si-login__error', role: 'alert' }, text);
  const focusLater = (input) => setTimeout(() => input.focus(), 60);

  function showLogin(message = '') {
    const err = errorLine(message || s.configError || '');
    if (s.isOnline) {
      let mode = 'login';
      const email = h('input', { class: 'si-input', type: 'email', placeholder: '이메일', autocomplete: 'email' });
      const pw = h('input', { class: 'si-input', type: 'password', placeholder: '비밀번호 (6자 이상)', autocomplete: 'current-password' });
      const submit = h('button', { class: 'si-button si-button--primary si-login__submit', type: 'submit' }, '로그인');
      const tabLogin = h('button', { class: 'si-tab si-tab--on', type: 'button' }, '로그인');
      const tabJoin = h('button', { class: 'si-tab', type: 'button' }, '가입');
      const setMode = (m) => {
        mode = m;
        tabLogin.classList.toggle('si-tab--on', m === 'login');
        tabJoin.classList.toggle('si-tab--on', m === 'join');
        submit.textContent = m === 'login' ? '로그인' : '가입하기';
        pw.autocomplete = m === 'login' ? 'current-password' : 'new-password';
        err.textContent = '';
      };
      tabLogin.addEventListener('click', () => setMode('login'));
      tabJoin.addEventListener('click', () => setMode('join'));
      const form = h('form', { class: 'si-login__form' }, h('div', { class: 'si-tabs' }, tabLogin, tabJoin), email, pw, submit, err);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submit.disabled = true;
        err.textContent = '';
        const res = mode === 'login' ? await s.signIn(email.value, pw.value) : await s.signUp(email.value, pw.value);
        submit.disabled = false;
        if (res.ok && res.needsConfirm) err.textContent = '메일함의 확인 링크를 누른 뒤 로그인해 주세요.';
        else if (res.ok) afterLogin();
        else err.textContent = res.error;
      });
      show(h('div', { class: 'si-login__badge si-login__badge--on' }, '온라인'), form);
      focusLater(email);
      return;
    }
    const name = h('input', { class: 'si-input', placeholder: '테스트 이름 (2~12자)', maxlength: '12', value: s.lastOfflineProfile() || '' });
    const submit = h('button', { class: 'si-button si-button--primary si-login__submit', type: 'submit' }, '시작');
    const form = h('form', { class: 'si-login__form' }, name, submit, err);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await s.signInOffline(name.value);
      if (res.ok) afterLogin();
      else err.textContent = res.error;
    });
    const profiles = s.offlineProfiles();
    show(
      h('div', { class: 'si-login__badge' }, '오프라인 모드'),
      h('p', { class: 'si-login__sub' }, '이 브라우저에만 저장돼요. 탭을 하나 더 열어 다른 이름으로 들어가면 함께 플레이를 시험할 수 있어요.'),
      profiles.length
        ? h('div', { class: 'si-login__profiles' }, profiles.map((p) => {
          const b = h('button', { class: 'si-button si-button--ghost', type: 'button' }, p);
          b.addEventListener('click', async () => {
            const res = await s.signInOffline(p);
            if (res.ok) afterLogin();
            else err.textContent = res.error;
          });
          return b;
        }))
        : null,
      form);
    focusLater(name);
  }

  async function afterLogin() {
    show(h('p', { class: 'si-login__sub' }, '캐릭터를 불러오는 중…'));
    const res = await s.loadCharacter();
    if (!res.ok) showLogin(res.error);
    else if (!res.character) showCreate();
    else enter();
  }

  function showCreate() {
    const cls = game.data.getClass(game.data.defaultClassId);
    const name = h('input', { class: 'si-input', placeholder: '캐릭터 이름 (2~12자)', maxlength: '12', value: s.user?.profile ?? '' });
    const err = errorLine();
    const submit = h('button', { class: 'si-button si-button--primary si-login__submit', type: 'submit' }, '만들기');
    const form = h('form', { class: 'si-login__form' }, name, submit, err);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submit.disabled = true;
      const res = await s.createCharacter(name.value);
      submit.disabled = false;
      if (res.ok) enter();
      else err.textContent = res.error;
    });
    show(
      h('div', { class: 'si-login__class', style: { '--class-color': cls.color } },
        cls.icon ? h('div', { class: 'si-portrait si-portrait--img si-login__portrait' }, entryIcon(cls)) : null,
        h('div', { class: 'si-login__class-name' }, cls.name),
        cls.description ? h('p', { class: 'si-login__sub' }, cls.description) : null),
      form);
    focusLater(name);
  }

  async function enter() {
    hide();
    const res = await game.enterWorld();
    if (!res.ok) showLogin(res.error);
  }

  return {
    el,
    start: () => (s.user ? afterLogin() : showLogin()),
    showLogin,
    isOpen: () => !el.hidden,
  };
}
