// Provider adapters — normalise a live football API into the shape the database
// expects. Plain ESM so it runs unchanged in both Deno (the Edge Function) and
// Node (scripts/sync-fixtures.mjs). Only uses global `fetch`.
//
// A normalised fixture:
//   {
//     api_id: number,
//     stage: 'group'|'playoff'|'round_of_16'|'quarter_final'|'semi_final'|'final',
//     round: string | null,
//     matchday: number | null,
//     kickoff_at: string (ISO 8601),
//     status: 'upcoming' | 'live' | 'finished',
//     home_score: number | null,
//     away_score: number | null,
//     home: { api_id, name, short_name, crest_url, group_label },
//     away: { ...same... }
//   }

// ---------------------------------------------------------------------------
// UEFA official match feed  —  https://match.uefa.com/  (competitionId 1 = UCL)
// No API key. `season` here is the UEFA seasonYear = the year the final is
// played (2026/27 season -> 2027).
// ---------------------------------------------------------------------------
const UEFA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function uefaStage(round) {
  const type = round?.metaData?.type || '';
  const name = (round?.metaData?.name || '').toLowerCase();
  if (type === 'GROUP_STANDINGS' || name.includes('league phase') || name.includes('group')) return 'group';
  if (type.includes('PLAY_OFF') || name.includes('play-off') || name.includes('play off')) return 'playoff';
  if (type === 'ROUND_OF_16' || name.includes('round of 16') || name.includes('last 16')) return 'round_of_16';
  if (type === 'QUARTER_FINALS' || name.includes('quarter')) return 'quarter_final';
  if (type === 'SEMI_FINALS' || name.includes('semi')) return 'semi_final';
  if (type === 'FINAL' || name === 'final') return 'final';
  return 'group';
}

function uefaStatus(status) {
  const s = (status || '').toUpperCase();
  if (s === 'FINISHED') return 'finished';
  if (s.startsWith('LIVE') || s === 'PAUSED' || s === 'HALFTIME') return 'live';
  return 'upcoming';
}

function uefaWinnerApiId(m) {
  const id = m.winner?.match?.team?.id ?? m.winner?.aggregate?.team?.id;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function uefaTeam(t) {
  if (!t || t.isPlaceHolder) {
    return { api_id: null, name: 'TBD', short_name: null, crest_url: null, group_label: null };
  }
  const id = Number(t.id);
  return {
    api_id: Number.isFinite(id) ? id : null,
    name: t.internationalName || t.translations?.displayName?.EN || 'TBD',
    short_name: t.translations?.shortName?.EN || t.teamCode || null,
    crest_url: t.logoUrl || t.mediumLogoUrl || t.bigLogoUrl || null,
    group_label: null
  };
}

export async function fetchUefa(season) {
  const seasonYear = String(season || '2027');
  const limit = 500;
  let offset = 0;
  const all = [];
  for (let page = 0; page < 6; page++) {
    const url =
      `https://match.uefa.com/v5/matches?competitionId=1&seasonYear=${seasonYear}` +
      `&phase=ALL&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UEFA_UA } });
    if (!res.ok) throw new Error(`uefa.com ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return all
    // keep only the competition proper — drop July/August qualifiers
    .filter((m) => (m.round?.phase || '').toUpperCase() === 'TOURNAMENT')
    .map((m) => {
      const stage = uefaStage(m.round);
      const kickoff =
        m.kickOffTime?.dateTime || m.matchday?.dateFrom || m.round?.dateFrom || null;
      const hs = m.score?.total?.home ?? m.score?.regular?.home ?? null;
      const as = m.score?.total?.away ?? m.score?.regular?.away ?? null;
      return {
        api_id: Number(m.id),
        stage,
        round: stage === 'group' ? null : m.round?.metaData?.name || null,
        matchday: stage === 'group' ? Number(m.matchday?.sequenceNumber) || null : null,
        kickoff_at: kickoff,
        status: uefaStatus(m.status),
        home_score: hs,
        away_score: as,
        winner_api_id: uefaStatus(m.status) === 'finished' ? uefaWinnerApiId(m) : null,
        home: uefaTeam(m.homeTeam),
        away: uefaTeam(m.awayTeam)
      };
    })
    .filter((f) => f.kickoff_at); // a fixture with no date at all can't be stored
}

// ---------------------------------------------------------------------------
// football-data.org  —  https://www.football-data.org/  (competition CL)
// Free tier: register for a token, ~10 requests/minute.
// ---------------------------------------------------------------------------
function fdStage(stage) {
  switch (stage) {
    case 'PLAYOFFS':
    case 'PLAY_OFFS':
    case 'PLAYOFF_ROUND':
      return 'playoff';
    case 'LAST_16':
      return 'round_of_16';
    case 'QUARTER_FINALS':
      return 'quarter_final';
    case 'SEMI_FINALS':
      return 'semi_final';
    case 'FINAL':
      return 'final';
    // GROUP_STAGE (old) and LEAGUE_STAGE (current 36-team format)
    default:
      return 'group';
  }
}

function fdStatus(status) {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live';
  if (status === 'FINISHED' || status === 'AWARDED') return 'finished';
  return 'upcoming';
}

function fdTeam(t, group) {
  return {
    api_id: t?.id ?? null,
    name: t?.name ?? 'TBD',
    short_name: t?.shortName ?? t?.tla ?? null,
    crest_url: t?.crest ?? null,
    group_label: group ? String(group).replace(/^GROUP[_\s]*/i, '') : null
  };
}

export async function fetchFootballData(apiKey) {
  const res = await fetch('https://api.football-data.org/v4/competitions/CL/matches', {
    headers: { 'X-Auth-Token': apiKey }
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  const body = await res.json();

  return (body.matches ?? []).map((m) => ({
    api_id: m.id,
    stage: fdStage(m.stage),
    // stage label is enough for display; keep `round` free for extra detail only
    round: null,
    matchday: m.matchday ?? null,
    kickoff_at: m.utcDate,
    status: fdStatus(m.status),
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    winner_api_id:
      m.score?.winner === 'HOME_TEAM'
        ? m.homeTeam?.id ?? null
        : m.score?.winner === 'AWAY_TEAM'
          ? m.awayTeam?.id ?? null
          : null,
    home: fdTeam(m.homeTeam, m.group),
    away: fdTeam(m.awayTeam, m.group)
  }));
}

// ---------------------------------------------------------------------------
// API-Football (api-sports.io)  —  league 2 = UEFA Champions League
// Free tier: 100 requests/day.
// ---------------------------------------------------------------------------
function afStage(round) {
  const r = (round || '').toLowerCase();
  if (r.includes('play-off') || r.includes('play off') || r.includes('playoff')) return 'playoff';
  if (r.includes('round of 16') || r.includes('1/8')) return 'round_of_16';
  if (r.includes('quarter')) return 'quarter_final';
  if (r.includes('semi')) return 'semi_final';
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'final';
  return 'group';
}

function afStatus(short) {
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  return 'upcoming';
}

function afTeam(t) {
  return {
    api_id: t?.id ?? null,
    name: t?.name ?? 'TBD',
    short_name: t?.name ?? null,
    crest_url: t?.logo ?? null,
    group_label: null
  };
}

export async function fetchApiFootball(apiKey, season) {
  const url = `https://v3.football.api-sports.io/fixtures?league=2&season=${encodeURIComponent(season)}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } });
  if (!res.ok) throw new Error(`api-football ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.errors && (Array.isArray(body.errors) ? body.errors.length : Object.keys(body.errors).length)) {
    throw new Error(`api-football: ${JSON.stringify(body.errors)}`);
  }

  return (body.response ?? []).map((row) => {
    const round = row.league?.round ?? '';
    const isLeague = /^(group stage|league stage)/i.test(round);
    const mdMatch = round.match(/(\d+)\s*$/);
    return {
      api_id: row.fixture.id,
      stage: afStage(round),
      round: isLeague ? null : round || null,
      matchday: isLeague && mdMatch ? Number(mdMatch[1]) : null,
      kickoff_at: row.fixture.date,
      status: afStatus(row.fixture.status?.short ?? 'NS'),
      home_score: row.goals?.home ?? null,
      away_score: row.goals?.away ?? null,
      winner_api_id:
        row.teams?.home?.winner === true
          ? row.teams?.home?.id ?? null
          : row.teams?.away?.winner === true
            ? row.teams?.away?.id ?? null
            : null,
      home: afTeam(row.teams?.home),
      away: afTeam(row.teams?.away)
    };
  });
}

// ---------------------------------------------------------------------------
export async function fetchFixtures(provider, apiKey, season) {
  switch ((provider || '').toLowerCase()) {
    case 'uefa':
      return fetchUefa(season || '2027');
    case 'football-data':
      if (!apiKey) throw new Error('FOOTBALL_API_KEY is required for provider "football-data"');
      return fetchFootballData(apiKey);
    case 'api-football':
      if (!apiKey) throw new Error('FOOTBALL_API_KEY is required for provider "api-football"');
      return fetchApiFootball(apiKey, season || '2026');
    default:
      throw new Error(`Unknown provider "${provider}" (use uefa | football-data | api-football | mock)`);
  }
}
