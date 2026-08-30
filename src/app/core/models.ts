export type MatchStage =
  | 'group'
  | 'playoff'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final';

export type MatchStatus = 'upcoming' | 'live' | 'finished';

export const STAGE_LABEL: Record<MatchStage, string> = {
  group: 'League Phase',
  playoff: 'Knockout Play-off',
  round_of_16: 'Round of 16',
  quarter_final: 'Quarter-finals',
  semi_final: 'Semi-finals',
  final: 'Final'
};

export const STAGE_ORDER: MatchStage[] = [
  'group',
  'playoff',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final'
];

/** Stages that unlock together with the knockout phase. */
export const KNOCKOUT_STAGES: MatchStage[] = [
  'playoff',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final'
];

export interface Team {
  id: string;
  api_id: number | null;
  name: string;
  short_name: string | null;
  crest_url: string | null;
  group_label: string | null;
}

export interface Match {
  id: string;
  api_id: number | null;
  stage: MatchStage;
  round: string | null;
  matchday: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  updated_at: string;
  home_team?: Team | null;
  away_team?: Team | null;
}

export interface Prediction {
  id: string;
  user_id: string;
  match_id: string;
  home_score: number;
  away_score: number;
  points_awarded: number | null;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Match row joined with the current user's prediction (from the `match_feed` view). */
export interface MatchWithPrediction extends Match {
  my_home: number | null;
  my_away: number | null;
  my_points: number | null;
  is_open: boolean;
}

export interface OutrightPrediction {
  id: string;
  user_id: string;
  team_id: string;
  points_awarded: number | null;
  scored_at: string | null;
  created_at: string;
}

export interface TournamentConfig {
  id: number;
  outright_betting: boolean;
  outright_deadline: string | null;
  group_stage_betting: boolean;
  knockout_betting: boolean;
  champion_team_id: string | null;
  updated_at: string;
}

export interface Profile {
  id: string;
  username: string;
  is_admin: boolean;
  created_at: string;
}

export interface LeaderboardRow {
  user_id: string;
  username: string;
  total_points: number;
  matches_scored: number;
  exact_hits: number;
  rank: number;
}

export const OUTRIGHT_POINTS = 15;

export interface ScoreBreakdownRule {
  points: number;
  title: string;
  example: string;
}

export const SCORING_RULES: ScoreBreakdownRule[] = [
  { points: 5, title: 'Exact score', example: 'You predicted 2–1, it finished 2–1.' },
  {
    points: 3,
    title: 'Right winner + exact goal difference',
    example: 'You predicted 3–1, it finished 2–0 (both a 2-goal home win).'
  },
  {
    points: 2,
    title: "Right winner + winning team's exact goal count",
    example: 'You predicted 2–1, it finished 2–0 (winner scored exactly 2).'
  },
  { points: 1, title: 'Right winner, or a correctly called draw', example: 'You predicted 2–1, it finished 3–0.' },
  { points: 0, title: 'Wrong outcome', example: 'You predicted a home win, the away side won.' }
];
