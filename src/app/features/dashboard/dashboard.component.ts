import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatchCardComponent } from '../../shared/components/match-card.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { MatchesService } from '../../core/matches.service';
import { TournamentService } from '../../core/tournament.service';
import { PredictionsService } from '../../core/predictions.service';
import { LeaderboardService } from '../../core/leaderboard.service';
import {
  MatchWithPrediction,
  STAGE_LABEL,
  STAGE_ORDER,
  MatchStage
} from '../../core/models';

type Filter = 'open' | 'live' | 'upcoming' | 'finished' | 'all';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatchCardComponent, LoadingSpinnerComponent, CountdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- phase banner -->
    @if (tournament.phase() === 'pre') {
      <div class="card mb-6 flex flex-col items-start gap-3 border-pitch-400/30 bg-pitch-400/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="font-display text-lg font-bold">The tournament hasn't kicked off yet</h2>
          <p class="mt-1 text-sm text-slate-400">
            Match betting opens with the group stage. For now, lock in your pick for the trophy —
            worth <strong class="text-pitch-300">15 points</strong>.
          </p>
        </div>
        <a routerLink="/outright" class="btn-primary shrink-0">Pick the winner →</a>
      </div>
    }

    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-2xl font-extrabold">Matches</h1>
        @if (nextDeadline(); as d) {
          <p class="mt-1 text-sm text-slate-400">
            Next kickoff <app-countdown [target]="d" prefix="in " class="font-semibold text-pitch-300" />
            · {{ openCount() }} match{{ openCount() === 1 ? '' : 'es' }} open for predictions
          </p>
        } @else {
          <p class="mt-1 text-sm text-slate-400">No matches are open for predictions right now.</p>
        }
      </div>

      <div class="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        @for (f of filters; track f.key) {
          <button
            class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            [class]="filter() === f.key ? 'bg-pitch-500 text-night-950' : 'text-slate-300 hover:text-white'"
            (click)="filter.set(f.key)"
          >
            {{ f.label }}
            @if (f.key === 'live' && liveCount() > 0) {
              <span class="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{{ liveCount() }}</span>
            }
          </button>
        }
      </div>
    </div>

    @if (toast(); as t) {
      <div
        class="mb-4 rounded-xl border px-4 py-2.5 text-sm"
        [class]="t.ok ? 'border-pitch-400/30 bg-pitch-400/10 text-pitch-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'"
      >
        {{ t.msg }}
      </div>
    }

    @if (matches.loading() && matches.matches().length === 0) {
      <app-loading-spinner label="Loading fixtures…" />
    } @else if (sections().length === 0) {
      <div class="card p-10 text-center text-slate-400">
        <p class="text-3xl">🗓️</p>
        <p class="mt-2 text-sm">Nothing to show for this filter yet.</p>
      </div>
    } @else {
      @for (section of sections(); track section.stage) {
        <section class="mb-8">
          <h2 class="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400">
            {{ section.label }}
            <span class="chip">{{ section.matches.length }}</span>
          </h2>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            @for (m of section.matches; track m.id) {
              <app-match-card [m]="m" [busy]="savingId() === m.id" (save)="onSave(m, $event)" />
            }
          </div>
        </section>
      }
    }
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly matches = inject(MatchesService);
  readonly tournament = inject(TournamentService);
  private readonly predictions = inject(PredictionsService);
  private readonly leaderboard = inject(LeaderboardService);

  readonly filter = signal<Filter>('open');
  readonly savingId = signal<string | null>(null);
  readonly toast = signal<{ ok: boolean; msg: string } | null>(null);

  readonly filters: { key: Filter; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'live', label: 'Live' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'finished', label: 'Finished' },
    { key: 'all', label: 'All' }
  ];

  private unsub?: () => void;
  private ticker?: ReturnType<typeof setInterval>;

  /** Ticks every 30s so matches visibly lock the moment kickoff passes. */
  private readonly nowTick = signal(0);

  readonly decorated = computed<MatchWithPrediction[]>(() => {
    this.nowTick();
    return this.matches
      .matches()
      .map((m) => this.matches.decorate(m, this.tournament.isMatchOpen(m)));
  });

  readonly openCount = computed(() => this.decorated().filter((m) => m.is_open).length);
  readonly liveCount = computed(() => this.decorated().filter((m) => m.status === 'live').length);

  readonly nextDeadline = computed(() => {
    const next = this.decorated()
      .filter((m) => m.is_open)
      .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at))[0];
    return next?.kickoff_at ?? null;
  });

  readonly sections = computed(() => {
    const f = this.filter();
    let list = this.decorated();
    if (f === 'open') list = list.filter((m) => m.is_open);
    else if (f === 'live') list = list.filter((m) => m.status === 'live');
    else if (f === 'upcoming') list = list.filter((m) => m.status === 'upcoming');
    else if (f === 'finished') list = list.filter((m) => m.status === 'finished');

    const desc = f === 'finished';
    list = [...list].sort(
      (a, b) =>
        (desc ? -1 : 1) * (+new Date(a.kickoff_at) - +new Date(b.kickoff_at))
    );

    return STAGE_ORDER.map((stage: MatchStage) => ({
      stage,
      label: STAGE_LABEL[stage],
      matches: list.filter((m) => m.stage === stage)
    })).filter((s) => s.matches.length > 0);
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.tournament.refresh(), this.matches.load()]);
    this.unsub = this.matches.subscribeLive();
    this.ticker = setInterval(() => this.nowTick.update((n) => n + 1), 30_000);
  }

  ngOnDestroy(): void {
    this.unsub?.();
    if (this.ticker) clearInterval(this.ticker);
  }

  async onSave(m: MatchWithPrediction, pick: { home: number; away: number }): Promise<void> {
    this.savingId.set(m.id);
    this.toast.set(null);
    try {
      const saved = await this.predictions.submit(m.id, pick.home, pick.away);
      this.matches.predictions.update((map) => ({ ...map, [m.id]: saved }));
      this.flash(true, `Prediction saved: ${pick.home}–${pick.away}`);
      void this.leaderboard.loadMe();
    } catch (e: any) {
      const msg = /row-level security|violates|policy/i.test(e?.message ?? '')
        ? 'Betting is closed for this match.'
        : e?.message ?? 'Could not save prediction.';
      this.flash(false, msg);
    } finally {
      this.savingId.set(null);
    }
  }

  private flash(ok: boolean, msg: string): void {
    this.toast.set({ ok, msg });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
