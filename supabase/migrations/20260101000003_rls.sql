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
