import { startGame } from './engine/index.js';

// 게임 시작. 엔진(src/engine/)이 장면·조작·전투·멀티·저장을 맡는다.
// devUI: true → 엔진 확인용 임시 화면(로그인·HUD·채팅). B의 UI(src/ui/)가 준비되면 false로 바꾸고 UI에서 game API를 쓴다.
startGame(document.getElementById('app'), { devUI: true }).catch((err) => {
  console.error('[시작 실패]', err);
});
