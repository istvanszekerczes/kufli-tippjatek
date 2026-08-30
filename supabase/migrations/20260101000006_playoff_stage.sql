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
