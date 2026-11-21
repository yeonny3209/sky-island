-- 하늘섬 연대기: 캐릭터 저장 테이블 (v0.1: 계정 1개당 캐릭터 1개)
-- 실행 방법: Supabase 대시보드 → SQL Editor에 이 파일 내용을 붙여 넣고 Run.
--            (supabase CLI를 쓰면 supabase db push)
-- 엔진 코드: src/engine/save/session.js

create table if not exists public.characters (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (name ~ '^[가-힣A-Za-z0-9_-]{2,12}$'),
  class_id   text not null default 'warrior',
  level      integer not null default 1 check (level >= 1),
  exp        integer not null default 0 check (exp >= 0),
  gold       integer not null default 0 check (gold >= 0),
  data       jsonb not null default '{}'::jsonb, -- 위치·인벤토리·장비·해금한 섬·퀘스트 (엔진의 Character.toSave() 참고)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 캐릭터 이름은 겹칠 수 없다 (영문 대소문자 구분 없이)
create unique index if not exists characters_name_lower_key on public.characters (lower(name));

-- 저장할 때마다 updated_at 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists characters_set_updated_at on public.characters;
create trigger characters_set_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

-- 행 단위 보안(RLS): 로그인한 사람은 자기 캐릭터만 읽고, 만들고, 저장할 수 있다.
-- 지우기 정책은 일부러 만들지 않았다 (계정을 지우면 on delete cascade로 같이 지워진다).
alter table public.characters enable row level security;

drop policy if exists "본인 캐릭터 읽기" on public.characters;
create policy "본인 캐릭터 읽기" on public.characters
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "본인 캐릭터 만들기" on public.characters;
create policy "본인 캐릭터 만들기" on public.characters
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "본인 캐릭터 저장" on public.characters;
create policy "본인 캐릭터 저장" on public.characters
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
