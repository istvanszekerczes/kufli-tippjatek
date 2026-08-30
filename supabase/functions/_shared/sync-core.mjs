// Shared fixture-sync logic used by BOTH the Edge Function (Deno) and
// scripts/sync-fixtures.mjs (Node). Pass in a ready `@supabase/supabase-js`
// client created with the service-role / secret key.

import { fetchFixtures } from './providers.mjs';

const FULL_TIME_MS = 115 * 60 * 1000;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {{ provider?: string, apiKey?: string, season?: string }} opts
 */
export async function runSync(db, opts = {}) {
  const provider = (opts.provider || 'mock').toLowerCase();
  if (provider === 'mock') return { provider, ...(await runMock(db)) };

  const fixtures = await fetchFixtures(provider, opts.apiKey, opts.season);
  return { provider, ...(await upsertFixtures(db, fixtures)) };
}

// ---------------------------------------------------------------------------
// LIVE — upsert teams, then only the matches that actually changed.
// ---------------------------------------------------------------------------
export async function upsertFixtures(db, fixtures) {
  if (!fixtures.length) return { teams_upserted: 0, matches_changed: 0, finished: 0 };

  // 1. teams (upsert by api_id — refreshes names / crests)
  const teamByApiId = new Map();
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
  const idByApiId = new Map();
  for (const r of teamIdRows ?? []) if (r.api_id != null) idByApiId.set(r.api_id, r.id);

  // 2. diff against existing matches so we only write real changes
  const { data: existingRows, error: exErr } = await db
    .from('matches')
    .select('api_id, stage, round, matchday, kickoff_at, status, home_score, away_score, home_team_id, away_team_id');
  if (exErr) throw exErr;
  const existing = new Map((existingRows ?? []).map((r) => [r.api_id, r]));

  const changed = [];
  for (const f of fixtures) {
    const row = {
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
    };
    const prev = existing.get(f.api_id);
    if (!prev || diff(prev, row)) changed.push(row);
  }

  if (changed.length) {
    const { error } = await db.from('matches').upsert(changed, { onConflict: 'api_id' });
    if (error) throw error;
  }

  return {
    teams_upserted: teamRows.length,
    matches_changed: changed.length,
    finished: changed.filter((m) => m.status === 'finished').length
  };
}

function diff(a, b) {
  return (
    a.stage !== b.stage ||
    (a.round ?? null) !== (b.round ?? null) ||
    (a.matchday ?? null) !== (b.matchday ?? null) ||
    new Date(a.kickoff_at).getTime() !== new Date(b.kickoff_at).getTime() ||
    a.status !== b.status ||
    (a.home_score ?? null) !== (b.home_score ?? null) ||
    (a.away_score ?? null) !== (b.away_score ?? null) ||
    (a.home_team_id ?? null) !== (b.home_team_id ?? null) ||
    (a.away_team_id ?? null) !== (b.away_team_id ?? null)
  );
}

// ---------------------------------------------------------------------------
// MOCK — advance seeded fixtures by the clock so a demo runs itself.
// ---------------------------------------------------------------------------
export async function runMock(db) {
  const { data: matches, error } = await db
    .from('matches')
    .select('id, api_id, kickoff_at, status, home_score, away_score, home_team_id, away_team_id');
  if (error) throw error;

  const now = Date.now();
  let live = 0;
  let finished = 0;
  const updates = [];

  for (const m of matches ?? []) {
    if (!m.home_team_id || !m.away_team_id) continue; // knockout placeholder
    const ko = Date.parse(m.kickoff_at);
    const fin = seededScore(m.api_id ?? hashStr(m.id));

    let status, hs, as;
    if (now < ko) {
      status = 'upcoming';
      hs = null;
      as = null;
    } else if (now < ko + FULL_TIME_MS) {
      status = 'live';
      const progress = (now - ko) / FULL_TIME_MS;
      hs = Math.round(fin.h * progress);
      as = Math.round(fin.a * progress);
    } else {
      status = 'finished';
      hs = fin.h;
      as = fin.a;
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
  return { matches_changed: updates.length, now_live: live, now_finished: finished };
}

function seededScore(seed) {
  let s = Math.abs(Math.trunc(Number(seed))) % 2147483647 || 1;
  const next = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const dist = [0, 0, 1, 1, 1, 2, 2, 3, 4];
  return { h: dist[Math.floor(next() * dist.length)], a: dist[Math.floor(next() * dist.length)] };
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (Math.imul(31, h) + String(str).charCodeAt(i)) | 0;
  return h;
}
