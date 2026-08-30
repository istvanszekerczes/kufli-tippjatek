import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Match, MatchStage, TournamentConfig } from './models';

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private readonly sb = inject(SupabaseService);

  readonly config = signal<TournamentConfig | null>(null);
  readonly loaded = signal(false);

  readonly phase = computed<'pre' | 'group' | 'knockout' | 'done'>(() => {
    const c = this.config();
    if (!c) return 'pre';
    if (c.champion_team_id) return 'done';
    if (c.knockout_betting) return 'knockout';
    if (c.group_stage_betting) return 'group';
    return 'pre';
  });

  async refresh(): Promise<void> {
    const { data, error } = await this.sb.client
      .from('tournament_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error) {
      console.error('tournament config', error);
      return;
    }
    this.config.set(data as TournamentConfig);
    this.loaded.set(true);
  }

  /** Mirrors the server-side `is_match_open()` used by Row Level Security. */
  isMatchOpen(match: Pick<Match, 'stage' | 'status' | 'kickoff_at'>): boolean {
    const c = this.config();
    if (!c) return false;
    if (match.status !== 'upcoming') return false;
    if (new Date(match.kickoff_at).getTime() <= Date.now()) return false;
    return this.isStageOpen(match.stage);
  }

  isStageOpen(stage: MatchStage): boolean {
    const c = this.config();
    if (!c) return false;
    return stage === 'group' ? c.group_stage_betting : c.knockout_betting;
  }

  get outrightOpen(): boolean {
    const c = this.config();
    if (!c || !c.outright_betting) return false;
    if (c.outright_deadline && new Date(c.outright_deadline).getTime() <= Date.now()) return false;
    return true;
  }
}
