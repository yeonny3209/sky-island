// 몬스터 처치 보상: 경험치·골드·드롭(각자 따로 굴림)·섬 해금.
// 최근에 그 몬스터를 때린 사람 모두가 자기 브라우저에서 받는다.

import { randInt } from '../core/mathUtils.js';

export function grantKillRewards(game, def) {
  const ch = game.character;
  const player = game.player;
  if (!ch || !player) return;
  const at = { x: player.pos.x, y: player.pos.y + 2.4, z: player.pos.z };

  if (def.exp > 0) {
    ch.addExp(def.exp);
    game.damageText.spawn(at, `+${def.exp} EXP`, 'exp');
  }
  if (def.gold) {
    const g = randInt(Math.random, Math.round(def.gold.min), Math.round(def.gold.max));
    if (g > 0) {
      ch.addGold(g);
      game.damageText.spawn({ ...at, y: at.y + 0.4 }, `+${g} G`, 'gold');
    }
  }
  for (const drop of def.drops) {
    if (Math.random() >= drop.chance) continue;
    const count = randInt(Math.random, drop.min, drop.max);
    if (ch.addItem(drop.itemId, count)) {
      const item = game.data.getItem(drop.itemId);
      game.events.emit('loot', { itemId: drop.itemId, name: item.name, count });
    }
  }

  const island = game.world.island;
  game.events.emit('monster:killed', { monsterId: def.id, islandId: island ? island.id : null, isBoss: def.isBoss });

  if (island && island.boss === def.id && island.unlocksIsland) {
    if (ch.unlockIsland(island.unlocksIsland)) {
      game.world.refreshPortals();
      const name = game.data.getIsland(island.unlocksIsland).name;
      game.events.emit('chat:message', { system: true, text: `새 섬이 열렸습니다: ${name}`, time: Date.now() });
    }
  }
}
