// 피해량 공식. 숫자를 바꾸고 싶으면 config.js의 combat.defenseK / damageVariance를 조정한다.
//   피해 = 공격력 × 배율 × (1 ± 흔들림) × (치명타면 치명 배율) × K / (K + 방어력),  최소 1

import { CONFIG } from '../config.js';

export function computeDamage({
  attack,
  multiplier = 1,
  defense = 0,
  critRate = 0,
  critDamage = 1.5,
  rng = Math.random,
  variance = CONFIG.combat.damageVariance,
  defenseK = CONFIG.combat.defenseK,
}) {
  const roll = 1 + (rng() * 2 - 1) * variance;
  const crit = rng() < critRate;
  const raw = attack * multiplier * roll * (crit ? critDamage : 1);
  const reduced = raw * (defenseK / (defenseK + Math.max(0, defense)));
  return { damage: Math.max(1, Math.round(reduced)), crit };
}
