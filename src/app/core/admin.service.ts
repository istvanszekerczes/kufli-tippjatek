import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Match, MatchStatus, TournamentConfig } from './models';

const MATCH_SELECT =
  '*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)';

/**
 * Admin-only writes. These succeed only for users whose `profiles.is_admin`
 * flag is true — enforced by Row Level Security, not just the UI.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly sb = inject(SupabaseService);

  async allMatches(): Promise<Match[]> {
    const { data, error } = await this.sb.client
      .from('matches')
      .select(MATCH_SELECT)
      .order('kickoff_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Match[];
  }

  async updateConfig(patch: Partial<TournamentConfig>): Promise<void> {
    const { error } = await this.sb.client
      .from('tournament_config')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) throw error;
  }

  /** Set a result and status. When status becomes `finished`, the DB trigger scores every prediction. */
  async setResult(
    matchId: string,
    homeScore: number | null,
    awayScore: number | null,
    status: MatchStatus
  ): Promise<void> {
    const { error } = await this.sb.client
      .from('matches')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId);
    if (error) throw error;
  }

  /** Setting the champion triggers outright scoring (15 pts to correct pickers). */
  async setChampion(teamId: string | null): Promise<void> {
    await this.updateConfig({ champion_team_id: teamId });
  }
}
