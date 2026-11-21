// 섬마다 "호스트" 한 명을 정한다. 호스트가 그 섬의 몬스터 AI를 돌린다.
// 규칙: 자리를 비우지 않은(away가 아닌) 사람 중 가장 먼저 들어온 사람. 모두가 같은 목록으로 계산하므로 결과가 같다.

/**
 * @param {Array<{nid:string, at:number, away?:boolean}>} members
 * @returns {string|null}
 */
export function electHost(members) {
  if (!members.length) return null;
  const active = members.filter((m) => !m.away);
  const pool = (active.length ? active : members).slice();
  pool.sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || (a.nid < b.nid ? -1 : a.nid > b.nid ? 1 : 0));
  return pool[0].nid;
}

/**
 * 인원에 맞춘 전송 간격(ms). 받는 쪽도 메시지로 세므로 대략 인원² 에 비례해 늘린다.
 */
export function sendIntervalMs(memberCount, budgetPerSec, minMs, maxMs) {
  const n = Math.max(1, memberCount);
  const ms = (1000 * n * n) / Math.max(1, budgetPerSec);
  return Math.min(maxMs, Math.max(minMs, Math.round(ms)));
}
