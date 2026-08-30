import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { OutrightPrediction, Team } from './models';

@Injectable({ providedIn: 'root' })
export class OutrightService {
  private readonly sb = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  readonly teams = signal<Team[]>([]);
  readonly myPick = signal<OutrightPrediction | null>(null);
  readonly loading = signal(false);

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const uid = this.auth.user()?.id;
      const [teamsRes, pickRes] = await Promise.all([
        this.sb.client.from('teams').select('*').order('name', { ascending: true }),
        uid
          ? this.sb.client
              .from('outright_predictions')
              .select('*')
              .eq('user_id', uid)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null })
      ]);
      if (teamsRes.error) throw teamsRes.error;
      this.teams.set((teamsRes.data ?? []) as Team[]);
      if (pickRes.error) throw pickRes.error;
      this.myPick.set((pickRes.data as OutrightPrediction) ?? null);
    } catch (e) {
      console.error('OutrightService.load', e);
    } finally {
      this.loading.set(false);
    }
  }

  async setPick(teamId: string): Promise<void> {
    const uid = this.auth.user()?.id;
    if (!uid) throw new Error('Not signed in.');
    const { data, error } = await this.sb.client
      .from('outright_predictions')
      .upsert({ user_id: uid, team_id: teamId }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    this.myPick.set(data as OutrightPrediction);
  }
}
