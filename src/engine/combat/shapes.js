// 공격 판정 도형 (XZ 평면). 플레이어 스킬과 몬스터 공격이 같은 함수를 쓴다.
//   arc    : 부채꼴. range(반지름), angleDeg(펼친 각도)
//   circle : 원. range(반지름), 시전자 중심
//   line   : 직사각형 돌진/찌르기. range(길이), width(폭)
// 대상의 몸 반지름(targetRadius)만큼 판정을 넉넉하게 본다.

export function hitTest(shape, ox, oz, yaw, params, tx, tz, targetRadius = 0) {
  const dx = tx - ox;
  const dz = tz - oz;
  const dist = Math.hypot(dx, dz);
  const range = params.range ?? 2;

  if (shape === 'circle') {
    return dist <= range + targetRadius;
  }

  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);

  if (shape === 'line') {
    const forward = dx * fx + dz * fz;
    const lateral = Math.abs(dx * fz - dz * fx);
    const halfW = (params.width ?? 1.2) / 2;
    return forward >= -targetRadius && forward <= range + targetRadius && lateral <= halfW + targetRadius;
  }

  // arc
  if (dist > range + targetRadius) return false;
  if (dist <= targetRadius + 0.35) return true; // 몸이 겹칠 만큼 붙어 있으면 맞은 것으로 본다
  const halfAngle = ((params.angleDeg ?? 100) * Math.PI) / 360;
  if (halfAngle >= Math.PI) return true;
  const cos = (dx * fx + dz * fz) / dist;
  const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
  const slack = Math.asin(Math.min(1, targetRadius / dist));
  return angle <= halfAngle + slack;
}

/** 몬스터 공격 패턴 → hitTest에 넣을 도형/값 */
export function patternShape(pattern, monsterRadius) {
  if (pattern.type === 'slam') return { shape: 'circle', params: { range: pattern.radius } };
  if (pattern.type === 'charge') return { shape: 'line', params: { range: pattern.length, width: pattern.width } };
  return { shape: 'arc', params: { range: monsterRadius + pattern.reach, angleDeg: pattern.angleDeg } };
}
