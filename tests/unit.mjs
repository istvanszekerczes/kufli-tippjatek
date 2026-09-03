// Unit tests — pure logic + the real calc_points() over RPC. No DB writes.
import { createClient } from '@supabase/supabase-js';
import { ok, eq, section, summary } from './helpers.mjs';
import {
  fetchUefa,
  fetchFootballData,
  fetchApiFootball,
  fetchFixtures
} from '../supabase/functions/_shared/providers.mjs';
import { runMock, upsertFixtures } from '../supabase/functions/_shared/sync-core.mjs';

// calc_points() is granted to anon/authenticated, so the publishable key is enough
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

// ─────────────────────────────────────────────────────────────────────────
section('calc_points()  — the real Postgres scoring function, via RPC');
// [pred_home, pred_away, actual_home, actual_away, expected]
const cases = [
  // rule 5 — exact
  [2, 1, 2, 1, 5],
  [0, 0, 0, 0, 5],
  [4, 3, 4, 3, 5],
  // rule 3 — winner + exact goal difference
  [3, 1, 2, 0, 3],
  [0, 2, 1, 3, 3],
  [2, 0, 3, 1, 3],
  // rule 2 — winner + winning team's exact goal count
  [2, 1, 2, 0, 2],
  [1, 3, 0, 3, 2],
  // rule 1 — winner only
  [2, 1, 3, 0, 1],
  [1, 4, 0, 2, 1],
  // rule 1 — correctly called draw (not exact)
  [1, 1, 0, 0, 1],
  [2, 2, 3, 3, 1],
  [2, 2, 1, 1, 1], // same GD (0) but a draw → still 1, NOT 3
  // rule 0 — wrong outcome
  [2, 1, 0, 1, 0],
  [1, 1, 2, 0, 0],
  [0, 1, 1, 0, 0],
  // rule 0 — null / missing
  [null, 1, 2, 1, 0],
  [2, 1, null, null, 0]
];
for (const [ph, pa, ah, aa, want] of cases) {
  const { data, error } = await db.rpc('calc_points', {
    p_home: ph,
    p_away: pa,
    a_home: ah,
    a_away: aa
  });
  eq(error ? 'ERR:' + error.message : data, want, `calc_points(${ph},${pa} → ${ah},${aa})`);
}

// ─────────────────────────────────────────────────────────────────────────
section('UEFA provider  — live feed, normalised shape');
{
  const fx = await fetchUefa('2027');
  ok(fx.length >= 100, `pulled ${fx.length} tournament-phase fixtures (>=100)`);
  ok(
    fx.every((f) => typeof f.api_id === 'number' && !Number.isNaN(f.api_id)),
    'every fixture has a numeric api_id'
  );
  ok(
    fx.every((f) => ['upcoming', 'live', 'finished'].includes(f.status)),
    'every status is upcoming|live|finished'
  );
  ok(
    fx.every((f) => ['group', 'playoff', 'round_of_16', 'quarter_final', 'semi_final', 'final'].includes(f.stage)),
    'every stage maps to a known enum value'
  );
  ok(fx.every((f) => f.kickoff_at && !Number.isNaN(Date.parse(f.kickoff_at))), 'every kickoff_at is a valid date');
  ok(
    fx.every((f) => f.home && f.away && 'api_id' in f.home && 'name' in f.home),
    'every fixture has home/away team objects'
  );
  const teams = new Set(fx.flatMap((f) => [f.home.api_id, f.away.api_id]).filter((x) => x != null));
  ok(teams.size === 36, `exactly 36 distinct teams (got ${teams.size})`);
  const md = fx.filter((f) => f.stage === 'group');
  ok(md.length === 144, `144 league-phase matches (got ${md.length})`);
  ok(
    md.every((f) => f.matchday >= 1 && f.matchday <= 8),
    'league-phase matchdays are 1..8'
  );
}

// ─────────────────────────────────────────────────────────────────────────
section('football-data.org provider  — normalisation (stubbed fetch)');
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      matches: [
        {
          id: 500001,
          utcDate: '2026-09-16T19:00:00Z',
          status: 'FINISHED',
          matchday: 1,
          stage: 'LEAGUE_STAGE',
          group: null,
          score: { winner: 'HOME_TEAM', fullTime: { home: 3, away: 1 } },
          homeTeam: { id: 57, name: 'Arsenal FC', shortName: 'Arsenal', tla: 'ARS', crest: 'x' },
          awayTeam: { id: 5, name: 'Bayern', shortName: 'Bayern', tla: 'FCB', crest: 'y' }
        },
        {
          id: 500002,
          utcDate: '2027-05-30T19:00:00Z',
          status: 'TIMED',
          stage: 'FINAL',
          group: null,
          score: { winner: null, fullTime: { home: null, away: null } },
          homeTeam: { id: null, name: null },
          awayTeam: { id: null, name: null }
        }
      ]
    })
  });
  try {
    const fx = await fetchFootballData('token');
    eq(fx.length, 2, 'returns 2 fixtures');
    eq(fx[0].stage, 'group', 'LEAGUE_STAGE → group');
    eq(fx[0].status, 'finished', 'FINISHED → finished');
    eq([fx[0].home_score, fx[0].away_score], [3, 1], 'score mapped');
    eq(fx[0].winner_api_id, 57, 'HOME_TEAM winner → home api_id');
    eq(fx[0].matchday, 1, 'matchday mapped');
    eq(fx[1].stage, 'final', 'FINAL → final');
    eq(fx[1].home.name, 'TBD', 'null team name → TBD');
    eq(fx[1].home.api_id, null, 'null team id → null');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ─────────────────────────────────────────────────────────────────────────
section('API-Football provider  — normalisation (stubbed fetch)');
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      errors: [],
      response: [
        {
          fixture: { id: 1200001, date: '2026-09-16T19:00:00+00:00', status: { short: 'FT' } },
          league: { round: 'League Stage - 3' },
          goals: { home: 0, away: 2 },
          teams: {
            home: { id: 42, name: 'Arsenal', logo: 'x', winner: false },
            away: { id: 157, name: 'Bayern', logo: 'y', winner: true }
          }
        },
        {
          fixture: { id: 1200002, date: '2027-02-18T20:00:00+00:00', status: { short: 'NS' } },
          league: { round: 'Knockout Round Play-offs' },
          goals: { home: null, away: null },
          teams: { home: { id: 1, name: 'A' }, away: { id: 2, name: 'B' } }
        }
      ]
    })
  });
  try {
    const fx = await fetchApiFootball('key', '2026');
    eq(fx[0].stage, 'group', '"League Stage - 3" → group');
    eq(fx[0].matchday, 3, 'matchday parsed from round string');
    eq(fx[0].status, 'finished', 'FT → finished');
    eq(fx[0].winner_api_id, 157, 'away winner → away api_id');
    eq(fx[1].stage, 'playoff', '"Knockout Round Play-offs" → playoff');
    eq(fx[1].matchday, null, 'knockout has no matchday');
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ─────────────────────────────────────────────────────────────────────────
section('fetchFixtures()  — provider routing + guards');
{
  let threw = false;
  try {
    await fetchFixtures('football-data', '', '2026');
  } catch (e) {
    threw = /required/i.test(e.message);
  }
  ok(threw, 'football-data without a key throws "required"');

  threw = false;
  try {
    await fetchFixtures('nonsense', 'k', '2026');
  } catch (e) {
    threw = /unknown provider/i.test(e.message);
  }
  ok(threw, 'unknown provider throws');
}

// ─────────────────────────────────────────────────────────────────────────
section('sync-core  — runMock() clock logic + upsertFixtures() diffing');
{
  const now = Date.now();
  const rows = [
    { id: 'a', api_id: 1, kickoff_at: new Date(now + 3600e3).toISOString(), status: 'upcoming', home_score: null, away_score: null, home_team_id: 't1', away_team_id: 't2' }, // future → stays upcoming
    { id: 'b', api_id: 2, kickoff_at: new Date(now - 3600e3).toISOString(), status: 'upcoming', home_score: null, away_score: null, home_team_id: 't1', away_team_id: 't2' }, // 1h ago → live
    { id: 'c', api_id: 3, kickoff_at: new Date(now - 3 * 3600e3).toISOString(), status: 'upcoming', home_score: null, away_score: null, home_team_id: 't1', away_team_id: 't2' }, // 3h ago → finished
    { id: 'd', api_id: 4, kickoff_at: new Date(now - 3 * 3600e3).toISOString(), status: 'upcoming', home_score: null, away_score: null, home_team_id: null, away_team_id: null } // no teams → skipped
  ];
  const updates = [];
  const fakeDb = {
    from: () => ({
      select: async () => ({ data: rows, error: null }),
      update(patch) {
        return {
          eq: (_c, id) => {
            updates.push({ id, patch });
            return Promise.resolve({ error: null });
          }
        };
      }
    })
  };
  const res = await runMock(fakeDb);
  const byId = Object.fromEntries(updates.map((u) => [u.id, u.patch]));
  eq(byId['a'], undefined, 'future match: no update');
  eq(byId['b']?.status, 'live', '1h-ago match → live');
  eq(byId['c']?.status, 'finished', '3h-ago match → finished');
  ok(typeof byId['c']?.home_score === 'number', 'finished match gets a numeric score');
  eq(byId['d'], undefined, 'team-less match: skipped');
  eq(res.matches_changed, 2, 'runMock reports 2 changed');
}
{
  // upsertFixtures should only write fixtures whose data actually changed
  const existing = [
    { api_id: 10, stage: 'group', round: null, matchday: 1, kickoff_at: '2026-09-16T19:00:00Z', status: 'upcoming', home_score: null, away_score: null, home_team_id: 'x', away_team_id: 'y' }
  ];
  let matchUpsertCount = 0;
  const fakeDb = {
    from(table) {
      return {
        upsert: async (rows) => {
          if (table === 'matches') matchUpsertCount = rows.length;
          return { error: null };
        },
        select: async () => ({
          data: table === 'teams' ? [{ id: 'x', api_id: 100 }, { id: 'y', api_id: 200 }] : existing,
          error: null
        })
      };
    }
  };
  const fixtures = [
    // unchanged
    { api_id: 10, stage: 'group', round: null, matchday: 1, kickoff_at: '2026-09-16T19:00:00Z', status: 'upcoming', home_score: null, away_score: null, home: { api_id: 100, name: 'X' }, away: { api_id: 200, name: 'Y' } },
    // new
    { api_id: 11, stage: 'group', round: null, matchday: 1, kickoff_at: '2026-09-16T21:00:00Z', status: 'upcoming', home_score: null, away_score: null, home: { api_id: 100, name: 'X' }, away: { api_id: 200, name: 'Y' } }
  ];
  await upsertFixtures(fakeDb, fixtures);
  eq(matchUpsertCount, 1, 'only the changed/new fixture is written (1 of 2)');
}

process.exit(summary());
