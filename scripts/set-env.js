/**
 * Generates `public/config.json` from environment variables so the built
 * Angular bundle can read Supabase credentials at runtime (no rebuild needed
 * to point the same artifact at a different Supabase project).
 *
 * Reads, in order of precedence:
 *   1. process.env  (Vercel / Netlify / CI inject these)
 *   2. a local `.env` file in the project root (for `npm start`)
 *
 * Accepted keys:  SUPABASE_URL, SUPABASE_ANON_KEY
 *   (NG_APP_SUPABASE_URL / NG_APP_SUPABASE_ANON_KEY also accepted)
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envFile = path.join(root, '.env');

/** Minimal dotenv parser — no dependency. */
function loadDotEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = loadDotEnv(envFile);
const pick = (...keys) => {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
    if (fileEnv[k]) return fileEnv[k];
  }
  return '';
};

const config = {
  supabaseUrl: pick('SUPABASE_URL', 'NG_APP_SUPABASE_URL'),
  supabaseAnonKey: pick('SUPABASE_ANON_KEY', 'NG_APP_SUPABASE_ANON_KEY')
};

const target = path.join(root, 'public', 'config.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n');

const ok = config.supabaseUrl && config.supabaseAnonKey;
console.log(`[set-env] wrote ${path.relative(root, target)}`);
console.log(`[set-env] supabaseUrl:     ${config.supabaseUrl || '(empty!)'}`);
console.log(`[set-env] supabaseAnonKey: ${config.supabaseAnonKey ? config.supabaseAnonKey.slice(0, 12) + '…' : '(empty!)'}`);
if (!ok) {
  console.warn('[set-env] WARNING: Supabase credentials are empty. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
}
