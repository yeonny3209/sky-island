// 엔진 동작 튜닝 값 모음.
// 콘텐츠 수치(몬스터·스킬·아이템·섬)는 data/*.json에 두고, 여기에는 엔진 자체의 동작 값만 둔다.

export const CONFIG = {
  render: {
    maxPixelRatio: 2,
    fov: 50,
    portraitMaxFov: 75, // 세로 화면에서 시야각을 넓힐 때의 상한
    near: 0.1,
    far: 600,
  },

  player: {
    radius: 0.45, // 충돌 반경
    accel: 45, // 가감속 정도
    turnSpeed: 16, // 몸 돌리는 속도
    gravity: 30,
    jumpSpeed: 10,
    castMoveFactor: 0.2, // 공격·스킬 시전 중 이동 속도 배율
    invulnSec: 0.4, // 맞은 뒤 잠깐 무적
    respawnSec: 3,
    fallLimitY: -30,
    edgeMargin: 0.6, // 섬 가장자리에서 이만큼 안쪽까지만 걸을 수 있다
  },

  camera: {
    defaultMode: 'quarter', // 'quarter'(쿼터뷰) | 'third'(3인칭)
    followLambda: 12,
    rotateSpeed: 0.006, // 마우스 드래그 1px당 회전(라디안)
    touchRotateSpeed: 0.009,
    quarter: { pitchDeg: 52, yawDeg: 0, distance: 18, minDistance: 10, maxDistance: 28, targetHeight: 0.8 },
    third: {
      pitchDeg: 16,
      distance: 7.5,
      minDistance: 3.5,
      maxDistance: 13,
      minPitchDeg: -8,
      maxPitchDeg: 65,
      targetHeight: 1.7,
    },
  },

  combat: {
    defenseK: 50, // 방어력 감소 공식: 피해 × K / (K + 방어력)
    damageVariance: 0.1, // 피해량 ±10% 흔들림
    aimAssistDeg: 45, // 방향을 정하고 칠 때 이 각도 안의 몬스터 쪽으로 살짝 돌려 준다
    aimAssistTouchDeg: 75,
    aimAssistIdleDeg: 180, // 서서 칠 때 앞쪽에 없으면 이 각도까지 넓혀 가장 가까운 몬스터를 찾는다 (180 = 모든 방향)
    aimAssistExtraRange: 1.5,
    contributionSec: 30, // 최근 이 시간 안에 때린 사람 모두 경험치·드롭을 받는다
    inputBufferSec: 0.25, // 시전 중에 누른 스킬을 이만큼 기억했다가 이어서 쓴다
    predictedDeathTimeoutSec: 1.5,
  },

  net: {
    // Supabase 무료 플랜 Realtime 한도는 프로젝트 전체 초당 100메시지(받는 쪽도 센다).
    // 한 섬에 N명이면 대략 N² 비율로 늘어나므로 인원에 맞춰 보내는 간격을 늘린다.
    // Pro 플랜이면 400 정도로 올려도 된다.
    budgetMsgsPerSec: 80,
    minSendIntervalMs: 100,
    maxSendIntervalMs: 1000,
    snapshotKeepaliveMs: 2000,
    presenceExpireMs: 10000, // 오프라인(탭끼리) 모드 전용
    chatMaxLength: 200,
    chatCooldownMs: 500,
  },

  save: {
    autosaveSec: 30,
    importantDebounceSec: 2, // 레벨업·아이템·장비 변경 후 이만큼 뒤에 저장
    retrySec: [5, 15, 30, 60],
  },

  world: {
    labelMaxDistance: 40,
    portalTriggerRadius: 1.3,
    interactRadius: 2.2,
  },
};
