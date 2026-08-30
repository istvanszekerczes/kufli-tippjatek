/**
 * One command to pull real Champions League fixtures + scores into Supabase.
 * No Supabase CLI, no Edge Function deploy required.
 *
 *   npm run sync
 *
 * Reads (from process.env, then a local .env):
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY        (sb_secret_...)  — or SUPABASE_SERVICE_ROLE_KEY
 *   FOOTBALL_API_PROVIDER      football-data | api-football | mock   (default: mock)
 *   FOOTBALL_API_KEY           provider key (not needed for mock)
 *   FOOTBALL_API_SEASON        e.g. 2026      (api-football only, default 2026)
 *
 * Flags: --provider=<p>  --season=<y>  --key=<k>
 *
 * Run it on a schedule with the GitHub Action in .github/workflows/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { runSync } from '../supabase/functions/_shared/sync-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- load .env (no dependency) --------------------------------------------
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadDotEnv(path.join(root, '.env'));

// --- args ----------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const provider = args.provider || process.env.FOOTBALL_API_PROVIDER || 'mock';
const apiKey = args.key || process.env.FOOTBALL_API_KEY || '';
const season = args.season || process.env.FOOTBALL_API_SEASON || '2026';

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    'Missing SUPABASE_URL and/or SUPABASE_SECRET_KEY (a sb_secret_... key).\n' +
      'Add them to .env or the environment.'
  );
  process.exit(1);
}
if (!/^sb_secret_|^ey/.test(SECRET_KEY)) {
  console.warn('[sync] warning: SUPABASE_SECRET_KEY does not look like a secret/service key.');
}

const db = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });

console.log(`[sync] provider=${provider}${provider === 'api-football' ? ` season=${season}` : ''}`);

try {
  const result = await runSync(db, { provider, apiKey, season });
  console.log('[sync] done:', JSON.stringify(result));
  process.exit(0);
} catch (err) {
  console.error('[sync] FAILED:', err?.message || err);
  process.exit(1);
}
