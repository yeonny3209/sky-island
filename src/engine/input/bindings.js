// 키 설정. e.code(자판 위치)를 쓰므로 한글 입력 상태에서도 그대로 동작한다.
// 마우스 왼쪽 = 평타, 오른쪽 드래그 = 카메라 회전, 휠 = 줌 (input.js에서 처리)

export const DEFAULT_BINDINGS = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'],
  skill1: ['KeyQ', 'Digit1'],
  skill2: ['KeyE', 'Digit2'],
  skill3: ['KeyR', 'Digit3'],
  jump: ['Space'],
  interact: ['KeyF'],
  toggleCamera: ['KeyV'],
};

/** 스킬 슬롯 번호 → 액션 이름 (0 = 평타) */
export const SLOT_ACTIONS = ['attack', 'skill1', 'skill2', 'skill3'];

const SPECIAL = { Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

/** 'KeyQ' → 'Q', 'Digit1' → '1' (화면 표시용) */
export function keyLabel(code) {
  if (SPECIAL[code]) return SPECIAL[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}
