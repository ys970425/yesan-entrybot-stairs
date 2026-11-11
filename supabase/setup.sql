-- ============================================================
-- 예산과 함께하는 엔트리봇 무한의 계단 — 순위표 설정
-- Supabase 대시보드 → SQL Editor → 이 내용 전체를 붙여 넣고 Run
-- 맨 아래 '관리자 비밀번호' 줄의 'CHANGE-ME' 를 원하는 비밀번호로 바꾼 뒤 실행하세요.
-- (여러 번 실행해도 안전합니다. 비밀번호를 바꿀 때도 다시 실행하면 됩니다.)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) 기록 (닉네임 + 계단 수)
create table if not exists public.stairs_scores (
  id bigint generated always as identity primary key,
  nickname text not null check (char_length(nickname) between 1 and 8),
  score int not null check (score between 1 and 5000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- 2) 1~3등 학생 정보 (학교·학년·이름) — 관리자만 보고 쓸 수 있음
create table if not exists public.stairs_winners (
  score_id bigint primary key references public.stairs_scores(id) on delete cascade,
  school text,
  grade text,
  name text,
  updated_at timestamptz not null default now()
);

-- 3) 관리자 비밀번호 (암호화해서 저장)
create table if not exists public.stairs_admin (
  id int primary key default 1 check (id = 1),
  pin_hash text not null
);

-- 공개 키로는 세 표를 직접 읽거나 쓸 수 없게 잠그고, 아래 함수로만 접근
alter table public.stairs_scores enable row level security;
alter table public.stairs_winners enable row level security;
alter table public.stairs_admin enable row level security;
revoke all on public.stairs_scores, public.stairs_winners, public.stairs_admin from anon, authenticated;

-- ------------------------------------------------------------
-- 내부용: 닉네임별 최고 기록으로 순위 매기기 (같은 기록이면 먼저 세운 사람이 위)
-- ------------------------------------------------------------
create or replace function public.stairs_ranked()
returns table(rank bigint, id bigint, nickname text, score int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by b.score desc, b.created_at asc) as rank,
         b.id, b.nickname, b.score, b.created_at
  from (
    select distinct on (s.nickname) s.id, s.nickname, s.score, s.created_at
    from stairs_scores s
    where not s.hidden
    order by s.nickname, s.score desc, s.created_at asc
  ) b
$$;

-- 내부용: 3등 밖으로 밀려난 학생의 개인정보 자동 삭제
create or replace function public.stairs_cleanup()
returns void
language sql security definer set search_path = public as $$
  delete from stairs_winners w
  where w.score_id not in (select r.id from stairs_ranked() r where r.rank <= 3);
$$;

-- 내부용: 비밀번호 확인
create or replace function public.stairs_check_pin(p_pin text)
returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from stairs_admin a
    where a.id = 1 and a.pin_hash = extensions.crypt(coalesce(p_pin, ''), a.pin_hash)
  )
$$;

revoke execute on function public.stairs_ranked() from public, anon, authenticated;
revoke execute on function public.stairs_cleanup() from public, anon, authenticated;
revoke execute on function public.stairs_check_pin(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 게임: 기록 보내기 → 이 기록의 순위를 돌려줌 (닉네임 최고기록이 아니면 null)
-- ------------------------------------------------------------
create or replace function public.stairs_submit(p_nick text, p_score int)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
  r bigint;
begin
  p_nick := btrim(coalesce(p_nick, ''));
  if char_length(p_nick) < 1 or char_length(p_nick) > 8 then
    raise exception 'bad nickname';
  end if;
  if p_score is null or p_score < 1 or p_score > 5000 then
    return null;
  end if;
  insert into stairs_scores (nickname, score) values (p_nick, p_score) returning id into new_id;
  perform stairs_cleanup();
  select x.rank into r from stairs_ranked() x where x.id = new_id;
  return r;
end
$$;

-- TV 순위표: 1~N등 (닉네임, 계단 수만 공개)
create or replace function public.stairs_board(lim int default 10)
returns table(rank bigint, nickname text, score int)
language sql stable security definer set search_path = public as $$
  select r.rank, r.nickname, r.score
  from stairs_ranked() r
  where r.rank <= least(greatest(coalesce(lim, 10), 1), 50)
  order by r.rank
$$;

-- ------------------------------------------------------------
-- 관리자 (비밀번호 필요)
-- ------------------------------------------------------------
create or replace function public.stairs_admin_list(p_pin text)
returns table(rank bigint, id bigint, nickname text, score int, created_at timestamptz,
              school text, grade text, name text, hidden boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not stairs_check_pin(p_pin) then raise exception 'wrong pin'; end if;
  return query
    select r.rank, r.id, r.nickname, r.score, r.created_at, w.school, w.grade, w.name, false
    from stairs_ranked() r
    left join stairs_winners w on w.score_id = r.id
    where r.rank <= 50
    order by r.rank;
  return query
    select null::bigint, s.id, s.nickname, max(s.score) over (partition by s.nickname), s.created_at,
           null::text, null::text, null::text, true
    from stairs_scores s
    where s.hidden
      and s.id in (select min(h.id) from stairs_scores h where h.hidden group by h.nickname);
end
$$;

-- 1~3등 학생 정보 저장 (3등 밖이면 거절)
create or replace function public.stairs_admin_set_info(p_pin text, p_id bigint, p_school text, p_grade text, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not stairs_check_pin(p_pin) then raise exception 'wrong pin'; end if;
  if not exists (select 1 from stairs_ranked() r where r.id = p_id and r.rank <= 3) then
    raise exception 'not top 3';
  end if;
  insert into stairs_winners (score_id, school, grade, name, updated_at)
  values (p_id, nullif(btrim(p_school), ''), nullif(btrim(p_grade), ''), nullif(btrim(p_name), ''), now())
  on conflict (score_id) do update
    set school = excluded.school, grade = excluded.grade, name = excluded.name, updated_at = now();
end
$$;

-- 닉네임 숨기기/다시 보이기 (그 닉네임의 모든 기록)
create or replace function public.stairs_admin_hide(p_pin text, p_id bigint, p_hide boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not stairs_check_pin(p_pin) then raise exception 'wrong pin'; end if;
  update stairs_scores set hidden = coalesce(p_hide, true)
  where nickname = (select s.nickname from stairs_scores s where s.id = p_id);
  perform stairs_cleanup();
end
$$;

-- 행사 끝: 모든 기록과 개인정보 삭제
create or replace function public.stairs_admin_clear_all(p_pin text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not stairs_check_pin(p_pin) then raise exception 'wrong pin'; end if;
  delete from stairs_winners where score_id > 0;
  delete from stairs_scores where id > 0;
end
$$;

grant execute on function public.stairs_submit(text, int) to anon, authenticated;
grant execute on function public.stairs_board(int) to anon, authenticated;
grant execute on function public.stairs_admin_list(text) to anon, authenticated;
grant execute on function public.stairs_admin_set_info(text, bigint, text, text, text) to anon, authenticated;
grant execute on function public.stairs_admin_hide(text, bigint, boolean) to anon, authenticated;
grant execute on function public.stairs_admin_clear_all(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 관리자 비밀번호: 'CHANGE-ME' 를 바꾸세요 (8자 이상 권장)
-- ------------------------------------------------------------
insert into public.stairs_admin (id, pin_hash)
values (1, extensions.crypt('CHANGE-ME', extensions.gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;
