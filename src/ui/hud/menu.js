// 오른쪽 위: 채팅(터치)·시점·가방·도움말·로그아웃 버튼, 지금 있는 섬, 접속·저장 상태
import { h } from '../dom.js';
import { glyph } from '../icons.js';

const ISLAND_TYPE_LABEL = { hub: '마을', hunting: '사냥터', boss: '보스 섬' };

export function createMenu(ctx) {
  const button = (icon, label, hint, onClick, extraClass = '') => {
    const badge = h('span', { class: 'si-menu__badge', hidden: true });
    const btn = h('button', { class: `si-menu__btn si-interactive ${extraClass}`, type: 'button', 'aria-label': label, title: hint ? `${label} (${hint})` : label },
      glyph(icon), h('span', { class: 'si-menu__label' }, label), badge);
    btn.addEventListener('click', onClick);
    return { btn, badge };
  };

  const chat = button('chat', '채팅', null, () => ctx.chat.toggle(), 'si-menu__btn--chat');
  const camera = button('eye', '시점', 'V', () => ctx.game.cameraRig.toggleMode(ctx.game.player ? ctx.game.player.yaw : null));
  const bag = button('bag', '가방', 'I', () => ctx.toggleInventory());
  const help = button('scroll', '도움말', 'H', () => ctx.toggleHelp());
  const out = button('close', '나가기', null, () => ctx.logout());
  const locName = h('div', { class: 'si-location__name' });
  const locSub = h('div', { class: 'si-location__sub' });
  const status = h('div', { class: 'si-location__status' });
  const location = h('div', { class: 'si-location', hidden: true }, locName, locSub, status);
  const el = h('div', { class: 'si-menu' },
    h('div', { class: 'si-menu__buttons' }, chat.btn, camera.btn, bag.btn, help.btn, out.btn), location);

  let net = '';
  let save = '';
  const drawStatus = () => {
    status.textContent = [net, save].filter(Boolean).join(' · ');
  };

  return {
    el,
    setIsland(island) {
      location.hidden = false;
      locName.textContent = island.name;
      const range = Array.isArray(island.levelRange) ? `Lv.${island.levelRange[0]}~${island.levelRange[1]}` : '';
      locSub.textContent = [ISLAND_TYPE_LABEL[island.type] ?? '', range].filter(Boolean).join(' · ');
    },
    setNet(st) {
      const mode = st.mode === 'online' ? (st.connected ? '온라인' : '연결 중…') : '오프라인';
      net = `${mode} · 이 섬 ${st.players}명`;
      drawStatus();
    },
    setSave({ state, at }) {
      if (state === 'saving') save = '저장 중…';
      else if (state === 'saved') save = `저장됨 ${new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
      else save = '저장 실패';
      drawStatus();
    },
    setChatBadge(n) {
      chat.badge.hidden = n <= 0;
      chat.badge.textContent = n > 9 ? '9+' : String(n);
    },
  };
}
