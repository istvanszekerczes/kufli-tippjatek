# ⚽ UCL Tipp — Champions League Prediction Game

A full-stack tipping game for the UEFA Champions League. Predict scorelines, call
the outright winner, and climb a live leaderboard. Dark, football-themed UI.

- **Frontend:** Angular 21 (standalone + signals) · Tailwind CSS · deploys as a
  static site to **Netlify** or **Vercel** (free tier).
- **Backend:** **Supabase** — Postgres, Auth, Row Level Security, Edge Functions,
  Realtime (free tier).
- **Cost to run:** **$0** to start. No server to manage.

> **Why not Angular + Java/Spring?** A Spring service would need a paid always-on
> host and would re-implement what Supabase already gives you for free: auth,
> a Postgres database, row-level authorization, scheduled/serverless functions,
> and websockets. The scoring engine lives in the database as a trigger, so it
> runs the instant a result lands — no backend process required.

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

**Outright winner:** pick the champion before kickoff of the first match — **15
points** if correct. Scored automatically when an admin sets the champion.

**Phases** are controlled from the in-app Admin console (`/admin`):

1. **Pre-tournament** — only the outright market is open.
2. **Group stage** — predictions open for group matches (`group_stage_betting`).
3. **Knockout stage** — Round of 16 → Final unlock (`knockout_betting`).

Every match locks automatically at kickoff.

---

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) → **New project**. Pick a
   strong database password and a region near your users.
2. When it's ready, open **Project Settings → API keys** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`, or the legacy **anon** JWT on older
     projects) → `SUPABASE_ANON_KEY` — this is the browser key, guarded by RLS.
   - **Secret key** (`sb_secret_…`, or the legacy **service_role** JWT) → keep
     private; used only by the Edge Function. On older projects you can skip it —
     Supabase auto-injects `SUPABASE_SERVICE_ROLE_KEY` into functions.

### Apply the database schema

**Option A — SQL editor (no tooling):** open **SQL Editor**, paste the contents
of [`supabase/setup.sql`](supabase/setup.sql), run it. Then (optional, for a
ready-to-play demo) paste and run [`supabase/seed.sql`](supabase/seed.sql).

**Option B — Supabase CLI:**

```bash
npm i -g supabase
supabase link --project-ref <your-project-ref>
supabase db push          # applies supabase/migrations/*
psql "$(supabase db url)" -f supabase/seed.sql   # optional demo data
```

### Deploy the fixtures Edge Function

```bash
supabase functions deploy sync-fixtures --no-verify-jwt

# secrets (mock mode needs only CRON_SECRET):
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
supabase secrets set FOOTBALL_API_PROVIDER=mock

# New-key projects: give the function a secret key so it can write results.
# (Skip on older projects — SUPABASE_SERVICE_ROLE_KEY is injected automatically.)
supabase secrets set SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxxxxx
```

In **mock mode** the function advances the seeded fixtures based on the clock, so
the game plays itself for testing. To use real data, see
[§5](#5-switch-to-a-live-football-api).

> **Faster testing:** in **Authentication → Sign In / Providers → Email**, turn
> **Confirm email** off so new accounts log in immediately. Turn it back on for
> production.

### Make yourself an admin

Register in the app first (so your profile row exists), then in the SQL editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Reload the app — an **Admin** link appears in the nav.

---

## 2. Run locally

```bash
git clone <this repo> && cd ucl-tipp
npm install
cp .env.example .env          # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm start                     # -> http://localhost:4200
```

`npm start` runs `scripts/set-env.js` first, which writes `public/config.json`
from your `.env` (or real environment variables). You can also just paste the two
values into `src/environments/environment.ts` for local hacking.

Add `http://localhost:4200` under **Supabase → Authentication → URL
Configuration → Redirect URLs**.

---

## 3. Deploy the frontend

The app reads Supabase credentials at **runtime** from `/config.json`, generated
at build time from environment variables — so the same build works anywhere.

### Netlify

1. **Add new site → Import an existing project**, pick the repo.
2. Build settings are picked up from [`netlify.toml`](netlify.toml)
   (`npm run build:ci` → publish `dist/ucl-tipp/browser`).
3. **Site configuration → Environment variables** — add `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (paste the **publishable** key as the value).
4. **Deploy**. SPA routing + the `_redirects` file are already configured.

### Vercel

1. **Add New → Project**, import the repo. Framework preset: **Other**.
2. Settings come from [`vercel.json`](vercel.json).
3. **Settings → Environment Variables** — add `SUPABASE_URL` and
   `SUPABASE_ANON_KEY` (paste the **publishable** key as the value).
4. **Deploy.**

After the first deploy, set your production URL as **Site URL** and add it to
**Redirect URLs** in Supabase Auth, then update `site_url` in
[`supabase/config.toml`](supabase/config.toml).

---

## 4. Keep fixtures & scores updating

The Edge Function needs to be called on a schedule. Pick one:

### GitHub Actions (simplest, free)

[`.github/workflows/sync-fixtures.yml`](.github/workflows/sync-fixtures.yml) runs
every 10 minutes. Add two repo secrets (**Settings → Secrets and variables →
Actions**):

| Secret | Value |
| --- | --- |
| `SUPABASE_FUNCTIONS_URL` | `https://<project-ref>.supabase.co/functions/v1` |
| `CRON_SECRET` | the value you set with `supabase secrets set CRON_SECRET=…` |

### Postgres `pg_cron`

Enable `pg_cron` + `pg_net` in **Database → Extensions**, then run
[`supabase/cron.sql`](supabase/cron.sql) (edit the two Vault secrets first).

### External cron / manual

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/sync-fixtures" \
  -H "x-cron-secret: <CRON_SECRET>"
```

Any 5–15 minute interval is fine. Match status flips Upcoming → Live → Finished
automatically and the leaderboard updates over Realtime.

---

## 5. Switch to a live football API

The Edge Function ships adapters for two providers. Set secrets and redeploy
nothing (secrets take effect immediately):

### football-data.org (free tier available)

```bash
supabase secrets set FOOTBALL_API_PROVIDER=football-data
supabase secrets set FOOTBALL_API_KEY=<your-token>
```

### API-Football (api-sports.io)

```bash
supabase secrets set FOOTBALL_API_PROVIDER=api-football
supabase secrets set FOOTBALL_API_KEY=<your-key>
supabase secrets set FOOTBALL_API_SEASON=2025
```

Add a provider by implementing one `fetch…()` in
[`supabase/functions/_shared/providers.ts`](supabase/functions/_shared/providers.ts)
that returns `NormFixture[]`. Real fixtures upsert by the provider's own
`api_id`; the mock `9xxx` rows can be deleted once real data flows.

---

## 6. Project structure

```
src/app/
  core/            SupabaseService, AuthService, guards, domain services, models
  shared/          navbar, match-card, countdown, rank-badge, loading-spinner
  features/
    auth/          login, register
    dashboard/     match list + inline prediction inputs (home)
    outright/      pick the tournament winner
    leaderboard/   live standings + podium
    profile/       points, rank, full prediction history
    rules/         scoring explainer
    admin/         phase toggles, result entry, set champion
supabase/
  migrations/      schema, scoring triggers, RLS, leaderboard view, realtime
  setup.sql        all migrations concatenated (paste-and-run)
  seed.sql         16-team demo tournament
  functions/
    sync-fixtures/ Edge Function: pulls fixtures/scores (mock + 2 live providers)
  cron.sql         optional pg_cron scheduler
scripts/set-env.js writes public/config.json from env vars
```

## 7. Security model (Row Level Security)

- Players can read all profiles, matches, teams and the leaderboard.
- A player can read/write **only their own** predictions, and only while the
  match is open (`is_match_open()` is enforced in the RLS policy, not just the
  UI). `is_admin` cannot be self-assigned.
- Only `is_admin` users can write matches, teams and `tournament_config`.
- The leaderboard view aggregates everyone's totals without exposing individual
  picks.
- The service-role key lives only in Edge Function secrets, never in the bundle.

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Red "Supabase is not configured" banner | Env vars missing — set `SUPABASE_URL` / `SUPABASE_ANON_KEY` and rebuild (`npm run config`). |
| "Betting is closed for this match" on save | Match is past kickoff, or the phase isn't open in `/admin`. |
| Leaderboard empty | No scored matches yet. Mark one finished in `/admin` or wait for the sync. |
| Email confirmation link points to localhost | Set **Site URL** in Supabase Auth to your deployed domain. |
| Edge Function 401 | `x-cron-secret` header doesn't match the `CRON_SECRET` secret. |
| `db push` rejects migrations | Use a fresh project, or run `supabase/setup.sql` in the SQL editor instead. |
