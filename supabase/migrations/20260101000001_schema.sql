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
