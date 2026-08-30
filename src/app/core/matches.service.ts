import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Match, MatchWithPrediction, Prediction } from './models';

const MATCH_SELECT =
  '*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)';

@Injectable({ providedIn: 'root' })
export class MatchesService {
  private readonly sb = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly matches = signal<Match[]>([]);
  readonly predictions = signal<Record<string, Prediction>>({});
  readonly loading = signal(false);

  private reloadTimer?: ReturnType<typeof setTimeout>;

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [matchesRes, predsRes] = await Promise.all([
        this.sb.client.from('matches').select(MATCH_SELECT).order('kickoff_at', { ascending: true }),
        this.auth.user()
          ? this.sb.client.from('predictions').select('*').eq('user_id', this.auth.user()!.id)
          : Promise.resolve({ data: [] as Prediction[], error: null })
      ]);

      if (matchesRes.error) throw matchesRes.error;
      this.matches.set((matchesRes.data ?? []) as Match[]);

      if (predsRes.error) throw predsRes.error;
      const map: Record<string, Prediction> = {};
      for (const p of (predsRes.data ?? []) as Prediction[]) map[p.match_id] = p;
      this.predictions.set(map);
    } catch (e) {
      console.error('MatchesService.load', e);
    } finally {
      this.loading.set(false);
    }
  }

  /** Combine a match with the current user's prediction + an `is_open` flag. */
  decorate(match: Match, isOpen: boolean): MatchWithPrediction {
    const p = this.predictions()[match.id];
    return {
      ...match,
      my_home: p?.home_score ?? null,
      my_away: p?.away_score ?? null,
      my_points: p?.points_awarded ?? null,
      is_open: isOpen
    };
  }

  /** Live updates: match status / score changes (and fresh points) push into the signals. */
  subscribeLive(onChange?: () => void) {
    const channel = this.sb.client
      .channel('matches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        clearTimeout(this.reloadTimer);
        this.reloadTimer = setTimeout(async () => {
          await Promise.all([this.reloadMatchesOnly(), this.reloadPredictionsOnly()]);
          onChange?.();
        }, 500);
      })
      .subscribe();
    return () => {
      clearTimeout(this.reloadTimer);
      void this.sb.client.removeChannel(channel);
    };
  }

  private async reloadMatchesOnly() {
    const { data, error } = await this.sb.client
      .from('matches')
      .select(MATCH_SELECT)
      .order('kickoff_at', { ascending: true });
    if (!error) this.matches.set((data ?? []) as Match[]);
  }

  private async reloadPredictionsOnly() {
    const uid = this.auth.user()?.id;
    if (!uid) return;
    const { data, error } = await this.sb.client
      .from('predictions')
      .select('*')
      .eq('user_id', uid);
    if (error) return;
    const map: Record<string, Prediction> = {};
    for (const p of (data ?? []) as Prediction[]) map[p.match_id] = p;
    this.predictions.set(map);
  }
}
