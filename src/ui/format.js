// 화면에 보이는 이름표와 숫자 형식
export const STAT_LABEL = { maxHp: '최대 체력', attack: '공격력', defense: '방어력', critRate: '치명타 확률', critDamage: '치명타 피해', moveSpeed: '이동 속도' };
export const RARITY_LABEL = { common: '일반', uncommon: '고급', rare: '희귀', epic: '영웅' };
export const SLOT_LABEL = { weapon: '무기', armor: '갑옷', helmet: '투구', boots: '신발', accessory: '장신구' };
export const TYPE_LABEL = { equipment: '장비', consumable: '소모품', material: '재료' };

export function formatStat(key, value, { sign = false } = {}) {
  const prefix = sign && value > 0 ? '+' : '';
  if (key === 'critRate') return `${prefix}${Math.round(value * 1000) / 10}%`;
  return `${prefix}${Math.round(value * 100) / 100}`;
}

export function formatNumber(n) {
  return Math.floor(n).toLocaleString('ko-KR');
}

/** 재사용 대기 남은 시간 표시: 10초 이상은 정수, 그 아래는 소수 한 자리 */
export function formatSeconds(sec) {
  return sec >= 10 ? String(Math.ceil(sec)) : sec.toFixed(1);
}
