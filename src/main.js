import { startGame } from './engine/index.js';
import { mountUI } from './ui/index.js';

// 게임 시작. 엔진(src/engine/, A)이 장면·조작·전투·멀티·저장을, 화면(src/ui/, B)이 로그인·HUD·가방·대화·퀘스트를 맡는다.
// 엔진 확인용 임시 화면이 필요하면 devUI: true로 바꾸고 mountUI 줄을 지운다.
startGame(document.getElementById('app'), { devUI: false })
  .then((game) => mountUI(game))
  .catch((err) => {
    console.error('[시작 실패]', err);
  });
