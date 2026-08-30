// ============================================================================
// sync-fixtures — Edge Function wrapper around the shared sync core.
// Pulls Champions League fixtures / scores into the database on demand.
//
// Trigger on a schedule (GitHub Actions cron, cron-job.org, or pg_cron).
// Auth: send header  x-cron-secret: <CRON_SECRET>
//
// Secrets (`supabase secrets set ...`):
//   FOOTBALL_API_PROVIDER   mock | football-data | api-football   (default: mock)
//   FOOTBALL_API_KEY        provider API key (not needed for mock)
//   FOOTBALL_API_SEASON     season year for api-football          (default: 2026)
//   CRON_SECRET             required value of the x-cron-secret header
//   SUPABASE_URL                 (auto-injected)
//   SUPABASE_SECRET_KEY         sb_secret_... (preferred)
//   SUPABASE_SERVICE_ROLE_KEY   legacy fallback (auto-injected)
//
// NOTE: the same job can be run without deploying this function at all —
//       see scripts/sync-fixtures.mjs (`npm run sync`).
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { runSync } from '../_shared/sync-core.mjs';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey =
    Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json(
      { error: 'SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set' },
      500
    );
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const result = await runSync(db, {
      provider: Deno.env.get('FOOTBALL_API_PROVIDER') ?? 'mock',
      apiKey: Deno.env.get('FOOTBALL_API_KEY') ?? '',
      season: Deno.env.get('FOOTBALL_API_SEASON') ?? '2026'
    });
    return json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
