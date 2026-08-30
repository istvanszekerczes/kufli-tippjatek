-- ============================================================================
-- reset-fixtures.sql — wipe the demo tournament so you can load REAL fixtures.
--
-- You usually don't need this: `npm run sync -- --reset` does the same thing.
-- Use this if you'd rather clear the data from the SQL editor.
-- ============================================================================

begin;

delete from public.predictions;
delete from public.outright_predictions;

update public.tournament_config
set champion_team_id     = null,
    outright_betting     = true,
    group_stage_betting  = true,     -- league phase open for predictions
    knockout_betting     = false,
    outright_deadline    = null,     -- set to league-phase MD1 kickoff in /admin
    updated_at           = now()
where id = 1;

delete from public.matches;
delete from public.teams;

commit;

-- Then:  FOOTBALL_API_PROVIDER=uefa  npm run sync      (no API key needed)
