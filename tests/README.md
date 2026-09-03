# Tests

Run against your real Supabase project (values read from the project-root `.env`).

```bash
npm test          # unit + e2e
npm run test:unit # pure logic + calc_points() over RPC — read-only, safe anywhere
npm run test:e2e  # full lifecycle against the live DB (see below)
```

## `tests/unit.mjs` — 51 checks, read-only

- **`calc_points()`** — the real Postgres function, every scoring rule + edge
  cases (exact, winner+GD, winner+count, winner-only, correct draw, the tricky
  "same goal difference but a draw → 1 not 3", nulls).
- **Providers** — `fetchUefa()` live (shape: 144 league-phase matches, 36 teams,
  matchdays 1–8, valid enums/dates); `football-data` + `api-football`
  normalisation with a stubbed `fetch` (stage/status/winner/matchday mapping);
  `fetchFixtures()` routing + guards.
- **sync-core** — `runMock()` clock logic and `upsertFixtures()` change-only
  diffing, against fake in-memory `db` objects (no writes).

Needs only `SUPABASE_URL` + `SUPABASE_ANON_KEY`.

## `tests/e2e.mjs` — 46 checks, writes throwaway data then deletes it

Creates two test matches (`api_id` 98701001–2), two teams (98700001–2) and six
`@example.invalid` users, then asserts:

- `handle_new_user()` auto-creates profiles and de-duplicates colliding usernames
- **RLS** — a player can submit/read only their own picks on an open match;
  cannot submit as another user; cannot see others' picks before kickoff;
  cannot self-promote to `is_admin`; cannot write `tournament_config`
- **Realtime** — a `matches` UPDATE is broadcast on the channel
- **`apply_match_scoring()`** — all five rules produce the right `points_awarded`
  when the match is finished 2–1
- **`leaderboard`** view — totals, ranking, shared rank on ties
- **Reveal-after-lock** — every player can see all picks once the match is
  finished; nobody can edit a pick after kickoff
- **`capture_standings_snapshot()`** — writes today's row per user
- **Auto phase** — knockout betting stays closed while league-phase matches
  remain unfinished; `tournament_config` is never touched by a sync

Everything is removed in a `finally` block (and again at the start of the next
run). It never touches real fixtures, real config, or your own account.

Needs `SUPABASE_URL`, `SUPABASE_SECRET_KEY` **and** `SUPABASE_ANON_KEY`.
