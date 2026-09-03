// Tiny test harness — no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// load .env into process.env (same minimal parser as scripts/)
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}

export const ROOT = root;

let passed = 0;
let failed = 0;
const failures = [];

export function ok(cond, name) {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
  }
}

export function eq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(a === e, `${name}  (got ${a}, want ${e})`);
}

export function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

export function summary() {
  console.log(`\n${'─'.repeat(50)}`);
  if (failed === 0) {
    console.log(`\x1b[32m\x1b[1mALL ${passed} CHECKS PASSED\x1b[0m`);
    return 0;
  }
  console.log(`\x1b[31m\x1b[1m${failed} FAILED\x1b[0m, ${passed} passed`);
  for (const f of failures) console.log(`  \x1b[31m- ${f}\x1b[0m`);
  return 1;
}

export async function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`timeout after ${ms}ms: ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
