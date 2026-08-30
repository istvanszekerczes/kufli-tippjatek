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
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MatchWithPrediction, STAGE_ORDER, MatchStage } from '../../core/models';

type Filter = 'todo' | 'open' | 'live' | 'upcoming' | 'finished' | 'all';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    MatchCardComponent,
    LoadingSpinnerComponent,
    CountdownComponent,
    TranslatePipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- brand masthead -->
    <header class="mb-7 flex items-center gap-4 border-b border-white/10 pb-6">
      <img
        src="/kufli-logo.png"
        alt=""
        class="h-20 w-20 shrink-0 drop-shadow-[0_6px_28px_rgba(47,181,110,0.35)] sm:h-24 sm:w-24"
      />
      <div>
        <h1 class="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
          Kufli<span class="text-pitch-400"> TippJáték</span>
        </h1>
        <p class="mt-0.5 text-sm text-slate-400">{{ 'dash.tagline' | t }}</p>
      </div>
    </header>

    <!-- missing-picks nudge -->
    @if (missingPicks() > 0 && filter() !== 'todo') {
      <button
        class="mb-4 flex w-full items-center gap-3 rounded-xl border border-flame-500/30 bg-flame-500/10 px-4 py-3 text-left text-sm text-flame-300 transition hover:bg-flame-500/15"
        (click)="filter.set('todo')"
      >
        <span class="text-lg">⚠️</span>
        <span class="flex-1">{{ 'dash.missing' | t: { n: missingPicks() } }}</span>
        <span class="chip shrink-0 border-flame-500/40 bg-flame-500/10 text-flame-200">{{ 'c.show' | t }}</span>
      </button>
    }

    <!-- phase banner -->
    @if (tournament.phase() === 'pre') {
      <div class="card mb-6 flex flex-col items-start gap-3 border-pitch-400/30 bg-pitch-400/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="font-display text-lg font-bold">{{ 'dash.preTitle' | t }}</h2>
          <p class="mt-1 text-sm text-slate-400">{{ 'dash.preBody' | t }}</p>
        </div>
        <a routerLink="/outright" class="btn-primary shrink-0">{{ 'dash.pickWinner' | t }}</a>
      </div>
    }

    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-display text-xl font-extrabold">{{ 'dash.matches' | t }}</h2>
        @if (nextDeadline(); as d) {
          <p class="mt-1 text-sm text-slate-400">
            {{ 'dash.nextKickoff' | t }}
            <app-countdown [target]="d" class="font-semibold text-pitch-300" />
            · {{ 'dash.openForPred' | t: { n: openCount() } }}
          </p>
        } @else {
          <p class="mt-1 text-sm text-slate-400">{{ 'dash.noneOpen' | t }}</p>
        }
      </div>

      <div class="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        @for (key of filterKeys; track key) {
          <button
            class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            [class]="filter() === key ? 'bg-pitch-500 text-night-950' : 'text-slate-300 hover:text-white'"
            [title]="'filter.' + key + '.hint' | t"
            (click)="filter.set(key)"
          >
            {{ 'filter.' + key | t }}
            @if (key === 'live' && liveCount() > 0) {
              <span class="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{{ liveCount() }}</span>
            }
            @if (key === 'todo' && missingPicks() > 0) {
              <span
                class="ml-1 rounded-full px-1.5 text-[10px]"
                [class]="filter() === 'todo' ? 'bg-night-950/30 text-night-950' : 'bg-flame-500 text-white'"
                >{{ missingPicks() }}</span
              >
            }
          </button>
        }
      </div>
    </div>

    <!-- narrow-down filters so you don't have to scroll -->
    <div class="mb-5 flex flex-wrap items-center gap-2">
      @if (matchdays().length) {
        <div class="no-scrollbar w-full overflow-x-auto sm:w-auto">
          <div
            class="flex w-max gap-1 rounded-xl border border-white/10 bg-white/5 p-1 sm:w-auto sm:flex-wrap"
          >
            <button
              class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition"
              [class]="matchdayFilter() === 'all' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white'"
              (click)="matchdayFilter.set('all')"
            >
              <span class="sm:hidden">{{ 'filter.all' | t }}</span>
              <span class="hidden sm:inline">{{ 'dash.allRounds' | t }}</span>
            </button>
            @for (md of matchdays(); track md) {
              <button
                class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums transition"
                [class]="matchdayFilter() === md ? 'bg-pitch-500 text-night-950' : 'text-slate-300 hover:text-white'"
                (click)="matchdayFilter.set(md)"
              >
                {{ 'dash.md' | t: { n: md } }}
              </button>
            }
          </div>
        </div>
      }

      <input
        class="input min-w-[10rem] flex-1 !py-1.5 text-xs sm:!w-auto"
        [placeholder]="'dash.filterTeam' | t"
        [value]="teamQuery()"
        (input)="teamQuery.set($any($event.target).value)"
      />

      @if (matchdayFilter() !== 'all' || teamQuery().trim()) {
        <button class="btn-ghost !px-3 !py-1.5 text-xs" (click)="clearExtra()">{{ 'c.clear' | t }}</button>
      }
      <span class="ml-auto shrink-0 text-xs text-slate-500">
        {{ 'dash.shown' | t: { n: shownCount() } }}
      </span>
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
      <app-loading-spinner [label]="'dash.loadingFixtures' | t" />
    } @else if (sections().length === 0) {
      <div class="card p-10 text-center text-slate-400">
        @if (filter() === 'todo') {
          <p class="text-3xl">🎉</p>
          <p class="mt-2 text-sm">{{ 'dash.caughtUp' | t }}</p>
        } @else {
          <p class="text-3xl">🗓️</p>
          <p class="mt-2 text-sm">{{ 'dash.nothing' | t }}</p>
        }
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
  private readonly i18n = inject(I18nService);

  readonly filter = signal<Filter>('open');
  readonly matchdayFilter = signal<number | 'all'>('all');
  readonly teamQuery = signal('');
  readonly savingId = signal<string | null>(null);
  readonly toast = signal<{ ok: boolean; msg: string } | null>(null);

  readonly filterKeys: Filter[] = ['todo', 'open', 'live', 'upcoming', 'finished', 'all'];

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
  readonly missingPicks = computed(
    () => this.decorated().filter((m) => m.is_open && m.my_home === null).length
  );

  readonly matchdays = computed(() =>
    [...new Set(this.decorated().map((m) => m.matchday).filter((n): n is number => n != null))].sort(
      (a, b) => a - b
    )
  );

  readonly shownCount = computed(() =>
    this.sections().reduce((n, s) => n + s.matches.length, 0)
  );

  readonly nextDeadline = computed(() => {
    const next = this.decorated()
      .filter((m) => m.is_open)
      .sort((a, b) => +new Date(a.kickoff_at) - +new Date(b.kickoff_at))[0];
    return next?.kickoff_at ?? null;
  });

  readonly sections = computed(() => {
    const f = this.filter();
    let list = this.decorated();
    if (f === 'todo') list = list.filter((m) => m.is_open && m.my_home === null);
    else if (f === 'open') list = list.filter((m) => m.is_open);
    else if (f === 'live') list = list.filter((m) => m.status === 'live');
    else if (f === 'upcoming') list = list.filter((m) => m.status === 'upcoming');
    else if (f === 'finished') list = list.filter((m) => m.status === 'finished');

    const md = this.matchdayFilter();
    if (md !== 'all') list = list.filter((m) => m.matchday === md);

    const q = this.teamQuery().trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        [m.home_team?.name, m.home_team?.short_name, m.away_team?.name, m.away_team?.short_name]
          .some((s) => s?.toLowerCase().includes(q))
      );
    }

    const desc = f === 'finished';
    list = [...list].sort(
      (a, b) =>
        (desc ? -1 : 1) * (+new Date(a.kickoff_at) - +new Date(b.kickoff_at))
    );

    this.i18n.lang();
    return STAGE_ORDER.map((stage: MatchStage) => ({
      stage,
      label: this.i18n.t('stage.' + stage),
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

  clearExtra(): void {
    this.matchdayFilter.set('all');
    this.teamQuery.set('');
  }

  private flash(ok: boolean, msg: string): void {
    this.toast.set({ ok, msg });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
