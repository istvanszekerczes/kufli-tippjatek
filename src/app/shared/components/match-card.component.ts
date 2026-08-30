import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal
} from '@angular/core';
import { CountdownComponent } from './countdown.component';
import { TeamCrestComponent } from './team-crest.component';
import { ScoreStepperComponent } from './score-stepper.component';
import { AuthService } from '../../core/auth.service';
import { PredictionsService, MatchPick } from '../../core/predictions.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MatchWithPrediction, Team } from '../../core/models';

@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [CountdownComponent, TeamCrestComponent, ScoreStepperComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card animate-fade-in p-4 sm:p-5">
      <!-- header -->
      <div class="mb-3 flex items-center justify-between gap-2 text-xs">
        <span class="chip text-slate-300">
          {{ stageLabel() }}@if (m().round) { · {{ m().round }} }
          @if (m().stage === 'group' && m().matchday) { · {{ 'dash.md' | t: { n: m().matchday ?? 0 } }} }
        </span>

        @switch (m().status) {
          @case ('live') {
            <span class="chip border-rose-500/40 bg-rose-500/10 text-rose-300">
              <span class="h-1.5 w-1.5 animate-pulse-live rounded-full bg-rose-400"></span> {{ 'mc.live' | t }}
            </span>
          }
          @case ('finished') {
            <span class="chip border-white/10 bg-white/5 text-slate-400">{{ 'mc.ft' | t }}</span>
          }
          @default {
            <span class="chip text-pitch-300">
              <app-countdown [target]="m().kickoff_at" />
            </span>
          }
        }
      </div>

      <!-- teams + score -->
      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <div class="flex flex-col items-center gap-2 text-center">
          <app-team-crest [team]="m().home_team" size="md" />
          <span class="text-sm font-semibold leading-tight">{{ name(m().home_team) }}</span>
        </div>

        <div class="px-1 text-center">
          @if (m().status === 'upcoming') {
            <div class="text-2xl font-black text-slate-600">{{ 'mc.vs' | t }}</div>
            <div class="mt-1 text-[11px] text-slate-500">
              {{ kickoffLabel() }}
            </div>
          } @else {
            <div class="text-3xl font-black tabular-nums">
              {{ m().home_score ?? 0 }}<span class="mx-1 text-slate-600">–</span>{{ m().away_score ?? 0 }}
            </div>
          }
        </div>

        <div class="flex flex-col items-center gap-2 text-center">
          <app-team-crest [team]="m().away_team" size="md" />
          <span class="text-sm font-semibold leading-tight">{{ name(m().away_team) }}</span>
        </div>
      </div>

      <!-- prediction row -->
      <div class="mt-4 border-t border-white/10 pt-4">
        @if (m().is_open) {
          <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
            <app-score-stepper
              [value]="home()"
              (valueChange)="home.set($event)"
              [ariaLabel]="'Predicted goals for ' + name(m().home_team)"
            />
            <span class="text-lg font-bold text-slate-500">–</span>
            <app-score-stepper
              [value]="away()"
              (valueChange)="away.set($event)"
              [ariaLabel]="'Predicted goals for ' + name(m().away_team)"
            />
            <button
              class="btn-primary w-full sm:w-auto"
              [disabled]="!canSave() || busy()"
              (click)="emitSave()"
            >
              {{ hasPick() ? ('c.update' | t) : ('c.submit' | t) }}
            </button>
          </div>
        } @else {
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span class="text-slate-400">
                @if (hasPick()) {
                  {{ 'mc.yourPick' | t }}
                  <strong class="text-slate-100">{{ m().my_home }}–{{ m().my_away }}</strong>
                } @else {
                  <span class="italic text-slate-500">{{ 'mc.noPred' | t }}</span>
                }
              </span>

              @if (m().status === 'finished' && m().my_points !== null) {
                <span class="chip font-bold" [class]="pointsCls(m().my_points!)">
                  +{{ m().my_points }} {{ 'c.pts' | t }}
                </span>
              } @else if (m().status !== 'finished') {
                <span class="chip text-slate-500">{{ lockReason() | t }}</span>
              }
            </div>

            @if (isLocked()) {
              <button
                class="flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-white"
                (click)="togglePicks()"
              >
                <span class="text-[10px]">{{ picksOpen() ? '▼' : '▶' }}</span>
                {{ 'mc.everyonesPicks' | t }}
                @if (picks()) {
                  <span class="chip !px-2 !py-0">{{ picks()!.length }}</span>
                }
              </button>

              @if (picksOpen()) {
                @if (picksLoading()) {
                  <p class="text-xs text-slate-500">{{ 'c.loading' | t }}</p>
                } @else if (sortedPicks().length === 0) {
                  <p class="text-xs italic text-slate-500">{{ 'mc.noPreds' | t }}</p>
                } @else {
                  <ul class="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-night-950/50 text-xs">
                    @for (p of sortedPicks(); track p.user_id) {
                      <li
                        class="flex items-center justify-between gap-2 px-3 py-1.5"
                        [class.text-pitch-300]="p.user_id === myId()"
                      >
                        <span class="truncate font-medium">
                          {{ p.username }}@if (p.user_id === myId()) {
                            <span class="text-slate-500"> ({{ 'c.you' | t }})</span>
                          }
                        </span>
                        <span class="flex shrink-0 items-center gap-2 tabular-nums">
                          <span class="font-bold text-slate-200">{{ p.home }}–{{ p.away }}</span>
                          @if (p.points !== null) {
                            <span class="chip !px-1.5 !py-0" [class]="pointsCls(p.points)">+{{ p.points }}</span>
                          }
                        </span>
                      </li>
                    }
                  </ul>
                }
              }
            }
          </div>
        }
      </div>
    </article>
  `
})
export class MatchCardComponent {
  private readonly auth = inject(AuthService);
  private readonly predictions = inject(PredictionsService);
  private readonly i18n = inject(I18nService);

  readonly m = input.required<MatchWithPrediction>();
  readonly busy = input(false);
  readonly save = output<{ home: number; away: number }>();

  readonly home = linkedSignal<number | null>(() => this.m().my_home);
  readonly away = linkedSignal<number | null>(() => this.m().my_away);

  readonly hasPick = computed(() => this.m().my_home !== null && this.m().my_away !== null);
  readonly stageLabel = computed(() => {
    this.i18n.lang();
    return this.i18n.t('stage.' + this.m().stage);
  });

  // --- reveal everyone's picks once the match has locked --------------------
  readonly myId = computed(() => this.auth.user()?.id ?? null);
  readonly isLocked = computed(
    () => this.m().status !== 'upcoming' || new Date(this.m().kickoff_at).getTime() <= Date.now()
  );
  readonly picksOpen = signal(false);
  readonly picks = signal<MatchPick[] | null>(null);
  readonly picksLoading = signal(false);
  readonly sortedPicks = computed(() => {
    const list = this.picks() ?? [];
    const finished = this.m().status === 'finished';
    return [...list].sort((a, b) => {
      if (finished && (b.points ?? -1) !== (a.points ?? -1)) return (b.points ?? -1) - (a.points ?? -1);
      return a.username.localeCompare(b.username);
    });
  });

  async togglePicks(): Promise<void> {
    this.picksOpen.update((v) => !v);
    if (this.picksOpen() && this.picks() === null) {
      this.picksLoading.set(true);
      try {
        this.picks.set(await this.predictions.allForMatch(this.m().id));
      } catch {
        this.picks.set([]);
      } finally {
        this.picksLoading.set(false);
      }
    }
  }

  readonly canSave = computed(() => {
    const h = this.home();
    const a = this.away();
    if (h === null || a === null) return false;
    if (h < 0 || a < 0 || h > 99 || a > 99) return false;
    return h !== this.m().my_home || a !== this.m().my_away || !this.hasPick();
  });

  emitSave(): void {
    const h = this.home();
    const a = this.away();
    if (h === null || a === null) return;
    this.save.emit({ home: h, away: a });
  }

  kickoffLabel(): string {
    return new Date(this.m().kickoff_at).toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  lockReason(): string {
    const m = this.m();
    if (m.status !== 'upcoming') return 'mc.bettingClosed';
    if (new Date(m.kickoff_at).getTime() <= Date.now()) return 'mc.kickoffPassed';
    return m.stage === 'group' ? 'mc.groupNotOpen' : 'mc.koNotOpen';
  }

  name(t?: Team | null): string {
    return t?.short_name || t?.name || 'TBD';
  }

  pointsCls(p: number): string {
    if (p >= 5) return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300';
    if (p === 3) return 'border-pitch-400/40 bg-pitch-400/10 text-pitch-300';
    if (p === 2) return 'border-lime-400/40 bg-lime-400/10 text-lime-300';
    if (p === 1) return 'border-sky-400/40 bg-sky-400/10 text-sky-300';
    return 'border-white/10 bg-white/5 text-slate-400';
  }
}
