-- ============================================================================
-- 0007_reveal_picks.sql — once a match locks, everyone can see everyone's picks
-- ============================================================================

-- A match is "locked" as soon as it kicks off (or is already live/finished).
create or replace function public.is_match_locked(m_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(m.status <> 'upcoming' or m.kickoff_at <= now(), false)
  from public.matches m
  where m.id = m_id;
$$;

grant execute on function public.is_match_locked(uuid) to anon, authenticated;

-- Extra SELECT policy: predictions for a locked match are readable by any
-- signed-in user. RLS policies are OR'd, so "read own" still applies too.
drop policy if exists "predictions: read after lock" on public.predictions;
create policy "predictions: read after lock" on public.predictions
  for select to authenticated
  using (public.is_match_locked(match_id));
