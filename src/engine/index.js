// 엔진 입구. main.js에서 startGame(컨테이너)을 부르면 된다.
//   devUI: true  → 엔진 확인용 임시 화면(src/engine/dev/)을 함께 띄운다
//   devUI: false → 화면은 UI(B, src/ui/)가 game API로 만든다
// 개발 서버에서는 브라우저 콘솔에서 window.skyIsland 로 게임 객체를 볼 수 있다.

import { Game } from './core/game.js';

export { Game };

export async function startGame(container, { devUI = true } = {}) {
  const game = new Game(container);
  if (import.meta.env.DEV) window.skyIsland = game;
  await game.session.init();
  if (devUI) {
    const { mountDevUI } = await import('./dev/devUI.js');
    mountDevUI(game);
  }
  return game;
}
