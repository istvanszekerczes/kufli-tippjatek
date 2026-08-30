import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { LeaderboardRow } from './models';

export interface StandingsSnapshot {
  as_of: string;
  total_points: number;
  rank: number;
}

@Injectable({ providedIn: 'root' })
export class LeaderboardService {
  private readonly sb = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly rows = signal<LeaderboardRow[]>([]);
  readonly me = signal<LeaderboardRow | null>(null);
  readonly loading = signal(false);

  private reloadTimer?: ReturnType<typeof setTimeout>;

  /** Lightweight single-row fetch used by the navbar points chip. */
  async loadMe(): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) {
      this.me.set(null);
      return;
    }
    const { data, error } = await this.sb.client
      .from('leaderboard')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (!error) this.me.set((data as LeaderboardRow) ?? null);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.sb.client
        .from('leaderboard')
        .select('*')
        .order('rank', { ascending: true });
      if (error) throw error;
      this.rows.set((data ?? []) as LeaderboardRow[]);
      const uid = this.auth.user()?.id;
      if (uid) this.me.set(this.rows().find((r) => r.user_id === uid) ?? this.me());
    } catch (e) {
      console.error('LeaderboardService.load', e);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Re-fetch (debounced) whenever a result lands. We listen on `matches` and
   * `tournament_config` — not `predictions` — because Row Level Security means
   * a client only receives realtime events for its *own* prediction rows, so
   * other players' scoring would otherwise go unnoticed. A finished match /
   * new champion is the true trigger for standings changing.
   */
  subscribeLive() {
    const bump = () => {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => void this.load(), 800);
    };
    const channel = this.sb.client
      .channel('leaderboard-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, bump)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tournament_config' },
        bump
      )
      .subscribe();
    return () => {
      clearTimeout(this.reloadTimer);
      void this.sb.client.removeChannel(channel);
    };
  }

  rankFor(userId: string | undefined): LeaderboardRow | null {
    if (!userId) return null;
    return this.rows().find((r) => r.user_id === userId) ?? null;
  }

  /** Daily rank/points history for a user, oldest first. Empty if the table isn't there yet. */
  async snapshots(userId?: string): Promise<StandingsSnapshot[]> {
    const uid = userId ?? this.auth.user()?.id;
    if (!uid) return [];
    const { data, error } = await this.sb.client
      .from('standings_snapshots')
      .select('as_of, total_points, rank')
      .eq('user_id', uid)
      .order('as_of', { ascending: true });
    if (error) return [];
    return (data ?? []) as StandingsSnapshot[];
  }
}
