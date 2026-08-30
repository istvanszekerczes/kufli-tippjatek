-- ============================================================================
-- seed.sql — compact 16-team mock tournament so the app is playable offline.
--
-- Run automatically by `supabase db reset`, or manually:
--   psql "$DATABASE_URL" -f supabase/seed.sql
--
-- Replace / clear these rows once you point sync-fixtures at a real provider
-- (real fixtures upsert by their own api_id and will simply sit alongside).
-- api_id 9xxx values are chosen to avoid clashing with real provider ids.
-- ============================================================================

insert into public.teams (api_id, name, short_name, group_label) values
  (9001, 'Real Madrid',          'Real Madrid',  'A'),
  (9002, 'Manchester City',      'Man City',     'A'),
  (9003, 'RB Leipzig',           'Leipzig',      'A'),
  (9004, 'Feyenoord',            'Feyenoord',    'A'),
  (9005, 'Bayern München',       'Bayern',       'B'),
  (9006, 'FC Barcelona',         'Barcelona',    'B'),
  (9007, 'Inter',                'Inter',        'B'),
  (9008, 'Sporting CP',          'Sporting',     'B'),
  (9009, 'Liverpool',            'Liverpool',    'C'),
  (9010, 'Arsenal',              'Arsenal',      'C'),
  (9011, 'Bayer Leverkusen',     'Leverkusen',   'C'),
  (9012, 'Atalanta',             'Atalanta',     'C'),
  (9013, 'Paris Saint-Germain',  'PSG',          'D'),
  (9014, 'Borussia Dortmund',    'Dortmund',     'D'),
  (9015, 'Juventus',             'Juventus',     'D'),
  (9016, 'SL Benfica',           'Benfica',      'D')
on conflict (api_id) do nothing;

-- ---- Group stage: 4 groups x 6 matches (round robin) --------------------
with g(api_id, md, home_api, away_api, ko) as (
  values
    -- Group A
    (90111, 1, 9001, 9002, timestamptz '2026-09-16 19:00:00+00'),
    (90112, 1, 9003, 9004, timestamptz '2026-09-16 21:00:00+00'),
    (90121, 2, 9004, 9001, timestamptz '2026-09-30 19:00:00+00'),
    (90122, 2, 9002, 9003, timestamptz '2026-09-30 21:00:00+00'),
    (90131, 3, 9001, 9003, timestamptz '2026-10-21 19:00:00+00'),
    (90132, 3, 9004, 9002, timestamptz '2026-10-21 21:00:00+00'),
    -- Group B
    (90211, 1, 9005, 9006, timestamptz '2026-09-17 19:00:00+00'),
    (90212, 1, 9007, 9008, timestamptz '2026-09-17 21:00:00+00'),
    (90221, 2, 9008, 9005, timestamptz '2026-10-01 19:00:00+00'),
    (90222, 2, 9006, 9007, timestamptz '2026-10-01 21:00:00+00'),
    (90231, 3, 9005, 9007, timestamptz '2026-10-22 19:00:00+00'),
    (90232, 3, 9008, 9006, timestamptz '2026-10-22 21:00:00+00'),
    -- Group C
    (90311, 1, 9009, 9010, timestamptz '2026-09-16 19:00:00+00'),
    (90312, 1, 9011, 9012, timestamptz '2026-09-16 21:00:00+00'),
    (90321, 2, 9012, 9009, timestamptz '2026-09-30 19:00:00+00'),
    (90322, 2, 9010, 9011, timestamptz '2026-09-30 21:00:00+00'),
    (90331, 3, 9009, 9011, timestamptz '2026-10-21 19:00:00+00'),
    (90332, 3, 9012, 9010, timestamptz '2026-10-21 21:00:00+00'),
    -- Group D
    (90411, 1, 9013, 9014, timestamptz '2026-09-17 19:00:00+00'),
    (90412, 1, 9015, 9016, timestamptz '2026-09-17 21:00:00+00'),
    (90421, 2, 9016, 9013, timestamptz '2026-10-01 19:00:00+00'),
    (90422, 2, 9014, 9015, timestamptz '2026-10-01 21:00:00+00'),
    (90431, 3, 9013, 9015, timestamptz '2026-10-22 19:00:00+00'),
    (90432, 3, 9016, 9014, timestamptz '2026-10-22 21:00:00+00')
)
insert into public.matches (api_id, stage, matchday, home_team_id, away_team_id, kickoff_at)
select g.api_id, 'group', g.md, h.id, a.id, g.ko
from g
join public.teams h on h.api_id = g.home_api
join public.teams a on a.api_id = g.away_api
on conflict (api_id) do nothing;

-- ---- Knockout placeholders (teams filled in later by the admin/API) -----
insert into public.matches (api_id, stage, round, kickoff_at) values
  (90441, 'round_of_16',   'Round of 16 · Match 1', timestamptz '2027-02-16 21:00:00+00'),
  (90442, 'round_of_16',   'Round of 16 · Match 2', timestamptz '2027-02-17 21:00:00+00'),
  (90443, 'round_of_16',   'Round of 16 · Match 3', timestamptz '2027-02-18 21:00:00+00'),
  (90444, 'round_of_16',   'Round of 16 · Match 4', timestamptz '2027-02-24 21:00:00+00'),
  (90445, 'round_of_16',   'Round of 16 · Match 5', timestamptz '2027-02-25 21:00:00+00'),
  (90446, 'round_of_16',   'Round of 16 · Match 6', timestamptz '2027-03-10 21:00:00+00'),
  (90447, 'round_of_16',   'Round of 16 · Match 7', timestamptz '2027-03-11 21:00:00+00'),
  (90448, 'round_of_16',   'Round of 16 · Match 8', timestamptz '2027-03-11 19:00:00+00'),
  (90501, 'quarter_final', 'Quarter-final 1',       timestamptz '2027-04-06 21:00:00+00'),
  (90502, 'quarter_final', 'Quarter-final 2',       timestamptz '2027-04-06 19:00:00+00'),
  (90503, 'quarter_final', 'Quarter-final 3',       timestamptz '2027-04-07 21:00:00+00'),
  (90504, 'quarter_final', 'Quarter-final 4',       timestamptz '2027-04-07 19:00:00+00'),
  (90601, 'semi_final',    'Semi-final 1',          timestamptz '2027-04-28 21:00:00+00'),
  (90602, 'semi_final',    'Semi-final 2',          timestamptz '2027-04-29 21:00:00+00'),
  (90701, 'final',         'Final',                 timestamptz '2027-05-29 21:00:00+00')
on conflict (api_id) do nothing;

-- ---- Open the group stage + outright market -----------------------------
update public.tournament_config
set outright_betting    = true,
    group_stage_betting = true,
    knockout_betting     = false,
    champion_team_id      = null,
    outright_deadline     = timestamptz '2026-09-15 18:00:00+00',
    updated_at            = now()
where id = 1;
