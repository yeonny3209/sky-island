// ⚠ 임시 개발용 화면 (엔진 확인용).
// 진짜 화면(로그인·HUD·인벤토리·채팅)은 B가 src/ui/에 만든다. 완성되면 main.js에서 devUI: false로 끈다.
// 이 파일은 엔진 공개 API와 이벤트만 쓰므로 B의 UI를 만들 때 사용 예시로 봐도 된다.

import { keyLabel } from '../input/bindings.js';
import { EQUIP_SLOTS } from '../core/dataBuilder.js';

const SLOT_NAMES = { weapon: '무기', armor: '갑옷', helmet: '투구', boots: '신발', accessory: '장신구' };

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const CSS = `
.dv { position:absolute; inset:0; pointer-events:none; z-index:6; color:#f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif; font-size:14px; }
.dv * { box-sizing:border-box; }
.dv-panel { pointer-events:auto; background:rgba(15,23,42,.78); border:1px solid rgba(255,255,255,.12); border-radius:12px;
  box-shadow:0 8px 24px rgba(0,0,0,.25); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
.dv button { font:inherit; color:#0f172a; background:#e2e8f0; border:0; border-radius:8px; padding:7px 12px; cursor:pointer; font-weight:700; }
.dv button:hover { background:#fff; }
.dv button.primary { background:#3b82f6; color:#fff; }
.dv button.primary:hover { background:#2563eb; }
.dv button.ghost { background:rgba(255,255,255,.1); color:#f8fafc; }
.dv button.ghost:hover { background:rgba(255,255,255,.2); }
.dv button:disabled { opacity:.5; cursor:default; }
.dv input, .dv select { font:inherit; width:100%; padding:9px 11px; border-radius:8px; border:1px solid rgba(255,255,255,.2);
  background:rgba(255,255,255,.08); color:#f8fafc; outline:none; }
.dv input:focus { border-color:#60a5fa; }
.dv select option { color:#0f172a; }
.dv-center { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; }
.dv-card { width:min(380px, 100%); padding:22px; display:flex; flex-direction:column; gap:12px; }
.dv-title { font-size:24px; font-weight:800; text-align:center; letter-spacing:-.02em; }
.dv-sub { font-size:12px; color:#cbd5e1; text-align:center; line-height:1.5; }
.dv-badge { display:inline-block; font-size:11px; font-weight:700; padding:2px 8px; border-radius:99px; background:#334155; }
.dv-badge.on { background:#16a34a; } .dv-badge.off { background:#a16207; }
.dv-error { color:#fca5a5; font-size:13px; min-height:18px; }
.dv-tabs { display:flex; gap:6px; } .dv-tabs button { flex:1; }
.dv-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.dv-profiles { display:flex; gap:6px; flex-wrap:wrap; }
.dv-status { position:absolute; left:calc(12px + env(safe-area-inset-left)); top:calc(12px + env(safe-area-inset-top)); width:min(250px, 46vw); padding:10px 12px; }
.dv-name { font-weight:800; font-size:15px; display:flex; justify-content:space-between; }
.dv-bar { position:relative; height:14px; border-radius:7px; background:rgba(0,0,0,.45); overflow:hidden; margin-top:6px; }
.dv-bar > i { position:absolute; inset:0; transform-origin:left; background:#ef4444; transition:transform .15s; }
.dv-bar.exp { height:8px; } .dv-bar.exp > i { background:#60a5fa; }
.dv-bar > span { position:relative; display:block; text-align:center; font-size:11px; font-weight:700; line-height:14px; text-shadow:0 1px 2px #000; }
.dv-gold { font-size:12px; color:#fde047; margin-top:5px; }
.dv-top { position:absolute; right:calc(12px + env(safe-area-inset-right)); top:calc(12px + env(safe-area-inset-top)); padding:8px 10px;
  display:flex; flex-direction:column; gap:6px; align-items:flex-end; max-width:calc(54vw - 36px); }
.dv-top .dv-row { justify-content:flex-end; }
.dv-top button { padding:5px 9px; font-size:12px; }
.dv-net { font-size:12px; color:#cbd5e1; text-align:right; }
.dv-chat { position:absolute; left:calc(12px + env(safe-area-inset-left)); bottom:calc(12px + env(safe-area-inset-bottom)); width:min(380px, 46vw);
  padding:8px; display:flex; flex-direction:column; gap:6px; background:rgba(15,23,42,.55); }
.dv-log { max-height:150px; overflow-y:auto; font-size:13px; line-height:1.45; word-break:break-all; }
.dv-log .sys { color:#fde68a; } .dv-log .me b { color:#93c5fd; } .dv-log b { color:#f9a8d4; }
.dv-skills { position:absolute; left:50%; bottom:calc(14px + env(safe-area-inset-bottom)); transform:translateX(-50%); display:flex; gap:8px; padding:8px; }
.dv-skill { position:relative; width:58px; height:58px; border-radius:10px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.2);
  display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; cursor:pointer; pointer-events:auto; }
.dv-skill .k { position:absolute; left:4px; top:2px; font-size:10px; color:#cbd5e1; font-weight:700; }
.dv-skill .n { font-size:11px; font-weight:700; text-align:center; padding:0 3px; line-height:1.15; z-index:1; }
.dv-skill .cd { position:absolute; inset:0; background:conic-gradient(rgba(0,0,0,.65) calc(var(--cd,0) * 360deg), transparent 0); }
.dv-skill .t { position:absolute; bottom:2px; font-size:11px; font-weight:800; z-index:1; }
.dv-boss { position:absolute; left:50%; top:calc(14px + env(safe-area-inset-top)); transform:translateX(-50%); width:min(460px, 60vw); padding:8px 12px; text-align:center; display:none; }
.dv-boss .dv-bar { height:16px; } .dv-boss .dv-bar > i { background:linear-gradient(90deg,#be123c,#f43f5e); }
.dv-toasts { position:absolute; left:50%; top:22%; transform:translateX(-50%); display:flex; flex-direction:column; gap:6px; align-items:center; }
.dv-toast { background:rgba(15,23,42,.8); padding:7px 14px; border-radius:99px; font-weight:700; font-size:14px; animation:dvToast 2.6s forwards; }
.dv-toast.big { font-size:20px; padding:10px 20px; background:rgba(30,64,175,.85); }
@keyframes dvToast { 0% { opacity:0; transform:translateY(8px); } 10%,80% { opacity:1; transform:none; } 100% { opacity:0; transform:translateY(-8px); } }
.dv-death { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:rgba(127,29,29,.35);
  font-size:26px; font-weight:800; text-shadow:0 2px 6px #000; }
.dv-modal { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; padding:16px; pointer-events:auto; background:rgba(0,0,0,.25); }
.dv-inv { width:min(560px, 100%); max-height:86vh; overflow:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }
.dv-inv h3 { margin:0; font-size:16px; display:flex; justify-content:space-between; align-items:center; }
.dv-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px; }
.dv-item { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:10px; padding:8px; display:flex; flex-direction:column; gap:4px; }
.dv-item .nm { font-weight:700; } .dv-item .ds { font-size:12px; color:#cbd5e1; }
.dv-item button { padding:4px 8px; font-size:12px; align-self:flex-start; }
.dv-stats { font-size:13px; color:#e2e8f0; display:flex; gap:12px; flex-wrap:wrap; }
.dv-help { width:min(460px, 100%); padding:18px; line-height:1.7; }
.dv-help table { width:100%; border-collapse:collapse; font-size:14px; } .dv-help td { padding:3px 6px; border-bottom:1px solid rgba(255,255,255,.08); }
.dv-help td:first-child { color:#93c5fd; font-weight:700; white-space:nowrap; }
.dv-npc { position:absolute; left:50%; bottom:22%; transform:translateX(-50%); width:min(460px, 92vw); padding:14px 16px; }
.dv-hint { position:absolute; left:50%; bottom:calc(92px + env(safe-area-inset-bottom)); transform:translateX(-50%); padding:6px 12px; font-weight:700; display:none; }
.dv.touch .dv-skills { display:none; }
.dv.touch .dv-chat { bottom:auto; top:calc(112px + env(safe-area-inset-top)); width:min(300px, 46vw); background:rgba(15,23,42,.4); }
.dv.touch .dv-log { max-height:84px; font-size:12px; }
.dv.touch .dv-status { width:min(210px, 46vw); }
.dv.touch .dv-hint { bottom:calc(170px + env(safe-area-inset-bottom)); }
@media (max-width: 640px) {
  .dv-status { padding:8px 10px; } .dv-name { font-size:13px; }
  .dv-top { padding:6px 8px; gap:4px; } .dv-top > div:first-child { font-size:13px; }
  .dv-top button { padding:4px 7px; font-size:11px; } .dv-top .dv-row { gap:4px; }
  .dv-net { font-size:10.5px; }
  .dv-chat input { padding:6px 8px; font-size:13px; }
}
`;

class DevUI {
  constructor(game) {
    this.game = game;
    if (!document.getElementById('dv-styles')) {
      document.head.appendChild(h('style', { id: 'dv-styles' }, CSS));
    }
    this.root = h('div', { class: 'dv' });
    game.container.appendChild(this.root);
    this.isTouch = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    this.root.classList.toggle('touch', this.isTouch);
    this.hud = null;
    this.modal = null;
    this._offs = [];
    window.addEventListener('keydown', (e) => this._onKey(e));
    game.events.on('world:left', () => this._destroyHud());
    this.start();
  }

  clearScreen() {
    if (this.screen) this.screen.remove();
    this.screen = null;
  }

  start() {
    const s = this.game.session;
    if (s.user) this.afterLogin();
    else this.showLogin();
  }

  // ---------- 로그인

  showLogin(message = '') {
    this.clearScreen();
    const s = this.game.session;
    const err = h('div', { class: 'dv-error' }, message || s.configError || '');
    let card;
    if (s.isOnline) {
      let mode = 'login';
      const email = h('input', { type: 'email', placeholder: '이메일', autocomplete: 'email' });
      const pw = h('input', { type: 'password', placeholder: '비밀번호 (6자 이상)', autocomplete: 'current-password' });
      const submit = h('button', { class: 'primary', type: 'submit' }, '로그인');
      const tabLogin = h('button', { type: 'button', class: 'primary' }, '로그인');
      const tabJoin = h('button', { type: 'button', class: 'ghost' }, '가입');
      const setMode = (m) => {
        mode = m;
        tabLogin.className = m === 'login' ? 'primary' : 'ghost';
        tabJoin.className = m === 'join' ? 'primary' : 'ghost';
        submit.textContent = m === 'login' ? '로그인' : '가입하기';
        pw.autocomplete = m === 'login' ? 'current-password' : 'new-password';
        err.textContent = '';
      };
      tabLogin.addEventListener('click', () => setMode('login'));
      tabJoin.addEventListener('click', () => setMode('join'));
      const form = h(
        'form',
        { class: 'dv-card', style: 'padding:0' },
        h('div', { class: 'dv-tabs' }, tabLogin, tabJoin),
        email,
        pw,
        submit,
        err
      );
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submit.disabled = true;
        err.textContent = '';
        const res = mode === 'login' ? await s.signIn(email.value, pw.value) : await s.signUp(email.value, pw.value);
        submit.disabled = false;
        if (res.ok) this.afterLogin();
        else err.textContent = res.error;
      });
      card = h(
        'div',
        { class: 'dv-panel dv-card' },
        h('div', { class: 'dv-title' }, '하늘섬 연대기'),
        h('div', { class: 'dv-sub' }, h('span', { class: 'dv-badge on' }, '온라인'), ' Supabase에 연결됨'),
        form
      );
      setTimeout(() => email.focus(), 50);
    } else {
      const name = h('input', { placeholder: '테스트 이름 (2~12자)', maxlength: '12', value: s.lastOfflineProfile() || '' });
      const submit = h('button', { class: 'primary', type: 'submit' }, '시작');
      const profiles = s.offlineProfiles();
      const form = h('form', { class: 'dv-card', style: 'padding:0' }, name, submit, err);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await s.signInOffline(name.value);
        if (res.ok) this.afterLogin();
        else err.textContent = res.error;
      });
      card = h(
        'div',
        { class: 'dv-panel dv-card' },
        h('div', { class: 'dv-title' }, '하늘섬 연대기'),
        h(
          'div',
          { class: 'dv-sub' },
          h('span', { class: 'dv-badge off' }, '오프라인 모드'),
          h('br'),
          '.env에 Supabase 키가 없어서 이 브라우저에만 저장합니다.',
          h('br'),
          '탭을 하나 더 열어 다른 이름으로 들어가면 멀티플레이를 시험할 수 있어요.'
        ),
        profiles.length
          ? h(
              'div',
              { class: 'dv-profiles' },
              profiles.map((p) =>
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'ghost',
                    onclick: async () => {
                      const res = await s.signInOffline(p);
                      if (res.ok) this.afterLogin();
                    },
                  },
                  p
                )
              )
            )
          : null,
        form
      );
      setTimeout(() => name.focus(), 50);
    }
    this.screen = h('div', { class: 'dv-center' }, card);
    this.root.appendChild(this.screen);
  }

  async afterLogin() {
    this.clearScreen();
    this.screen = h('div', { class: 'dv-center' }, h('div', { class: 'dv-panel dv-card' }, h('div', { class: 'dv-sub' }, '캐릭터를 불러오는 중...')));
    this.root.appendChild(this.screen);
    const res = await this.game.session.loadCharacter();
    if (!res.ok) {
      this.showLogin(res.error);
      return;
    }
    if (!res.character) this.showCreate();
    else this.enter();
  }

  showCreate() {
    this.clearScreen();
    const s = this.game.session;
    const name = h('input', { placeholder: '캐릭터 이름 (2~12자)', maxlength: '12', value: s.user && s.user.profile ? s.user.profile : '' });
    const err = h('div', { class: 'dv-error' });
    const submit = h('button', { class: 'primary', type: 'submit' }, '만들기');
    const cls = this.game.data.getClass(this.game.data.defaultClassId);
    const form = h(
      'form',
      { class: 'dv-panel dv-card' },
      h('div', { class: 'dv-title' }, '캐릭터 만들기'),
      h('div', { class: 'dv-sub' }, `직업: ${cls.name}`),
      name,
      submit,
      err
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submit.disabled = true;
      const res = await s.createCharacter(name.value);
      submit.disabled = false;
      if (res.ok) this.enter();
      else err.textContent = res.error;
    });
    this.screen = h('div', { class: 'dv-center' }, form);
    this.root.appendChild(this.screen);
    setTimeout(() => name.focus(), 50);
  }

  async enter() {
    this.clearScreen();
    this._buildHud();
    const res = await this.game.enterWorld();
    if (!res.ok) this.showLogin(res.error);
  }

  // ---------- HUD

  _buildHud() {
    const game = this.game;
    const ev = game.events;
    const on = (type, fn) => this._offs.push(ev.on(type, fn));
    const hud = h('div', { style: 'position:absolute; inset:0;' });
    this.hud = hud;
    this.root.appendChild(hud);

    // 상태창
    const nameEl = h('span');
    const lvEl = h('span');
    const hpFill = h('i');
    const hpText = h('span');
    const expFill = h('i');
    const goldEl = h('div', { class: 'dv-gold' });
    hud.append(
      h(
        'div',
        { class: 'dv-panel dv-status' },
        h('div', { class: 'dv-name' }, nameEl, lvEl),
        h('div', { class: 'dv-bar' }, hpFill, hpText),
        h('div', { class: 'dv-bar exp', title: '경험치' }, expFill),
        goldEl
      )
    );
    on('world:entered', ({ name }) => (nameEl.textContent = name));
    on('player:hp', ({ hp, maxHp }) => {
      hpFill.style.transform = `scaleX(${maxHp ? hp / maxHp : 0})`;
      hpText.textContent = `${hp} / ${maxHp}`;
    });
    on('player:exp', ({ level, exp, expToNext, isMaxLevel }) => {
      lvEl.textContent = `Lv.${level}`;
      expFill.style.transform = `scaleX(${isMaxLevel ? 1 : exp / expToNext})`;
      expFill.parentElement.title = isMaxLevel ? '최대 레벨' : `경험치 ${exp} / ${expToNext}`;
    });
    on('player:gold', ({ gold }) => (goldEl.textContent = `${gold.toLocaleString()} G`));

    // 오른쪽 위: 섬·네트워크·버튼
    const islandEl = h('div', { style: 'font-weight:800' });
    const netEl = h('div', { class: 'dv-net' });
    const saveEl = h('div', { class: 'dv-net' });
    const camBtn = h('button', { class: 'ghost', title: '카메라 전환 (V)', onclick: () => game.cameraRig.toggleMode(game.player ? game.player.yaw : null) }, '시점');
    hud.append(
      h(
        'div',
        { class: 'dv-panel dv-top' },
        islandEl,
        netEl,
        saveEl,
        h(
          'div',
          { class: 'dv-row' },
          camBtn,
          h('button', { class: 'ghost', title: '가방 (I)', onclick: () => this.toggleInventory() }, '가방'),
          h('button', { class: 'ghost', title: '도움말 (H)', onclick: () => this.toggleHelp() }, '도움말'),
          h('button', { class: 'ghost', onclick: () => this.logout() }, '로그아웃')
        )
      )
    );
    on('island:entered', ({ name }) => {
      islandEl.textContent = name;
      this.toast(name, true);
    });
    on('net:status', (st) => {
      const mode = st.mode === 'online' ? (st.connected ? '온라인' : '연결 중…') : '오프라인(탭)';
      netEl.textContent = `${mode} · 이 섬 ${st.players}명 · 접속 ${st.online}명${st.isHost ? ' · 호스트' : ''}`;
    });
    on('save:status', ({ state, at, error }) => {
      if (state === 'saving') saveEl.textContent = '저장 중…';
      else if (state === 'saved') saveEl.textContent = `저장됨 ${new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
      else saveEl.textContent = `저장 실패: ${error ?? ''}`;
    });
    on('camera:mode', ({ mode }) => this.toast(mode === 'third' ? '3인칭 시점' : '쿼터뷰 시점'));

    // 채팅
    const log = h('div', { class: 'dv-log' });
    const chatInput = h('input', { placeholder: 'Enter로 채팅', maxlength: '200', enterkeyhint: 'send' });
    this.chatInput = chatInput;
    chatInput.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        if (chatInput.value.trim()) {
          const res = game.net.sendChat(chatInput.value);
          if (res.ok) chatInput.value = '';
          else this.addChat({ system: true, text: res.reason });
        } else chatInput.blur();
      } else if (e.key === 'Escape') {
        chatInput.blur();
      }
      e.stopPropagation();
    });
    this.chatLog = log;
    hud.append(h('div', { class: 'dv-panel dv-chat' }, log, chatInput));
    on('chat:message', (m) => this.addChat(m));

    // 스킬바 (PC)
    const skillBar = h('div', { class: 'dv-panel dv-skills' });
    hud.append(skillBar);
    const renderSkills = ({ slots }) => {
      skillBar.textContent = '';
      this.skillEls = slots.map((s, i) => {
        const cd = h('div', { class: 'cd' });
        const t = h('div', { class: 't' });
        const keys = i === 0 ? ['클릭', ...s.keys.map(keyLabel)] : s.keys.map(keyLabel);
        const elx = h(
          'div',
          { class: 'dv-skill', title: `${s.name}${s.description ? ` — ${s.description}` : ''}` },
          h('div', { class: 'k' }, keys.slice(0, 2).join('/')),
          h('div', { class: 'n' }, s.name),
          cd,
          t
        );
        elx.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          game.combat.useSlot(i);
        });
        skillBar.append(elx);
        return { cd, t };
      });
    };
    on('skills:changed', renderSkills);

    // 보스 체력
    const bossName = h('div', { style: 'font-weight:800; margin-bottom:4px' });
    const bossFill = h('i');
    const bossText = h('span');
    const boss = h('div', { class: 'dv-panel dv-boss' }, bossName, h('div', { class: 'dv-bar' }, bossFill, bossText));
    hud.append(boss);
    on('boss:hp', (info) => {
      boss.style.display = info ? 'block' : 'none';
      if (!info) return;
      bossName.textContent = info.name;
      bossFill.style.transform = `scaleX(${info.hp / info.maxHp})`;
      bossText.textContent = `${info.hp} / ${info.maxHp}`;
    });

    // 알림
    this.toasts = h('div', { class: 'dv-toasts' });
    hud.append(this.toasts);
    on('loot', ({ name, count }) => this.toast(`${name} +${count}`));
    on('player:levelUp', ({ level }) => this.toast(`레벨 업! Lv.${level}`, true));
    on('island:unlocked', ({ name }) => this.toast(`새 섬 해금: ${name}`, true));
    on('portal:locked', ({ name }) => this.toast(`${name}은(는) 아직 잠겨 있어요 (보스를 잡으면 열려요)`));
    on('session:duplicate', () => this.toast('같은 캐릭터가 다른 창에서 접속 중이에요'));

    // 사망
    const death = h('div', { class: 'dv-death' });
    hud.append(death);
    let deathTimer = null;
    on('player:died', ({ respawnSec, sourceName }) => {
      death.style.display = 'flex';
      let left = respawnSec;
      const draw = () => (death.textContent = `${sourceName ? `${sourceName}에게 ` : ''}쓰러졌습니다… ${Math.ceil(left)}초 후 부활`);
      draw();
      clearInterval(deathTimer);
      deathTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) clearInterval(deathTimer);
        else draw();
      }, 1000);
    });
    on('player:respawned', () => {
      death.style.display = 'none';
      clearInterval(deathTimer);
    });

    // NPC
    const hint = h('div', { class: 'dv-panel dv-hint' });
    hud.append(hint);
    on('interact:changed', ({ npc }) => {
      hint.style.display = npc && !this.isTouch ? 'block' : 'none';
      if (npc) hint.textContent = `F: ${npc.name}와 대화`;
      if (!npc && this.npcBox) this.npcBox.remove();
    });
    on('npc:interact', ({ name }) => {
      if (this.npcBox) this.npcBox.remove();
      this.npcBox = h(
        'div',
        { class: 'dv-panel dv-npc' },
        h('div', { style: 'font-weight:800; color:#fde68a; margin-bottom:6px' }, name),
        h('div', { style: 'color:#e2e8f0' }, '(대화·퀘스트는 B가 npc:interact 이벤트에 연결할 자리입니다)'),
        h('div', { class: 'dv-row', style: 'justify-content:flex-end; margin-top:8px' }, h('button', { onclick: () => this.npcBox.remove() }, '닫기'))
      );
      hud.append(this.npcBox);
    });

    // 인벤토리 다시 그리기
    on('inventory:changed', () => this.modal && this.modal.kind === 'inv' && this.renderInventory());
    on('equipment:changed', () => this.modal && this.modal.kind === 'inv' && this.renderInventory());
    on('player:stats', () => this.modal && this.modal.kind === 'inv' && this.renderInventory());

    this.addChat({ system: true, text: '도움말은 H 키 (또는 오른쪽 위 "도움말")' });
    this._tick();
  }

  _tick() {
    if (!this.hud) return;
    if (this.skillEls && this.game.inWorld) {
      const slots = this.game.combat.getSlots();
      slots.forEach((s, i) => {
        const el = this.skillEls[i];
        if (!el) return;
        const r = s.cooldownTotal > 0 ? s.cooldown / s.cooldownTotal : 0;
        el.cd.style.setProperty('--cd', r.toFixed(3));
        el.t.textContent = s.cooldown > 0.05 && s.cooldownTotal >= 1 ? s.cooldown.toFixed(1) : '';
      });
    }
    requestAnimationFrame(() => this._tick());
  }

  _destroyHud() {
    for (const off of this._offs) off();
    this._offs = [];
    if (this.hud) this.hud.remove();
    this.hud = null;
    this.closeModal();
  }

  addChat(m) {
    if (!this.chatLog) return;
    const line = m.system
      ? h('div', { class: 'sys' }, `· ${m.text}`)
      : h('div', { class: m.self ? 'me' : '' }, h('b', {}, m.name), ': ', m.text);
    this.chatLog.append(line);
    while (this.chatLog.childElementCount > 60) this.chatLog.firstChild.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  toast(text, big = false) {
    if (!this.toasts) return;
    const t = h('div', { class: `dv-toast${big ? ' big' : ''}` }, text);
    this.toasts.append(t);
    setTimeout(() => t.remove(), 2700);
  }

  // ---------- 창

  closeModal() {
    if (this.modal) this.modal.el.remove();
    this.modal = null;
  }

  openModal(kind, content) {
    this.closeModal();
    const el = h('div', { class: 'dv-modal' }, content);
    el.addEventListener('pointerdown', (e) => {
      if (e.target === el) this.closeModal();
    });
    this.root.append(el);
    this.modal = { kind, el };
  }

  toggleInventory() {
    if (this.modal && this.modal.kind === 'inv') this.closeModal();
    else this.renderInventory();
  }

  renderInventory() {
    const game = this.game;
    const ch = game.character;
    if (!ch) return;
    const data = game.data;
    const st = ch.stats;
    const equipCards = EQUIP_SLOTS.map((slot) => {
      const id = ch.equipment[slot];
      const item = id ? data.getItem(id) : null;
      return h(
        'div',
        { class: 'dv-item' },
        h('div', { class: 'ds' }, SLOT_NAMES[slot] ?? slot),
        h('div', { class: 'nm' }, item ? item.name : '—'),
        item ? h('button', { onclick: () => ch.unequip(slot) }, '빼기') : null
      );
    });
    const itemCards = ch.inventory.map(({ itemId, count }) => {
      const item = data.getItem(itemId);
      const statText = Object.entries(item.stats)
        .map(([k, v]) => `${k} +${v}`)
        .join(', ');
      return h(
        'div',
        { class: 'dv-item' },
        h('div', { class: 'nm' }, `${item.name} ×${count}`),
        item.description ? h('div', { class: 'ds' }, item.description) : null,
        statText ? h('div', { class: 'ds' }, statText) : null,
        item.slot
          ? h(
              'button',
              {
                onclick: () => {
                  const r = ch.equip(itemId);
                  if (!r.ok) this.toast(r.reason);
                },
              },
              '장착'
            )
          : null,
        item.effect
          ? h(
              'button',
              {
                onclick: () => {
                  const r = game.useItem(itemId);
                  if (!r.ok) this.toast(r.reason);
                },
              },
              '사용'
            )
          : null
      );
    });
    const devTools = [];
    if (import.meta.env.DEV) {
      const sel = h('select', {}, [...data.items.values()].map((it) => h('option', { value: it.id }, `${it.name} (${it.id})`)));
      devTools.push(
        h('div', { class: 'ds', style: 'margin-top:4px; color:#94a3b8' }, '개발용 (npm run dev에서만 보임)'),
        h(
          'div',
          { class: 'dv-row' },
          h('div', { style: 'flex:1; min-width:180px' }, sel),
          h('button', { onclick: () => ch.addItem(sel.value, 1) }, '아이템 받기'),
          h('button', { onclick: () => ch.addExp(ch.expToNext - ch.exp) }, '레벨 업'),
          h('button', { onclick: () => game.save.saveNow('manual') }, '지금 저장')
        )
      );
    }
    const card = h(
      'div',
      { class: 'dv-panel dv-inv' },
      h('h3', {}, '가방', h('button', { class: 'ghost', onclick: () => this.closeModal() }, '닫기')),
      h(
        'div',
        { class: 'dv-stats' },
        `공격 ${Math.round(st.attack)}`,
        `방어 ${Math.round(st.defense)}`,
        `최대 HP ${st.maxHp}`,
        `이동 ${st.moveSpeed.toFixed(1)}`,
        `치명 ${Math.round(st.critRate * 100)}%`
      ),
      h('div', { class: 'ds', style: 'font-weight:700' }, '장비'),
      h('div', { class: 'dv-grid' }, equipCards),
      h('div', { class: 'ds', style: 'font-weight:700' }, `가방 (${ch.inventory.length})`),
      itemCards.length ? h('div', { class: 'dv-grid' }, itemCards) : h('div', { class: 'ds' }, '비어 있어요'),
      devTools
    );
    this.openModal('inv', card);
  }

  toggleHelp() {
    if (this.modal && this.modal.kind === 'help') {
      this.closeModal();
      return;
    }
    const rows = [
      ['WASD / 방향키', '이동'],
      ['마우스 왼쪽 / J', '평타 (누르고 있으면 연속)'],
      ['Q E R / 1 2 3', '스킬'],
      ['Space', '점프 (보스 충격파는 점프로 피할 수 있어요)'],
      ['마우스 오른쪽 드래그', '카메라 돌리기'],
      ['휠', '줌'],
      ['V', '쿼터뷰 ↔ 3인칭'],
      ['F', 'NPC와 대화'],
      ['I', '가방'],
      ['Enter', '채팅'],
      ['폰·태블릿', '왼쪽 아래 끌어서 이동, 오른쪽 버튼으로 공격, 빈 곳 드래그로 카메라'],
    ];
    const card = h(
      'div',
      { class: 'dv-panel dv-help' },
      h('h3', { style: 'margin:0 0 8px' }, '조작법'),
      h('table', {}, rows.map(([k, v]) => h('tr', {}, h('td', {}, k), h('td', {}, v)))),
      h('div', { class: 'ds', style: 'margin-top:10px; font-size:12px; color:#94a3b8' }, '빨간 장판이 차오르면 몬스터 공격이 들어옵니다. 장판 밖으로 피하세요.'),
      h('div', { class: 'dv-row', style: 'justify-content:flex-end; margin-top:10px' }, h('button', { onclick: () => this.closeModal() }, '닫기'))
    );
    this.openModal('help', card);
  }

  async logout() {
    this.closeModal();
    await this.game.session.signOut();
    this.showLogin();
  }

  _onKey(e) {
    if (!this.hud || e.isComposing) return;
    const typing = this.game.input.isTyping();
    if (e.key === 'Enter' && !typing && this.chatInput) {
      e.preventDefault();
      this.chatInput.focus();
      return;
    }
    if (typing) return;
    if (e.code === 'KeyI') this.toggleInventory();
    else if (e.code === 'KeyH') this.toggleHelp();
    else if (e.key === 'Escape') this.closeModal();
  }
}

export function mountDevUI(game) {
  return new DevUI(game);
}
