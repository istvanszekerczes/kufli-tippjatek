// Provider adapters: normalise a live football API into the shape the
// database expects. Add a new provider by implementing `fetchFixtures`.

export type Stage =
  | 'group'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final';

export type Status = 'upcoming' | 'live' | 'finished';

export interface NormTeam {
  api_id: number | null;
  name: string;
  short_name: string | null;
  crest_url: string | null;
  group_label: string | null;
}

export interface NormFixture {
  api_id: number;
  stage: Stage;
  round: string | null;
  matchday: number | null;
  kickoff_at: string; // ISO 8601
  status: Status;
  home_score: number | null;
  away_score: number | null;
  home: NormTeam;
  away: NormTeam;
}

// --------------------------------------------------------------------------
// football-data.org — https://www.football-data.org/  (competition CL)
// --------------------------------------------------------------------------
function fdStage(stage: string): Stage {
  switch (stage) {
    case 'LAST_16':
      return 'round_of_16';
    case 'QUARTER_FINALS':
      return 'quarter_final';
    case 'SEMI_FINALS':
      return 'semi_final';
    case 'FINAL':
      return 'final';
    default:
      return 'group';
  }
}

function fdStatus(status: string): Status {
  if (['IN_PLAY', 'PAUSED'].includes(status)) return 'live';
  if (['FINISHED', 'AWARDED'].includes(status)) return 'finished';
  return 'upcoming';
}

export async function fetchFootballData(apiKey: string): Promise<NormFixture[]> {
  const res = await fetch('https://api.football-data.org/v4/competitions/CL/matches', {
    headers: { 'X-Auth-Token': apiKey }
  });
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  const body = await res.json();

  return (body.matches ?? []).map((m: any): NormFixture => ({
    api_id: m.id,
    stage: fdStage(m.stage),
    round: m.stage === 'GROUP_STAGE' ? null : titleCase(m.stage),
    matchday: m.matchday ?? null,
    kickoff_at: m.utcDate,
    status: fdStatus(m.status),
    home_score: m.score?.fullTime?.home ?? null,
    away_score: m.score?.fullTime?.away ?? null,
    home: fdTeam(m.homeTeam, m.group),
    away: fdTeam(m.awayTeam, m.group)
  }));
}

function fdTeam(t: any, group: string | null): NormTeam {
  return {
    api_id: t?.id ?? null,
    name: t?.name ?? 'TBD',
    short_name: t?.shortName ?? t?.tla ?? null,
    crest_url: t?.crest ?? null,
    group_label: group ? group.replace(/^Group\s*/i, '') : null
  };
}

// --------------------------------------------------------------------------
// API-Football (api-sports.io) — league 2 = UEFA Champions League
// --------------------------------------------------------------------------
function afStage(round: string): Stage {
  const r = round.toLowerCase();
  if (r.includes('round of 16') || r.includes('1/8')) return 'round_of_16';
  if (r.includes('quarter')) return 'quarter_final';
  if (r.includes('semi')) return 'semi_final';
  if (r.includes('final') && !r.includes('semi') && !r.includes('quarter')) return 'final';
  return 'group';
}

function afStatus(short: string): Status {
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  return 'upcoming';
}

export async function fetchApiFootball(apiKey: string, season: string): Promise<NormFixture[]> {
  const url = `https://v3.football.api-sports.io/fixtures?league=2&season=${encodeURIComponent(season)}`;
  const res = await fetch(url, { headers: { 'x-apisports-key': apiKey } });
  if (!res.ok) throw new Error(`api-football ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (body.errors && Object.keys(body.errors).length) {
    throw new Error(`api-football: ${JSON.stringify(body.errors)}`);
  }

  return (body.response ?? []).map((row: any): NormFixture => {
    const round: string = row.league?.round ?? '';
    const mdMatch = round.match(/(\d+)\s*$/);
    return {
      api_id: row.fixture.id,
      stage: afStage(round),
      round: round.startsWith('Group') ? null : round,
      matchday: round.startsWith('Group') && mdMatch ? Number(mdMatch[1]) : null,
      kickoff_at: row.fixture.date,
      status: afStatus(row.fixture.status?.short ?? 'NS'),
      home_score: row.goals?.home ?? null,
      away_score: row.goals?.away ?? null,
      home: afTeam(row.teams?.home),
      away: afTeam(row.teams?.away)
    };
  });
}

function afTeam(t: any): NormTeam {
  return {
    api_id: t?.id ?? null,
    name: t?.name ?? 'TBD',
    short_name: t?.name ?? null,
    crest_url: t?.logo ?? null,
    group_label: null
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
