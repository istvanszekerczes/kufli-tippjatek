import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { AdminService } from '../../core/admin.service';
import { TournamentService } from '../../core/tournament.service';
import { OutrightService } from '../../core/outright.service';
import {
  Match,
  MatchStatus,
  OUTRIGHT_POINTS,
  STAGE_LABEL,
  TournamentConfig
} from '../../core/models';

interface EditRow {
  match: Match;
  home: number | null;
  away: number | null;
  status: MatchStatus;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5">
      <h1 class="font-display text-2xl font-extrabold">Admin console</h1>
      <p class="mt-1 text-sm text-slate-400">
        Control game phases and enter results. Marking a match <em>finished</em> scores every
        prediction instantly; setting the champion awards the outright points.
      </p>
    </div>

    @if (toast(); as t) {
      <div class="mb-4 rounded-xl border px-4 py-2.5 text-sm"
        [class]="t.ok ? 'border-pitch-400/30 bg-pitch-400/10 text-pitch-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'">
        {{ t.msg }}
      </div>
    }

    <!-- phase controls -->
    <section class="card mb-6 p-5">
      <h2 class="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">Game phases</h2>
      @if (cfg(); as c) {
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" class="h-4 w-4 accent-pitch-500"
              [ngModel]="c.outright_betting" (ngModelChange)="patch({ outright_betting: $event })" />
            Outright market open
          </label>
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" class="h-4 w-4 accent-pitch-500"
              [ngModel]="c.group_stage_betting" (ngModelChange)="patch({ group_stage_betting: $event })" />
            Group-stage betting
          </label>
          <label class="flex items-center gap-3 text-sm">
            <input type="checkbox" class="h-4 w-4 accent-pitch-500"
              [ngModel]="c.knockout_betting" (ngModelChange)="patch({ knockout_betting: $event })" />
            Knockout betting
          </label>
        </div>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="deadline">Outright deadline</label>
            <input id="deadline" type="datetime-local" class="input"
              [ngModel]="toLocalInput(c.outright_deadline)"
              (ngModelChange)="patch({ outright_deadline: fromLocalInput($event) })" />
          </div>
          <div>
            <label class="label" for="champ">Champion (awards {{ outrightPoints }} pts)</label>
            <select id="champ" class="input"
              [ngModel]="c.champion_team_id ?? ''" (ngModelChange)="setChampion($event)">
              <option value="">— not decided —</option>
              @for (t of outright.teams(); track t.id) {
                <option [value]="t.id">{{ t.name }}</option>
              }
            </select>
          </div>
        </div>
      } @else {
        <app-loading-spinner label="Loading config…" />
      }
    </section>

    <!-- results -->
    <section class="card p-5">
      <h2 class="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">Fixtures &amp; results</h2>
      @if (loading()) {
        <app-loading-spinner label="Loading fixtures…" />
      } @else {
        <div class="space-y-2">
          @for (row of rows(); track row.match.id) {
            <div class="grid grid-cols-1 items-center gap-2 rounded-xl border border-white/10 bg-night-950/40 p-3 sm:grid-cols-[1fr_auto_auto]">
              <div class="text-sm">
                <span class="font-semibold">{{ name(row.match, 'home') }} v {{ name(row.match, 'away') }}</span>
                <span class="ml-2 text-xs text-slate-500">
                  {{ stage(row.match) }} · {{ date(row.match) }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <input type="number" min="0" max="99" class="score-input !h-10 !w-14"
                  [(ngModel)]="row.home" [name]="'h' + row.match.id" />
                <span class="text-slate-500">–</span>
                <input type="number" min="0" max="99" class="score-input !h-10 !w-14"
                  [(ngModel)]="row.away" [name]="'a' + row.match.id" />
                <select class="input !w-36 !py-2" [(ngModel)]="row.status" [name]="'s' + row.match.id">
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="finished">Finished</option>
                </select>
              </div>
              <button class="btn-primary !py-2" [disabled]="busyId() === row.match.id" (click)="save(row)">
                Save
              </button>
            </div>
          }
        </div>
      }
    </section>
  `
})
export class AdminComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly tournament = inject(TournamentService);
  readonly outright = inject(OutrightService);

  readonly outrightPoints = OUTRIGHT_POINTS;
  readonly loading = signal(true);
  readonly busyId = signal<string | null>(null);
  readonly toast = signal<{ ok: boolean; msg: string } | null>(null);
  readonly rows = signal<EditRow[]>([]);

  readonly cfg = computed(() => this.tournament.config());

  async ngOnInit(): Promise<void> {
    await Promise.all([this.tournament.refresh(), this.outright.load(), this.reload()]);
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const matches = await this.admin.allMatches();
      this.rows.set(
        matches.map((m) => ({
          match: m,
          home: m.home_score,
          away: m.away_score,
          status: m.status
        }))
      );
    } catch (e: any) {
      this.flash(false, e?.message ?? 'Could not load fixtures.');
    } finally {
      this.loading.set(false);
    }
  }

  async patch(p: Partial<TournamentConfig>): Promise<void> {
    try {
      await this.admin.updateConfig(p);
      await this.tournament.refresh();
      this.flash(true, 'Config updated.');
    } catch (e: any) {
      this.flash(false, e?.message ?? 'Update failed.');
    }
  }

  async setChampion(teamId: string): Promise<void> {
    try {
      await this.admin.setChampion(teamId || null);
      await this.tournament.refresh();
      this.flash(true, teamId ? 'Champion set — outright points awarded.' : 'Champion cleared.');
    } catch (e: any) {
      this.flash(false, e?.message ?? 'Update failed.');
    }
  }

  async save(row: EditRow): Promise<void> {
    this.busyId.set(row.match.id);
    try {
      await this.admin.setResult(row.match.id, row.home, row.away, row.status);
      this.flash(
        true,
        row.status === 'finished' ? 'Result saved — predictions scored.' : 'Match updated.'
      );
      await this.reload();
    } catch (e: any) {
      this.flash(false, e?.message ?? 'Save failed.');
    } finally {
      this.busyId.set(null);
    }
  }

  name(m: Match, side: 'home' | 'away'): string {
    const t = side === 'home' ? m.home_team : m.away_team;
    return t?.name || 'TBD';
  }
  stage(m: Match): string {
    return STAGE_LABEL[m.stage];
  }
  date(m: Match): string {
    return new Date(m.kickoff_at).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  toLocalInput(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  fromLocalInput(v: string): string | null {
    return v ? new Date(v).toISOString() : null;
  }

  private flash(ok: boolean, msg: string): void {
    this.toast.set({ ok, msg });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
