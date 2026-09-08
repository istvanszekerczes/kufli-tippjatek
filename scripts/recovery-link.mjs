/**
 * Generate a one-time password-recovery link for a user (admin action).
 * Use when someone is locked out and can't get the reset email.
 *
 *   node scripts/recovery-link.mjs someone@example.com
 *
 * Reads SUPABASE_URL + SUPABASE_SECRET_KEY from .env. Send the printed link to
 * the person; they open it and set a new password on /reset. Single use, ~1h.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const raw of (fs.existsSync(path.join(root, '.env'))
  ? fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')
  : [])) {
  const l = raw.trim();
  if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('=');
  if (i > 0 && !(l.slice(0, i).trim() in process.env)) {
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const email = process.argv[2];
if (!email) {
  console.error('usage: node scripts/recovery-link.mjs <email>');
  process.exit(1);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }
});
const siteUrl = (process.env.SITE_URL || 'https://kufli-tippjatek.vercel.app').replace(/\/+$/, '');

const { data, error } = await db.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: { redirectTo: `${siteUrl}/reset` }
});
if (error) {
  console.error('failed:', error.message);
  process.exit(1);
}
console.log(`\nrecovery link for ${email} (single use, ~1h):\n`);
console.log(data.properties.action_link + '\n');
