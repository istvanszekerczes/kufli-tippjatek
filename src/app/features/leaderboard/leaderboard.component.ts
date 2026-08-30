import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject
} from '@angular/core';
import { RankBadgeComponent } from '../../shared/components/rank-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { LeaderboardService } from '../../core/leaderboard.service';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [RankBadgeComponent, LoadingSpinnerComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 class="font-display text-2xl font-extrabold">{{ 'lb.title' | t }}</h1>
        <p class="mt-1 text-sm text-slate-400">{{ 'lb.sub' | t }}</p>
      </div>
      <span class="chip">{{ 'lb.players' | t: { n: lb.rows().length } }}</span>
    </div>

    @if (lb.loading() && lb.rows().length === 0) {
      <app-loading-spinner [label]="'lb.loading' | t" />
    } @else if (lb.rows().length === 0) {
      <div class="card p-10 text-center text-slate-400">{{ 'lb.empty' | t }}</div>
    } @else {
      <!-- podium -->
      @if (podium().length === 3) {
        <div class="mb-6 grid grid-cols-3 gap-3">
          @for (p of podium(); track p.user_id) {
            <div
              class="card flex flex-col items-center gap-1 p-4 text-center"
              [class]="p.user_id === myId() ? 'border-pitch-400/50 shadow-glow' : ''"
              [style.order]="p.rank === 1 ? 2 : p.rank === 2 ? 1 : 3"
            >
              <span class="text-2xl">{{ p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉' }}</span>
              <span class="max-w-full truncate text-sm font-semibold">{{ p.username }}</span>
              <span class="text-lg font-black tabular-nums text-pitch-300">{{ p.total_points }}</span>
              <span class="text-[11px] text-slate-500">{{ p.exact_hits }} {{ 'lb.exact' | t }}</span>
            </div>
          }
        </div>
      }

      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="px-3 py-3 text-left">#</th>
              <th class="px-3 py-3 text-left">{{ 'lb.player' | t }}</th>
              <th class="hidden px-3 py-3 text-right sm:table-cell">{{ 'lb.scored' | t }}</th>
              <th class="hidden px-3 py-3 text-right sm:table-cell">{{ 'lb.exact' | t }}</th>
              <th class="px-3 py-3 text-right">{{ 'lb.points' | t }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">
            @for (row of lb.rows(); track row.user_id) {
              <tr [class]="row.user_id === myId() ? 'bg-pitch-400/10' : 'hover:bg-white/[0.03]'">
                <td class="px-3 py-3"><app-rank-badge [rank]="row.rank" /></td>
                <td class="px-3 py-3 font-semibold">
                  {{ row.username }}
                  @if (row.user_id === myId()) {
                    <span class="ml-1 text-xs font-normal text-pitch-300">({{ 'c.you' | t }})</span>
                  }
                </td>
                <td class="hidden px-3 py-3 text-right tabular-nums text-slate-400 sm:table-cell">
                  {{ row.matches_scored }}
                </td>
                <td class="hidden px-3 py-3 text-right tabular-nums text-slate-400 sm:table-cell">
                  {{ row.exact_hits }}
                </td>
                <td class="px-3 py-3 text-right text-base font-black tabular-nums text-pitch-300">
                  {{ row.total_points }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  readonly lb = inject(LeaderboardService);
  private readonly auth = inject(AuthService);

  readonly myId = computed(() => this.auth.user()?.id ?? null);
  readonly podium = computed(() => this.lb.rows().filter((r) => r.rank <= 3).slice(0, 3));

  private unsub?: () => void;

  async ngOnInit(): Promise<void> {
    await this.lb.load();
    this.unsub = this.lb.subscribeLive();
  }

  ngOnDestroy(): void {
    this.unsub?.();
  }
}
