import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RankBadgeComponent } from '../../shared/components/rank-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { AuthService } from '../../core/auth.service';
import { LeaderboardService } from '../../core/leaderboard.service';
import { OutrightService } from '../../core/outright.service';
import {
  PredictionsService,
  PredictionHistoryRow
} from '../../core/predictions.service';
import { STAGE_LABEL, OUTRIGHT_POINTS } from '../../core/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterLink, RankBadgeComponent, LoadingSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex items-center gap-4">
      <span class="grid h-16 w-16 place-items-center rounded-2xl bg-pitch-500 text-2xl font-black text-night-950">
        {{ initial() }}
      </span>
      <div>
        <h1 class="font-display text-2xl font-extrabold">{{ auth.displayName() }}</h1>
        <p class="text-sm text-slate-400">{{ auth.user()?.email }}</p>
      </div>
    </div>

    <!-- stat cards -->
    <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4">
        <p class="label">Total points</p>
        <p class="text-3xl font-black tabular-nums text-pitch-300">{{ me()?.total_points ?? 0 }}</p>
      </div>
      <div class="card flex flex-col p-4">
        <p class="label">Leaderboard rank</p>
        @if (me()) {
          <app-rank-badge [rank]="me()!.rank" />
        } @else {
          <span class="text-slate-500">—</span>
        }
      </div>
      <div class="card p-4">
        <p class="label">Exact scores</p>
        <p class="text-3xl font-black tabular-nums">{{ exactCount() }}</p>
      </div>
      <div class="card p-4">
        <p class="label">Predictions</p>
        <p class="text-3xl font-black tabular-nums">{{ history().length }}</p>
      </div>
    </div>

    <!-- outright -->
    <div class="card mb-6 flex items-center justify-between gap-3 p-4">
      <div>
        <p class="label mb-0">Outright winner pick</p>
        @if (outrightTeam(); as t) {
          <p class="mt-1 font-semibold">
            {{ t.name }}
            @if (outright.myPick()?.points_awarded !== null) {
              <span
                class="chip ml-2"
                [class]="(outright.myPick()?.points_awarded ?? 0) > 0 ? 'border-pitch-400/40 bg-pitch-400/10 text-pitch-300' : 'text-slate-400'"
              >
                +{{ outright.myPick()?.points_awarded }} pts
              </span>
            }
          </p>
        } @else {
          <p class="mt-1 text-sm italic text-slate-500">No pick yet</p>
        }
      </div>
      <a routerLink="/outright" class="btn-ghost shrink-0">{{ outrightTeam() ? 'Change' : 'Pick' }}</a>
    </div>

    <!-- history -->
    <h2 class="mb-3 text-sm font-bold uppercase tracking-wide text-slate-400">Prediction history</h2>
    @if (loading()) {
      <app-loading-spinner label="Loading history…" />
    } @else if (history().length === 0) {
      <div class="card p-10 text-center text-slate-400">
        No predictions yet — <a routerLink="/" class="text-pitch-400 hover:underline">head to the matches</a>.
      </div>
    } @else {
      <div class="card overflow-x-auto">
        <table class="w-full min-w-[560px] text-sm">
          <thead class="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-3 text-left">Match</th>
              <th class="px-3 py-3 text-left">Stage</th>
              <th class="px-3 py-3 text-center">Your pick</th>
              <th class="px-3 py-3 text-center">Result</th>
              <th class="px-3 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            @for (row of history(); track row.prediction.id) {
              <tr class="hover:bg-white/[0.03]">
                <td class="px-3 py-3">
                  <div class="font-medium">
                    {{ teamName(row, 'home') }} <span class="text-slate-500">v</span> {{ teamName(row, 'away') }}
                  </div>
                  <div class="text-xs text-slate-500">{{ kickoff(row) }}</div>
                </td>
                <td class="px-3 py-3 text-slate-400">{{ stageLabel(row) }}</td>
                <td class="px-3 py-3 text-center font-semibold tabular-nums">
                  {{ row.prediction.home_score }}–{{ row.prediction.away_score }}
                </td>
                <td class="px-3 py-3 text-center tabular-nums">
                  @if (row.match.status === 'finished') {
                    {{ row.match.home_score }}–{{ row.match.away_score }}
                  } @else {
                    <span class="text-slate-500">{{ row.match.status }}</span>
                  }
                </td>
                <td class="px-3 py-3 text-right">
                  @if (row.prediction.points_awarded !== null) {
                    <span class="chip font-bold" [class]="pointsCls(row.prediction.points_awarded!)">
                      +{{ row.prediction.points_awarded }}
                    </span>
                  } @else {
                    <span class="text-slate-600">—</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class ProfileComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly lb = inject(LeaderboardService);
  readonly outright = inject(OutrightService);
  private readonly predictions = inject(PredictionsService);

  readonly outrightPoints = OUTRIGHT_POINTS;
  readonly loading = signal(true);
  readonly history = signal<PredictionHistoryRow[]>([]);

  readonly me = computed(() => this.lb.me());
  readonly exactCount = computed(
    () => this.history().filter((r) => r.prediction.points_awarded === 5).length
  );
  readonly outrightTeam = computed(() => {
    const id = this.outright.myPick()?.team_id;
    return id ? this.outright.teams().find((t) => t.id === id) ?? null : null;
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [rows] = await Promise.all([
        this.predictions.history(),
        this.lb.loadMe(),
        this.outright.load()
      ]);
      this.history.set(rows);
    } finally {
      this.loading.set(false);
    }
  }

  initial(): string {
    return (this.auth.displayName()[0] || 'P').toUpperCase();
  }

  teamName(row: PredictionHistoryRow, side: 'home' | 'away'): string {
    const t = side === 'home' ? row.match.home_team : row.match.away_team;
    return t?.short_name || t?.name || 'TBD';
  }

  stageLabel(row: PredictionHistoryRow): string {
    return STAGE_LABEL[row.match.stage];
  }

  kickoff(row: PredictionHistoryRow): string {
    return new Date(row.match.kickoff_at).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  pointsCls(p: number): string {
    if (p >= 5) return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300';
    if (p === 3) return 'border-pitch-400/40 bg-pitch-400/10 text-pitch-300';
    if (p === 2) return 'border-lime-400/40 bg-lime-400/10 text-lime-300';
    if (p === 1) return 'border-sky-400/40 bg-sky-400/10 text-sky-300';
    return 'border-white/10 bg-white/5 text-slate-400';
  }
}
