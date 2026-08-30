-- ============================================================================
-- 0008_standings_snapshots.sql — daily leaderboard snapshots for the
-- "rank / points over time" chart on the profile page.
-- ============================================================================

create table if not exists public.standings_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  as_of        date not null default (now() at time zone 'utc')::date,
  total_points integer not null default 0,
  rank         integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, as_of)
);
create index if not exists standings_snapshots_user_idx
  on public.standings_snapshots (user_id, as_of);

alter table public.standings_snapshots enable row level security;

drop policy if exists "snapshots: read all" on public.standings_snapshots;
create policy "snapshots: read all" on public.standings_snapshots
  for select to authenticated using (true);

grant select on public.standings_snapshots to anon, authenticated;

-- The sync job (service role) writes snapshots; this helper lets it upsert the
-- whole leaderboard for "today" in one call.
create or replace function public.capture_standings_snapshot()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  insert into public.standings_snapshots (user_id, as_of, total_points, rank)
  select l.user_id, (now() at time zone 'utc')::date, l.total_points, l.rank
  from public.leaderboard l
  on conflict (user_id, as_of)
  do update set total_points = excluded.total_points,
                rank         = excluded.rank,
                created_at   = now();
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.capture_standings_snapshot() to service_role;
