// 도움말 창: 조작법
import { h } from '../dom.js';
import { createWindowFrame } from './frame.js';

const ROWS = [
  ['WASD / 방향키', '이동'],
  ['마우스 왼쪽 / J', '기본 공격 (누르고 있으면 연속)'],
  ['Q E R / 1 2 3', '스킬'],
  ['4', '물약 (가방에 가장 많은 회복 아이템)'],
  ['Space', '점프 (보스의 충격파는 점프로 피할 수 있어요)'],
  ['F', 'NPC와 대화'],
  ['V', '쿼터뷰 ↔ 3인칭'],
  ['마우스 오른쪽 드래그 · 휠', '카메라 돌리기 · 줌'],
  ['I', '가방'],
  ['Enter', '채팅'],
  ['폰·태블릿', '왼쪽 아래를 끌어서 이동, 오른쪽 버튼으로 공격·스킬'],
];

export function createHelpWindow() {
  let isOpen = false;
  const frame = createWindowFrame({ title: '조작법', className: 'si-help', onClose: () => close() });
  frame.body.append(
    h('table', { class: 'si-help__table' }, ROWS.map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, v)))),
    h('p', { class: 'si-help__tip' }, '바닥에 붉은 장판이 차오르면 몬스터의 공격이 들어와요. 장판 밖으로 피하세요.'));

  function open() {
    isOpen = true;
    frame.el.hidden = false;
  }
  function close() {
    isOpen = false;
    frame.el.hidden = true;
  }
  return { el: frame.el, open, close, toggle: () => (isOpen ? close() : open()), isOpen: () => isOpen };
}
