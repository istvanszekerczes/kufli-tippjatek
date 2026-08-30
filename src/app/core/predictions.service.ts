import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Match, Prediction, Team } from './models';

export interface PredictionHistoryRow {
  prediction: Prediction;
  match: Match & { home_team: Team | null; away_team: Team | null };
}

@Injectable({ providedIn: 'root' })
export class PredictionsService {
  private readonly sb = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** Insert or update the current user's prediction for a match. */
  async submit(matchId: string, home: number, away: number): Promise<Prediction> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('Not signed in.');

    const { data, error } = await this.sb.client
      .from('predictions')
      .upsert(
        { user_id: uid, match_id: matchId, home_score: home, away_score: away },
        { onConflict: 'user_id,match_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data as Prediction;
  }

  /** Full history for a user (defaults to the current user). Newest first. */
  async history(userId?: string): Promise<PredictionHistoryRow[]> {
    const uid = userId ?? this.auth.user()?.id;
    if (!uid) return [];

    const { data, error } = await this.sb.client
      .from('predictions')
      .select(
        '*, match:matches(*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*))'
      )
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return ((data ?? []) as any[])
      .map((row) => {
        const { match, ...prediction } = row;
        return { prediction: prediction as Prediction, match };
      })
      .sort(
        (a, b) =>
          new Date(b.match.kickoff_at).getTime() - new Date(a.match.kickoff_at).getTime()
      );
  }
}
