# 하늘섬 연대기

2인 장기 운영 웹 MMO. 상세 기획은 docs/design.md.

## 기술
Vite + Three.js, 서버는 Supabase(로그인·DB·Realtime). 순수 JS(TypeScript 안 씀).

## 담당 구분 (다른 사람 폴더는 수정 금지)
- A (엔진·시스템): src/engine/ — 조작, 카메라, 전투 판정, 멀티 동기화, 저장
- B (콘텐츠·UI): data/, src/ui/ — 몬스터, 아이템, 스킬, 퀘스트, 섬 데이터, HUD
- 공통 파일(src/main.js, package.json, CLAUDE.md)은 변경 전에 상대에게 말한다.
- 역할(누가 A인지 B인지)은 아직 미정. 정해지면 아래 작업 로그에 적는다.

## 규칙
- 콘텐츠(몬스터·아이템·스킬·섬)는 코드에 하드코딩하지 말고 data/*.json에 둔다.
- JSON 필드 이름은 영어 camelCase, 화면에 보이는 글은 한국어.
- 새 라이브러리는 추가하기 전에 사용자에게 먼저 묻는다.
- 비밀키(.env)는 절대 커밋하지 않는다. Supabase service_role 키는 코드에 쓰지 않는다.
- 브랜치: a/기능명, b/기능명. main에는 PR로만 합친다.
- 커밋 메시지는 한국어로 짧게 (예: "전투: 평타 판정 추가").
- 작업을 끝내면 이 파일의 "작업 로그"에 한 줄 추가한다.

## 실행
- 설치: npm install
- 개발 서버: npm run dev
- 빌드: npm run build

## v0.1 범위
허브 마을 1, 사냥 섬 1, 직업 1·스킬 3, 일반 몬스터 3, 보스 1,
레벨업·장비, 로그인·저장, 다른 플레이어 표시·채팅.
이 밖의 것(PvP, 하우징, 펫, 시즌, 레이드)은 v0.2 이후.

## 작업 로그 (최신이 위)
- 2026-11-21: [B] v0.1 콘텐츠 — 직업 바람검사(스킬 질풍베기·회오리베기·하늘 가르기), 몬스터 이슬 슬라임·깡총버섯·바람 멧돼지·보스 이끼 골렘, 아이템 14종, 레벨 1~10, 섬 바람개비 마을·산들 초원섬 배치. B 전용 data/npcs.json·data/quests.json 추가(엔진은 읽지 않음, game.data.raw로 접근)
- 2026-11-18: [A] 엔진 v0.1 — 조작(키보드·마우스·터치), 쿼터뷰/3인칭 카메라, 전투 판정·몬스터 AI, 멀티 동기화(호스트 방식)·채팅, 로그인·자동 저장(Supabase/오프라인), 임시 화면(src/engine/dev, main.js의 devUI로 끔), DB SQL(supabase/migrations). @supabase/supabase-js 추가, main.js 교체. 사용법은 src/engine/README.md
- 2026-11-18: 역할 확정 — A(엔진·시스템) = yunny
- 2026-11-18: 프로젝트 뼈대 생성 (Vite + Three.js 빈 장면, data 샘플 JSON)
