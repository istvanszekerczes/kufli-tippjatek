/**
 * One command to pull real Champions League fixtures + scores into Supabase.
 * No Supabase CLI, no Edge Function deploy, and (with the default provider) no
 * API key at all.
 *
 *   npm run sync                 # pull fixtures/scores
 *   npm run sync -- --reset      # wipe demo data first, then pull
 *
 * Reads (from process.env, then a local .env):
 *   SUPABASE_URL
 *   SUPABASE_SECRET_KEY        (sb_secret_...)  — or SUPABASE_SERVICE_ROLE_KEY
 *   FOOTBALL_API_PROVIDER      uefa | football-data | api-football | mock  (default: uefa)
 *   FOOTBALL_API_KEY           provider key (uefa + mock need none)
 *   FOOTBALL_API_SEASON        uefa -> seasonYear e.g. 2027; api-football -> 2026
 *
 * Flags: --reset  --provider=<p>  --season=<y>  --key=<k>
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

// tolerate values pasted into GitHub secrets with stray whitespace / quotes
const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '');
const SUPABASE_URL = clean(process.env.SUPABASE_URL).replace(/\/+$/, '');
const SECRET_KEY = clean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const provider = clean(args.provider || process.env.FOOTBALL_API_PROVIDER) || 'uefa';
const apiKey = clean(args.key || process.env.FOOTBALL_API_KEY);
const season =
  clean(args.season || process.env.FOOTBALL_API_SEASON) ||
  (provider === 'uefa' ? '2027' : '2026');

console.log(
  `[sync] url=${SUPABASE_URL || '(empty)'} ` +
    `keyLen=${SECRET_KEY.length} keyLooksSecret=${/^sb_secret_|^ey/.test(SECRET_KEY)}`
);

if (!SUPABASE_URL || !SECRET_KEY) {
  console.error(
    'Missing SUPABASE_URL and/or SUPABASE_SECRET_KEY. Add them as GitHub repo\n' +
      'secrets (Settings -> Secrets and variables -> Actions) or to your local .env.'
  );
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)) {
  console.warn(`[sync] warning: SUPABASE_URL "${SUPABASE_URL}" is not the expected https://<ref>.supabase.co form.`);
}
if (!/^sb_secret_|^ey/.test(SECRET_KEY)) {
  console.warn(
    '[sync] warning: SUPABASE_SECRET_KEY does not look like a secret key (sb_secret_...) ' +
      'or a service_role JWT. Did you paste the publishable key by mistake?'
  );
}

const db = createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false } });
const NIL = '00000000-0000-0000-0000-000000000000';

async function reset() {
  console.log('[sync] --reset: clearing demo fixtures, teams and predictions…');
  for (const t of ['predictions', 'outright_predictions']) {
    const { error } = await db.from(t).delete().neq('id', NIL);
    if (error) throw new Error(`${t}: ${error.message}`);
  }
  let { error } = await db
    .from('tournament_config')
    .update({ champion_team_id: null, knockout_betting: false, group_stage_betting: true })
    .eq('id', 1);
  if (error) throw new Error(`tournament_config: ${error.message}`);
  ({ error } = await db.from('matches').delete().neq('id', NIL));
  if (error) throw new Error(`matches: ${error.message}`);
  ({ error } = await db.from('teams').delete().neq('id', NIL));
  if (error) throw new Error(`teams: ${error.message}`);
}

console.log(`[sync] provider=${provider}${provider === 'mock' ? '' : ` season=${season}`}`);

try {
  if (args.reset) await reset();
  const result = await runSync(db, { provider, apiKey, season });
  console.log('[sync] done:', JSON.stringify(result));
  process.exit(0);
} catch (err) {
  console.error('[sync] FAILED:', err?.message || err);
  process.exit(1);
}
