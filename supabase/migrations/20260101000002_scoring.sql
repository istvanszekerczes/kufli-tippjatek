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
