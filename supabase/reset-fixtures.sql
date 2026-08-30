-- ============================================================================
-- reset-fixtures.sql — wipe the demo tournament so you can load REAL fixtures.
--
-- Run this once in the Supabase SQL editor BEFORE your first `npm run sync`
-- against a real provider. It clears all fixtures, teams, and predictions
-- (there is no game data worth keeping from the mock run).
-- ============================================================================

begin;

-- predictions reference matches; outright picks reference teams
delete from public.predictions;
delete from public.outright_predictions;

-- config references a team as champion
update public.tournament_config
set champion_team_id     = null,
    outright_betting     = true,
    group_stage_betting  = true,     -- league phase open for predictions
    knockout_betting     = false,
    outright_deadline    = null,     -- set this to your league-phase MD1 kickoff
    updated_at           = now()
where id = 1;

delete from public.matches;
delete from public.teams;

commit;

-- Now run:  npm run sync     (with FOOTBALL_API_PROVIDER + FOOTBALL_API_KEY set)
-- Then, in the app's Admin console, set the outright deadline and open/close
-- phases as the tournament progresses.
