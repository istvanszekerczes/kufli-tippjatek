// End-to-end integration test against the LIVE Supabase project.
// Creates isolated throwaway data (reserved api_id ranges + @example.invalid
// users), drives a match through upcoming → live → finished, and asserts the
// scoring trigger, the leaderboard view, realtime, and every RLS policy.
// Always cleans up. Never touches real fixtures / config / users.
import { createClient } from '@supabase/supabase-js';
import { ok, eq, section, summary, withTimeout, sleep } from './helpers.mjs';
import { runMock } from '../supabase/functions/_shared/sync-core.mjs';

const URL = process.env.SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL || !SECRET || !ANON) {
  console.error('Need SUPABASE_URL, SUPABASE_SECRET_KEY and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const svc = createClient(URL, SECRET, { auth: { persistSession: false } });

const TEAM_LO = 98700001;
const TEAM_HI = 98700099;
const MATCH_LO = 98701001;
const MATCH_HI = 98701099;
const EMAIL = (n) => `kufli-e2e-${n}@example.invalid`;
const PW = 'e2e-Passw0rd!';

const state = { userIds: [], clients: [] };

async function cleanup() {
  const { data: users } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const u of users?.users ?? []) {
    if (u.email?.startsWith('kufli-e2e-')) await svc.auth.admin.deleteUser(u.id).catch(() => {});
  }
  // deleting the matches cascades to any remaining predictions
  await svc.from('matches').delete().gte('api_id', MATCH_LO).lte('api_id', MATCH_HI);
  await svc.from('teams').delete().gte('api_id', TEAM_LO).lte('api_id', TEAM_HI);
}

async function userClient(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return c;
}

try {
  section('setup  — clean slate');
  await cleanup();
  ok(true, 'removed any leftovers from a previous run');

  const { error: teamErr } = await svc.from('teams').insert([
    { api_id: TEAM_LO, name: 'E2E Home', short_name: 'HOME' },
    { api_id: TEAM_LO + 1, name: 'E2E Away', short_name: 'AWAY' }
  ]);
  ok(!teamErr, 'inserted 2 test teams');
  const { data: teams } = await svc.from('teams').select('id, api_id').gte('api_id', TEAM_LO).lte('api_id', TEAM_HI);
  const homeId = teams.find((t) => t.api_id === TEAM_LO).id;
  const awayId = teams.find((t) => t.api_id === TEAM_LO + 1).id;

  const soon = new Date(Date.now() + 2 * 3600e3).toISOString();
  const later = new Date(Date.now() + 30 * 86400e3).toISOString();
  const { data: matches, error: matchErr } = await svc
    .from('matches')
    .insert([
      { api_id: MATCH_LO, stage: 'group', matchday: 8, home_team_id: homeId, away_team_id: awayId, kickoff_at: soon, status: 'upcoming' },
      { api_id: MATCH_LO + 1, stage: 'group', matchday: 8, home_team_id: homeId, away_team_id: awayId, kickoff_at: later, status: 'upcoming' }
    ])
    .select('id, api_id');
  ok(!matchErr, 'inserted 2 test matches (both upcoming, future kickoff)');
  const M1 = matches.find((m) => m.api_id === MATCH_LO).id;
  const M2 = matches.find((m) => m.api_id === MATCH_LO + 1).id;

  // ── runMock is safe against live data ────────────────────────────────
  section('runMock()  — does not disturb upcoming / real fixtures');
  {
    const before = (await svc.from('matches').select('id,status,home_score,away_score')).data;
    const res = await runMock(svc);
    const after = (await svc.from('matches').select('id,status,home_score,away_score')).data;
    const changed = after.filter((a) => {
      const b = before.find((x) => x.id === a.id);
      return b && (b.status !== a.status || b.home_score !== a.home_score || b.away_score !== a.away_score);
    });
    eq(res.matches_changed, 0, 'nothing to advance — every fixture is upcoming with a future kickoff');
    eq(changed.length, 0, 'the matches table is byte-for-byte unchanged');
  }

  // ── users + auto profile ────────────────────────────────────────────
  section('auth  — user creation + handle_new_user() trigger');
  for (let i = 1; i <= 6; i++) {
    const { data, error } = await svc.auth.admin.createUser({
      email: EMAIL(i),
      password: PW,
      email_confirm: true,
      user_metadata: { username: 'e2e_player' } // identical on purpose → trigger must dedupe
    });
    if (error) throw new Error(`createUser ${i}: ${error.message}`);
    state.userIds.push(data.user.id);
  }
  ok(state.userIds.length === 6, 'created 6 test users');
  await sleep(500);
  const { data: profs } = await svc.from('profiles').select('id, username, is_admin').in('id', state.userIds);
  eq(profs.length, 6, 'a profile row was auto-created for every user');
  ok(new Set(profs.map((p) => p.username)).size === 6, 'colliding usernames were de-duplicated');
  ok(profs.every((p) => p.is_admin === false), 'new profiles are not admin');
  for (let i = 1; i <= 6; i++) state.clients.push(await userClient(EMAIL(i)));
  const [c1, c2, c3] = state.clients;

  // ── RLS: predictions insert on an open match ────────────────────────
  section('RLS  — submitting predictions on an open match');
  const picks = [
    [2, 1], // 5 · exact
    [3, 2], // 3 · winner + goal difference
    [2, 0], // 2 · winner + winner's goal count
    [4, 1], // 1 · winner only
    [1, 1], // 0 · predicted a draw
    [0, 2] //  0 · predicted the wrong winner
  ];
  for (let i = 0; i < 6; i++) {
    const { error } = await state.clients[i]
      .from('predictions')
      .insert({ user_id: state.userIds[i], match_id: M1, home_score: picks[i][0], away_score: picks[i][1] });
    ok(!error, `user ${i + 1} submitted ${picks[i][0]}–${picks[i][1]}`);
  }
  {
    const { error } = await c1
      .from('predictions')
      .insert({ user_id: state.userIds[0], match_id: M2, home_score: 1, away_score: 0 });
    ok(!error, 'user 1 submitted a pick on match 2 as well');
  }

  section('RLS  — what a player must NOT be able to do');
  {
    const { error } = await c2
      .from('predictions')
      .insert({ user_id: state.userIds[0], match_id: M2, home_score: 9, away_score: 9 });
    ok(!!error, "cannot submit a prediction under another user's id");
  }
  {
    const { data: theirs } = await c2.from('predictions').select('user_id').eq('match_id', M2);
    ok(theirs.length === 0, "cannot see another player's pick on an unlocked match");
    const { data: mine } = await c1.from('predictions').select('user_id').eq('match_id', M2);
    ok(mine.length === 1, 'can see own pick on an unlocked match');
  }
  {
    await c1.from('profiles').update({ is_admin: true }).eq('id', state.userIds[0]).select();
    const { data: reread } = await svc.from('profiles').select('is_admin').eq('id', state.userIds[0]).single();
    ok(reread.is_admin === false, 'self-promotion to admin is blocked');
  }
  {
    await c1.from('tournament_config').update({ knockout_betting: true }).eq('id', 1).select();
    const { data: cfg } = await svc.from('tournament_config').select('knockout_betting').eq('id', 1).single();
    ok(cfg.knockout_betting === false, 'players cannot write tournament_config');
  }

  // ── Realtime ────────────────────────────────────────────────────────
  section('Realtime  — a match update is broadcast');
  {
    let evt = null;
    const ch = svc.channel('e2e-rt').on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches' },
      (p) => {
        if (p.new?.id === M1) evt = p.new;
      }
    );
    await withTimeout(
      new Promise((res, rej) =>
        ch.subscribe((s) => (s === 'SUBSCRIBED' ? res() : s === 'CHANNEL_ERROR' ? rej(new Error(s)) : null))
      ),
      12000,
      'realtime subscribe'
    );
    await svc.from('matches').update({ status: 'live' }).eq('id', M1);
    const deadline = Date.now() + 9000;
    while (!evt && Date.now() < deadline) await sleep(200);
    ok(!!evt, 'received a realtime UPDATE event for the match');
    ok(evt?.status === 'live', 'payload shows the new status (live)');
    await svc.removeChannel(ch);
  }

  // ── Scoring trigger ────────────────────────────────────────────────
  section('Scoring  — apply_match_scoring() on finish');
  await svc.from('matches').update({ status: 'finished', home_score: 2, away_score: 1 }).eq('id', M1);
  await sleep(1500);
  {
    const { data } = await svc
      .from('predictions')
      .select('user_id, home_score, away_score, points_awarded, scored_at')
      .eq('match_id', M1);
    const want = {
      [state.userIds[0]]: 5,
      [state.userIds[1]]: 3,
      [state.userIds[2]]: 2,
      [state.userIds[3]]: 1,
      [state.userIds[4]]: 0,
      [state.userIds[5]]: 0
    };
    for (const r of data) eq(r.points_awarded, want[r.user_id], `${r.home_score}–${r.away_score} vs 2–1`);
    ok(data.every((r) => r.scored_at), 'scored_at set on every prediction');
  }

  // ── Leaderboard view ──────────────────────────────────────────────
  section('Leaderboard  — aggregation + ranking + ties');
  {
    const { data } = await svc
      .from('leaderboard')
      .select('user_id, total_points, rank, exact_hits')
      .in('user_id', state.userIds);
    const by = Object.fromEntries(data.map((r) => [r.user_id, r]));
    eq(by[state.userIds[0]].total_points, 5, 'user 1 total = 5');
    eq(by[state.userIds[1]].total_points, 3, 'user 2 total = 3');
    eq(by[state.userIds[0]].exact_hits, 1, 'user 1 exact_hits = 1');
    ok(by[state.userIds[0]].rank < by[state.userIds[1]].rank, 'user 1 ranks above user 2');
    ok(by[state.userIds[4]].rank === by[state.userIds[5]].rank, 'the two 0-point users share a rank');
  }

  // ── RLS: reveal after lock ────────────────────────────────────────
  section('RLS  — picks are visible to everyone once the match is locked');
  {
    const { data } = await c3.from('predictions').select('user_id, points_awarded').eq('match_id', M1);
    ok(data.length === 6, "a player sees all 6 picks on the finished match");
    ok(data.some((r) => r.user_id !== state.userIds[2]), 'including other players\' rows');
  }
  {
    const { data } = await c1
      .from('predictions')
      .update({ home_score: 0, away_score: 0 })
      .eq('match_id', M1)
      .eq('user_id', state.userIds[0])
      .select();
    ok((data?.length ?? 0) === 0, 'cannot edit a prediction after kickoff');
  }

  // ── Snapshots ────────────────────────────────────────────────────
  section('Snapshots  — capture_standings_snapshot()');
  {
    const { data, error } = await svc.rpc('capture_standings_snapshot');
    ok(!error && data >= 6, `snapshot written for all users (${data})`);
    const today = new Date().toISOString().slice(0, 10);
    const { data: snap } = await svc
      .from('standings_snapshots')
      .select('total_points')
      .eq('user_id', state.userIds[0])
      .eq('as_of', today)
      .maybeSingle();
    ok(snap?.total_points === 5, "today's snapshot has user 1 at 5 points");
  }

  // ── Auto-phase guard ────────────────────────────────────────────
  section('Auto phase  — knockout stays closed until the league phase is done');
  {
    const { data: grp } = await svc.from('matches').select('status').eq('stage', 'group');
    const done = grp.filter((m) => m.status === 'finished').length;
    ok(!(grp.length > 0 && done === grp.length), `${done}/${grp.length} league-phase matches finished → auto-open must not trigger`);
    const { data: cfg } = await svc
      .from('tournament_config')
      .select('knockout_betting, champion_team_id')
      .eq('id', 1)
      .single();
    ok(cfg.knockout_betting === false && cfg.champion_team_id === null, 'tournament_config untouched');
  }
} catch (err) {
  console.error('\n\x1b[31mTEST CRASHED:\x1b[0m', err?.stack || err);
} finally {
  section('teardown');
  await cleanup();
  const { data: u } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  ok((u?.users ?? []).filter((x) => x.email?.startsWith('kufli-e2e-')).length === 0, 'all test users deleted');
  const { data: lm } = await svc.from('matches').select('id').gte('api_id', MATCH_LO).lte('api_id', MATCH_HI);
  const { data: lt } = await svc.from('teams').select('id').gte('api_id', TEAM_LO).lte('api_id', TEAM_HI);
  ok((lm?.length ?? 0) === 0, 'all test matches deleted');
  ok((lt?.length ?? 0) === 0, 'all test teams deleted');
  if (state.userIds.length) {
    const { data: lb } = await svc.from('leaderboard').select('user_id').in('user_id', state.userIds);
    ok((lb?.length ?? 0) === 0, 'test users gone from the leaderboard');
  }
  for (const c of state.clients) await c.auth.signOut().catch(() => {});
  process.exit(summary());
}
