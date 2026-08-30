// ============================================================================
// sync-fixtures — pulls Champions League fixtures / scores into the database.
//
// Trigger it on a schedule (GitHub Actions cron, cron-job.org, or Supabase
// pg_cron). Auth: send header  x-cron-secret: <CRON_SECRET>.
//
// Env (set with `supabase secrets set ...`):
//   FOOTBALL_API_PROVIDER   mock | football-data | api-football   (default: mock)
//   FOOTBALL_API_KEY        provider API key (not needed for mock)
//   FOOTBALL_API_SEASON     season year for api-football          (default: 2025)
//   CRON_SECRET             shared secret required in x-cron-secret header
//   SUPABASE_URL            (auto-injected)
//   SUPABASE_SECRET_KEY     new-style secret key  sb_secret_...    (optional)
//   SUPABASE_SERVICE_ROLE_KEY  legacy service_role key (auto-injected fallback)
// ============================================================================
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import {
  fetchApiFootball,
  fetchFootballData,
  NormFixture
} from '../_shared/providers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // Prefer the new-style secret key (sb_secret_...); fall back to the legacy
  // service_role key that Supabase auto-injects. Either one bypasses RLS.
  const serviceKey =
    Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json(
      { error: 'SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set' },
      500
    );
  }
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const provider = (Deno.env.get('FOOTBALL_API_PROVIDER') ?? 'mock').toLowerCase();
  const apiKey = Deno.env.get('FOOTBALL_API_KEY') ?? '';
  const season = Deno.env.get('FOOTBALL_API_SEASON') ?? '2025';

  try {
    let result: Record<string, unknown>;

    if (provider === 'mock') {
      result = await runMock(db);
    } else {
      let fixtures: NormFixture[];
      if (provider === 'football-data') {
        if (!apiKey) return json({ error: 'FOOTBALL_API_KEY required' }, 400);
        fixtures = await fetchFootballData(apiKey);
      } else if (provider === 'api-football') {
        if (!apiKey) return json({ error: 'FOOTBALL_API_KEY required' }, 400);
        fixtures = await fetchApiFootball(apiKey, season);
      } else {
        return json({ error: `unknown provider "${provider}"` }, 400);
      }
      result = await upsertFixtures(db, fixtures);
    }

    return json({ ok: true, provider, at: new Date().toISOString(), ...result });
  } catch (err) {
    console.error(err);
    return json({ ok: false, provider, error: String(err) }, 500);
  }
});

// ---------------------------------------------------------------------------
// MOCK: advance seeded fixtures based on the clock so the demo runs itself.
// ---------------------------------------------------------------------------
async function runMock(db: SupabaseClient) {
  const { data: matches, error } = await db
    .from('matches')
    .select('id, api_id, kickoff_at, status, home_score, away_score, home_team_id, away_team_id');
  if (error) throw error;

  const now = Date.now();
  const FULL_TIME_MS = 115 * 60 * 1000;
  let live = 0;
  let finished = 0;
  const updates: Promise<unknown>[] = [];

  for (const m of matches ?? []) {
    if (!m.home_team_id || !m.away_team_id) continue; // knockout placeholder — leave alone
    const ko = Date.parse(m.kickoff_at);
    const final = seededScore(m.api_id ?? hash(m.id));

    let status: string;
    let hs: number | null;
    let as: number | null;

    if (now < ko) {
      status = 'upcoming';
      hs = null;
      as = null;
    } else if (now < ko + FULL_TIME_MS) {
      status = 'live';
      const progress = (now - ko) / FULL_TIME_MS;
      hs = Math.round(final.h * progress);
      as = Math.round(final.a * progress);
    } else {
      status = 'finished';
      hs = final.h;
      as = final.a;
    }

    if (status === m.status && hs === m.home_score && as === m.away_score) continue;
    if (status === 'live') live++;
    if (status === 'finished') finished++;

    updates.push(
      db
        .from('matches')
        .update({ status, home_score: hs, away_score: as })
        .eq('id', m.id)
        .then(({ error }) => {
          if (error) throw error;
        })
    );
  }

  await Promise.all(updates);
  return { changed: updates.length, now_live: live, now_finished: finished };
}

function seededScore(seed: number): { h: number; a: number } {
  let s = Math.abs(Math.trunc(seed)) % 2147483647 || 1;
  const next = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const dist = [0, 0, 1, 1, 1, 2, 2, 3, 4];
  return {
    h: dist[Math.floor(next() * dist.length)],
    a: dist[Math.floor(next() * dist.length)]
  };
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

// ---------------------------------------------------------------------------
// LIVE: upsert teams then matches from a normalised fixture list.
// ---------------------------------------------------------------------------
async function upsertFixtures(db: SupabaseClient, fixtures: NormFixture[]) {
  // 1. teams
  const teamByApiId = new Map<number, NormFixture['home']>();
  for (const f of fixtures) {
    for (const t of [f.home, f.away]) {
      if (t.api_id != null && !teamByApiId.has(t.api_id)) teamByApiId.set(t.api_id, t);
    }
  }
  const teamRows = [...teamByApiId.values()].map((t) => ({
    api_id: t.api_id,
    name: t.name,
    short_name: t.short_name,
    crest_url: t.crest_url,
    group_label: t.group_label
  }));
  if (teamRows.length) {
    const { error } = await db.from('teams').upsert(teamRows, { onConflict: 'api_id' });
    if (error) throw error;
  }

  const { data: teamIdRows, error: teamErr } = await db.from('teams').select('id, api_id');
  if (teamErr) throw teamErr;
  const idByApiId = new Map<number, string>();
  for (const r of teamIdRows ?? []) if (r.api_id != null) idByApiId.set(r.api_id, r.id);

  // 2. matches
  const matchRows = fixtures.map((f) => ({
    api_id: f.api_id,
    stage: f.stage,
    round: f.round,
    matchday: f.matchday,
    home_team_id: f.home.api_id != null ? idByApiId.get(f.home.api_id) ?? null : null,
    away_team_id: f.away.api_id != null ? idByApiId.get(f.away.api_id) ?? null : null,
    kickoff_at: f.kickoff_at,
    status: f.status,
    home_score: f.home_score,
    away_score: f.away_score
  }));

  if (matchRows.length) {
    const { error } = await db.from('matches').upsert(matchRows, { onConflict: 'api_id' });
    if (error) throw error;
  }

  return {
    teams_upserted: teamRows.length,
    matches_upserted: matchRows.length,
    finished: matchRows.filter((m) => m.status === 'finished').length
  };
}
