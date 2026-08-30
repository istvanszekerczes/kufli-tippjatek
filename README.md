# ⚽ Kufli TippJáték — Champions League Prediction Game

A full-stack tipping game for the UEFA Champions League. Predict scorelines, call
the outright winner, and climb a live leaderboard. Dark UI themed on the Kufli
crest.

- **Frontend:** Angular 21 (standalone + signals) · Tailwind CSS · deploys as a
  static site to **Vercel** or **Netlify** (free tier).
- **Backend:** **Supabase** — Postgres, Auth, Row Level Security, Realtime, and
  optional Edge Functions (free tier).
- **Fixtures:** real Champions League data via `npm run sync` — the official
  UEFA feed (no API key), with football-data.org / API-Football as alternatives,
  plus a self-advancing `mock` mode.
- **Also:** Hungarian UI by default (EN/HU toggle), installable as a PWA,
  everyone's picks revealed once a match kicks off, a "to-do" nudge for missing
  predictions, profile stats + rank-over-time chart, and automatic phase
  transitions (knockout betting opens itself; the champion is set from the final).
- **Cost to run:** **$0** to start.

---

## How scoring works

When a match is marked **finished**, a Postgres trigger scores every prediction
using `public.calc_points()` (mutually exclusive, highest match wins):

| Points | Rule | Example (your pick → result) |
| --- | --- | --- |
| **5** | Exact score | `2–1` → `2–1` |
| **3** | Correct winner **and** exact goal difference | `3–1` → `2–0` |
| **2** | Correct winner **and** winning team's exact goal count | `2–1` → `2–0` |
| **1** | Correct winner, or a correctly predicted draw | `2–1` → `3–0` |
| **0** | Wrong outcome | `2–1` → `0–1` |

**Outright winner:** pick the champion before the first match kicks off — **15
points** if correct. Scored automatically when an admin sets the champion.

**Phases** are controlled from the in-app Admin console (`/admin`):

1. **Pre-tournament** — only the outright market is open.
2. **League phase** — predictions open for the 36-team league-phase matches.
3. **Knockout stage** — Play-off round → Round of 16 → Final unlock together.

Every match locks automatically at kickoff.

---

## 1. Supabase project

1. [supabase.com](https://supabase.com) → **New project**.
2. **Project Settings → API keys** — copy:
   - **Project URL** → `SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `SUPABASE_ANON_KEY` (browser key, RLS-guarded)
   - **Secret key** (`sb_secret_…`) → keep private; used only by the sync job.

### Apply the schema

**SQL editor:** paste [`supabase/setup.sql`](supabase/setup.sql) and run.
*(Already have an older schema? Run whichever migrations you're missing from
[`supabase/migrations/`](supabase/migrations/) — `…0006` adds the knockout
play-off round, `…0007` reveals everyone's picks after kickoff, `…0008` adds
the standings-history table for the profile chart.)*

**or CLI:** `supabase link --project-ref <ref> && supabase db push`

### Auth settings (do these)

- **Authentication → URL Configuration → Site URL**: your deployed URL.
  Add `https://<your-domain>/**` to **Redirect URLs**.
- **Authentication → Sign In / Providers → Email → uncheck "Confirm email"** —
  Supabase's free mailer only sends ~3–4/hour, which breaks signup for a group.

---

## 2. Load real fixtures

The current Champions League format is a **36-team league phase** (8 games each)
→ knockout play-offs → Round of 16 → Final. `npm run sync` pulls the real draw
and keeps scores/status up to date.

The default provider is **`uefa`** — the official UEFA match feed. **No API key,
no signup.**

```bash
cp .env.example .env
```

```ini
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
FOOTBALL_API_PROVIDER=uefa
FOOTBALL_API_SEASON=2027          # the year the final is played
```

```bash
npm install
npm run sync -- --reset          # wipe the demo, then load the real season
```

`--reset` clears the demo tournament first. Afterwards just `npm run sync` — it
only writes what changed. Automate it in [§4](#4-keep-scores-updating).

### Other providers (optional)

| `FOOTBALL_API_PROVIDER` | Key | Notes |
| --- | --- | --- |
| `uefa` | none | official, current season, **default** |
| `mock` | none | self-advancing demo — needs [`supabase/seed.sql`](supabase/seed.sql) |
| `football-data` | [free token](https://www.football-data.org/client/register) | `X-Auth-Token` |
| `api-football` | [free key](https://dashboard.api-football.com/register) | 100 req/day; `FOOTBALL_API_SEASON` = start year (2026) |

---

## 3. Deploy the site

The repo already ships [`vercel.json`](vercel.json) and
[`netlify.toml`](netlify.toml). The Supabase URL + publishable key are also
committed in `src/environments/environment.ts`, so it works even before you set
host env vars.

### Vercel

1. [vercel.com/new](https://vercel.com/new) → import the repo → framework preset **Other**.
2. *(optional)* add `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars to override the
   committed values.
3. **Deploy** → share the `*.vercel.app` URL.

### Netlify

Same idea: [app.netlify.com](https://app.netlify.com) → Add site → Import → pick
the repo. Build settings come from `netlify.toml`.

### Become an admin

Register in the app, then in the SQL editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Reload → the **Admin** tab appears (open/close phases, enter results manually,
set the champion).

---

## 4. Keep scores updating

`npm run sync` needs to run on a schedule. Easiest: the included GitHub Action.

[`.github/workflows/sync-fixtures.yml`](.github/workflows/sync-fixtures.yml) runs
every 10 minutes. With the default `uefa` provider you only need two repo secrets
(**Settings → Secrets and variables → Actions**):

| Secret | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |

*(Only if you switch providers: also add `FOOTBALL_API_PROVIDER`, `FOOTBALL_API_KEY`
and `FOOTBALL_API_SEASON`.)*

Alternatives: any cron runner that can `node scripts/sync-fixtures.mjs`, or the
**Supabase Edge Function** — deploy [`supabase/functions/sync-fixtures`](supabase/functions/sync-fixtures)
(`supabase functions deploy sync-fixtures --no-verify-jwt`, set the same secrets
plus a `CRON_SECRET`) and hit it from `pg_cron` ([`supabase/cron.sql`](supabase/cron.sql))
or an external cron with header `x-cron-secret: <CRON_SECRET>`.

---

## 5. Run locally

```bash
npm install
npm start          # http://localhost:4200
```

Credentials come from `src/environments/environment.ts` (or `.env` + `npm run
config`).

---

## 6. Project structure

```
src/app/
  core/            SupabaseService, AuthService, guards, domain services, models
  shared/          navbar, match-card, countdown, rank-badge, loading-spinner
  features/        auth · dashboard · outright · leaderboard · profile · rules · admin
supabase/
  migrations/      schema, scoring triggers, RLS, leaderboard view, realtime, play-off stage
  setup.sql        all migrations concatenated (paste-and-run)
  seed.sql         16-team demo tournament (mock mode only)
  reset-fixtures.sql   wipe the demo before loading real data
  functions/
    _shared/       providers.mjs + sync-core.mjs (shared by the script AND the Edge Function)
    sync-fixtures/ Edge Function wrapper (optional — `npm run sync` does the same job)
  cron.sql         optional pg_cron scheduler for the Edge Function
scripts/
  set-env.js          writes public/config.json from env vars at build time
  sync-fixtures.mjs   `npm run sync` — pulls real fixtures/scores into Supabase
```

## 7. Security model (Row Level Security)

- Players read all profiles, teams, matches and the leaderboard.
- A player can read/write **only their own** predictions, and only while the
  match is open — `is_match_open()` is enforced in the RLS policy, not just the
  UI. `is_admin` cannot be self-assigned.
- Only `is_admin` users can write matches, teams and `tournament_config`.
- The leaderboard view aggregates everyone's totals without exposing picks.
- The `sb_secret_` key lives only in your `.env` / CI secrets, never in the bundle.

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Supabase is not configured" banner | `environment.ts` values missing/blank, or a host build wrote an empty `/config.json`. |
| "Betting is closed for this match" on save | Match is past kickoff, or that phase isn't open in `/admin`. |
| `npm run sync` says `FOOTBALL_API_KEY is required` | Set `FOOTBALL_API_PROVIDER` + `FOOTBALL_API_KEY` in `.env`. |
| Leaderboard empty | No scored matches yet — wait for a `finished` match or enter one in `/admin`. |
| Email confirmation link points to localhost | Set **Site URL** in Supabase Auth to your deployed domain. |
| `db push` rejects migrations | Use a fresh project, or run `supabase/setup.sql` in the SQL editor. |
