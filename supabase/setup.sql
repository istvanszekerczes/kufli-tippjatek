-- ==========================================================================
-- setup.sql — full schema in one file (concatenation of migrations/*.sql).
-- Paste into the Supabase SQL editor and run, OR use `supabase db push`.
-- Run seed.sql afterwards for the demo tournament (skip it if you'll load
-- real fixtures with 'npm run sync').
-- ==========================================================================

-- >>> migrations/20260101000001_schema.sql
-- ============================================================================
-- 0001_schema.sql — core tables, enums, indexes
-- ============================================================================

-- gen_random_uuid() comes from pgcrypto (enabled by default on Supabase)
create extension if not exists pgcrypto;

-- ---- enums -----------------------------------------------------------------
do $$ begin
  create type public.match_stage as enum
    ('group', 'playoff', 'round_of_16', 'quarter_final', 'semi_final', 'final');
exception when duplicate_object then null; end $$;
-- Note: an earlier install without 'playoff' is upgraded by migration 0006.

do $$ begin
  create type public.match_status as enum ('upcoming', 'live', 'finished');
exception when duplicate_object then null; end $$;

-- ---- profiles ------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique check (char_length(username) between 2 and 24),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---- teams ----------------------------------------------------------------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  api_id      integer unique,
  name        text not null,
  short_name  text,
  crest_url   text,
  group_label text
);

-- ---- matches ------------------------------------------------------------
create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  api_id       integer unique,
  stage        public.match_stage not null,
  round        text,
  matchday     integer,
  home_team_id uuid references public.teams(id) on delete set null,
  away_team_id uuid references public.teams(id) on delete set null,
  kickoff_at   timestamptz not null,
  status       public.match_status not null default 'upcoming',
  home_score   integer check (home_score >= 0),
  away_score   integer check (away_score >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists matches_kickoff_idx on public.matches (kickoff_at);
create index if not exists matches_status_idx  on public.matches (status);
create index if not exists matches_stage_idx   on public.matches (stage);

-- ---- predictions -------------------------------------------------------
create table if not exists public.predictions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  match_id       uuid not null references public.matches(id) on delete cascade,
  home_score     integer not null check (home_score between 0 and 99),
  away_score     integer not null check (away_score between 0 and 99),
  points_awarded integer,
  scored_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, match_id)
);
create index if not exists predictions_match_idx on public.predictions (match_id);
create index if not exists predictions_user_idx  on public.predictions (user_id);

-- ---- outright winner picks ------------------------------------------------
create table if not exists public.outright_predictions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.profiles(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  points_awarded integer,
  scored_at      timestamptz,
  created_at     timestamptz not null default now()
);

-- ---- tournament config (single row, id = 1) -----------------------------
create table if not exists public.tournament_config (
  id                  integer primary key default 1 check (id = 1),
  outright_betting     boolean not null default true,
  outright_deadline    timestamptz,
  group_stage_betting  boolean not null default false,
  knockout_betting     boolean not null default false,
  champion_team_id     uuid references public.teams(id) on delete set null,
  updated_at           timestamptz not null default now()
);
insert into public.tournament_config (id) values (1) on conflict do nothing;

-- ---- updated_at helper -------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_matches on public.matches;
create trigger trg_touch_matches before update on public.matches
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_predictions on public.predictions;
create trigger trg_touch_predictions before update on public.predictions
  for each row execute function public.touch_updated_at();

-- >>> migrations/20260101000002_scoring.sql
-- ============================================================================
-- 0002_scoring.sql — scoring rules, automatic scoring triggers, helpers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- calc_points: the single source of truth for match scoring.
-- Rules are mutually exclusive; the highest matching rule applies.
--   5  exact score
--   3  correct winner + exact goal difference
--   2  correct winner + winning team's exact goal count
--   1  correct winner, or a correctly predicted draw
--   0  otherwise
-- ---------------------------------------------------------------------------
create or replace function public.calc_points(
  p_home int, p_away int, a_home int, a_away int
) returns int
language plpgsql immutable
as $$
declare
  pd int; ad int; pw int; aw int;
begin
  if p_home is null or p_away is null or a_home is null or a_away is null then
    return 0;
  end if;

  -- 5 — exact score
  if p_home = a_home and p_away = a_away then
    return 5;
  end if;

  pd := p_home - p_away;                       -- predicted goal difference
  ad := a_home - a_away;                       -- actual goal difference
  pw := case when pd > 0 then 1 when pd < 0 then -1 else 0 end;  -- predicted outcome
  aw := case when ad > 0 then 1 when ad < 0 then -1 else 0 end;  -- actual outcome

  -- wrong outcome -> nothing
  if pw <> aw then
    return 0;
  end if;

  -- correct draw (exact draw already handled by rule 5)
  if aw = 0 then
    return 1;
  end if;

  -- 3 — correct winner + exact goal difference
  if pd = ad then
    return 3;
  end if;

  -- 2 — correct winner + winning team's exact goal count
  if (aw = 1 and p_home = a_home) or (aw = -1 and p_away = a_away) then
    return 2;
  end if;

  -- 1 — correct winner only
  return 1;
end $$;

-- ---------------------------------------------------------------------------
-- Score every prediction for a match when it is finished (or a result is
-- corrected). Clears points if a finished match is reopened.
-- ---------------------------------------------------------------------------
create or replace function public.apply_match_scoring()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'finished'
     and new.home_score is not null and new.away_score is not null then

    if tg_op = 'INSERT'
       or old.status is distinct from 'finished'
       or old.home_score is distinct from new.home_score
       or old.away_score is distinct from new.away_score then

      update public.predictions p
      set points_awarded = public.calc_points(
            p.home_score, p.away_score, new.home_score, new.away_score),
          scored_at = now()
      where p.match_id = new.id;
    end if;

  elsif tg_op = 'UPDATE'
        and old.status = 'finished' and new.status <> 'finished' then
    update public.predictions p
    set points_awarded = null, scored_at = null
    where p.match_id = new.id;
  end if;

  return new;
end $$;

drop trigger if exists trg_apply_match_scoring on public.matches;
create trigger trg_apply_match_scoring
  after insert or update on public.matches
  for each row execute function public.apply_match_scoring();

-- ---------------------------------------------------------------------------
-- Outright winner scoring: 15 points to whoever picked the champion.
-- ---------------------------------------------------------------------------
create or replace function public.apply_outright_scoring()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.champion_team_id is distinct from old.champion_team_id then
    if new.champion_team_id is not null then
      update public.outright_predictions op
      set points_awarded = case when op.team_id = new.champion_team_id then 15 else 0 end,
          scored_at = now();
    else
      update public.outright_predictions
      set points_awarded = null, scored_at = null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_apply_outright_scoring on public.tournament_config;
create trigger trg_apply_outright_scoring
  after update on public.tournament_config
  for each row execute function public.apply_outright_scoring();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row for every new auth user. Guarantees a unique
-- username by appending a numeric suffix on collision.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  base  text := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''),
                         split_part(new.email, '@', 1));
  uname text := left(base, 24);
  n     int  := 0;
begin
  if char_length(uname) < 2 then
    uname := 'player';
  end if;
  while exists (select 1 from public.profiles where username = uname) loop
    n := n + 1;
    uname := left(base, 20) || n::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, uname);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Phase / lock helpers — used by Row Level Security AND the frontend.
-- ---------------------------------------------------------------------------
create or replace function public.is_match_open(m_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    m.status = 'upcoming'
    and m.kickoff_at > now()
    and case when m.stage = 'group'
             then c.group_stage_betting
             else c.knockout_betting end,
    false)
  from public.matches m
  cross join public.tournament_config c
  where m.id = m_id and c.id = 1;
$$;

create or replace function public.outright_is_open()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    outright_betting
    and champion_team_id is null
    and (outright_deadline is null or outright_deadline > now()),
    false)
  from public.tournament_config
  where id = 1;
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

-- Prevent privilege escalation: normal users cannot flip their own is_admin.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    new.is_admin   := old.is_admin;
    new.id         := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- >>> migrations/20260101000003_rls.sql
-- ============================================================================
-- 0003_rls.sql — Row Level Security
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.teams               enable row level security;
alter table public.matches             enable row level security;
alter table public.predictions         enable row level security;
alter table public.outright_predictions enable row level security;
alter table public.tournament_config   enable row level security;

-- ---- profiles ----------------------------------------------------------
drop policy if exists "profiles: read all"   on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: read all" on public.profiles
  for select to authenticated using (true);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---- teams (read-only for players; admins manage) --------------------
drop policy if exists "teams: read all"      on public.teams;
drop policy if exists "teams: admin manage"  on public.teams;

create policy "teams: read all" on public.teams
  for select to authenticated using (true);

create policy "teams: admin manage" on public.teams
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- matches (read-only for players; admins manage) -----------------
drop policy if exists "matches: read all"     on public.matches;
drop policy if exists "matches: admin manage" on public.matches;

create policy "matches: read all" on public.matches
  for select to authenticated using (true);

create policy "matches: admin manage" on public.matches
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- predictions -----------------------------------------------------
drop policy if exists "predictions: read own"   on public.predictions;
drop policy if exists "predictions: insert own" on public.predictions;
drop policy if exists "predictions: update own" on public.predictions;

create policy "predictions: read own" on public.predictions
  for select to authenticated using (auth.uid() = user_id);

create policy "predictions: insert own" on public.predictions
  for insert to authenticated
  with check (auth.uid() = user_id and public.is_match_open(match_id));

create policy "predictions: update own" on public.predictions
  for update to authenticated
  using (auth.uid() = user_id and public.is_match_open(match_id))
  with check (auth.uid() = user_id and public.is_match_open(match_id));

-- ---- outright predictions -----------------------------------------------
drop policy if exists "outright: read own"   on public.outright_predictions;
drop policy if exists "outright: insert own" on public.outright_predictions;
drop policy if exists "outright: update own" on public.outright_predictions;

create policy "outright: read own" on public.outright_predictions
  for select to authenticated using (auth.uid() = user_id);

create policy "outright: insert own" on public.outright_predictions
  for insert to authenticated
  with check (auth.uid() = user_id and public.outright_is_open());

create policy "outright: update own" on public.outright_predictions
  for update to authenticated
  using (auth.uid() = user_id and public.outright_is_open())
  with check (auth.uid() = user_id and public.outright_is_open());

-- ---- tournament config -------------------------------------------------
drop policy if exists "config: read all"     on public.tournament_config;
drop policy if exists "config: admin manage" on public.tournament_config;

create policy "config: read all" on public.tournament_config
  for select to authenticated using (true);

create policy "config: admin manage" on public.tournament_config
  for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ---- table privileges (RLS above is what actually restricts rows) ------
-- Supabase already sets these via default privileges; re-stating them makes
-- the schema self-contained if applied to a plain Postgres database.
grant usage on schema public to anon, authenticated;

grant select on
  public.profiles, public.teams, public.matches, public.tournament_config
  to anon, authenticated;

grant select, insert, update on public.predictions          to authenticated;
grant select, insert, update on public.outright_predictions  to authenticated;
grant update (username)                on public.profiles     to authenticated;

grant execute on function
  public.is_match_open(uuid), public.outright_is_open(), public.is_admin(uuid),
  public.calc_points(int, int, int, int)
  to anon, authenticated;

-- >>> migrations/20260101000004_views.sql
-- ============================================================================
-- 0004_views.sql — leaderboard
-- ============================================================================

-- security_invoker = off (the default): the view runs with the owner's rights
-- so it can aggregate every player's points, while RLS still hides individual
-- prediction rows from other users.
create or replace view public.leaderboard as
with pred as (
  select p.user_id,
         coalesce(sum(p.points_awarded), 0)::int                       as pts,
         count(p.points_awarded)::int                                  as scored,
         count(*) filter (where p.points_awarded = 5)::int             as exact_hits
  from public.predictions p
  group by p.user_id
),
outr as (
  select o.user_id, coalesce(sum(o.points_awarded), 0)::int as pts
  from public.outright_predictions o
  group by o.user_id
)
select
  pr.id                                                              as user_id,
  pr.username,
  (coalesce(pred.pts, 0) + coalesce(outr.pts, 0))                    as total_points,
  coalesce(pred.scored, 0)                                           as matches_scored,
  coalesce(pred.exact_hits, 0)                                       as exact_hits,
  rank() over (order by coalesce(pred.pts, 0) + coalesce(outr.pts, 0) desc)::int as rank
from public.profiles pr
left join pred on pred.user_id = pr.id
left join outr on outr.user_id = pr.id;

grant select on public.leaderboard to authenticated, anon;

-- >>> migrations/20260101000005_realtime.sql
-- ============================================================================
-- 0005_realtime.sql — publish row changes the frontend subscribes to
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['matches', 'predictions', 'outright_predictions', 'tournament_config']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- >>> migrations/20260101000006_playoff_stage.sql
-- ============================================================================
-- 0006_playoff_stage.sql — add the "Knockout Play-off" round to match_stage.
--
-- The current Champions League format has a league phase (36 teams, one table)
-- followed by a knockout play-off round for the teams finishing 9th–24th, then
-- Round of 16 → Final. This adds that play-off round to the enum.
--
-- Kept in its own migration: a new enum value cannot be used in the same
-- transaction that adds it.
-- ============================================================================

alter type public.match_stage add value if not exists 'playoff' before 'round_of_16';

