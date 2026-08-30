import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output
} from '@angular/core';
import { CountdownComponent } from './countdown.component';
import { TeamCrestComponent } from './team-crest.component';
import { MatchWithPrediction, STAGE_LABEL, Team } from '../../core/models';

@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [CountdownComponent, TeamCrestComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card animate-fade-in p-4 sm:p-5">
      <!-- header -->
      <div class="mb-3 flex items-center justify-between gap-2 text-xs">
        <span class="chip text-slate-300">
          {{ stageLabel() }}@if (m().round) { · {{ m().round }} }
          @if (m().stage === 'group' && m().matchday) { · MD{{ m().matchday }} }
        </span>

        @switch (m().status) {
          @case ('live') {
            <span class="chip border-rose-500/40 bg-rose-500/10 text-rose-300">
              <span class="h-1.5 w-1.5 animate-pulse-live rounded-full bg-rose-400"></span> LIVE
            </span>
          }
          @case ('finished') {
            <span class="chip border-white/10 bg-white/5 text-slate-400">Full time</span>
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
            <div class="text-2xl font-black text-slate-600">vs</div>
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
          <div class="flex items-center justify-center gap-3">
            <span class="label mb-0 hidden sm:block">Your pick</span>
            <input
              type="number"
              min="0"
              max="99"
              inputmode="numeric"
              class="score-input"
              [value]="home() ?? ''"
              (input)="home.set(clamp($any($event.target).value))"
              [attr.aria-label]="'Predicted goals for ' + name(m().home_team)"
            />
            <span class="text-lg font-bold text-slate-500">–</span>
            <input
              type="number"
              min="0"
              max="99"
              inputmode="numeric"
              class="score-input"
              [value]="away() ?? ''"
              (input)="away.set(clamp($any($event.target).value))"
              [attr.aria-label]="'Predicted goals for ' + name(m().away_team)"
            />
            <button class="btn-primary" [disabled]="!canSave() || busy()" (click)="emitSave()">
              {{ hasPick() ? 'Update' : 'Submit' }}
            </button>
          </div>
        } @else {
          <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span class="text-slate-400">
              @if (hasPick()) {
                Your pick:
                <strong class="text-slate-100">{{ m().my_home }}–{{ m().my_away }}</strong>
              } @else {
                <span class="italic text-slate-500">No prediction submitted</span>
              }
            </span>

            @if (m().status === 'finished' && m().my_points !== null) {
              <span class="chip font-bold" [class]="pointsCls(m().my_points!)">
                +{{ m().my_points }} pt{{ m().my_points === 1 ? '' : 's' }}
              </span>
            } @else if (m().status !== 'finished') {
              <span class="chip text-slate-500">
                {{ lockReason() }}
              </span>
            }
          </div>
        }
      </div>
    </article>
  `
})
export class MatchCardComponent {
  readonly m = input.required<MatchWithPrediction>();
  readonly busy = input(false);
  readonly save = output<{ home: number; away: number }>();

  readonly home = linkedSignal<number | null>(() => this.m().my_home);
  readonly away = linkedSignal<number | null>(() => this.m().my_away);

  readonly hasPick = computed(() => this.m().my_home !== null && this.m().my_away !== null);
  readonly stageLabel = computed(() => STAGE_LABEL[this.m().stage]);

  readonly canSave = computed(() => {
    const h = this.home();
    const a = this.away();
    if (h === null || a === null) return false;
    if (h < 0 || a < 0 || h > 99 || a > 99) return false;
    return h !== this.m().my_home || a !== this.m().my_away || !this.hasPick();
  });

  clamp(v: string): number | null {
    if (v === '' || v === null || v === undefined) return null;
    const n = Math.floor(Number(v));
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(99, n));
  }

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
    if (m.status !== 'upcoming') return 'Betting closed';
    if (new Date(m.kickoff_at).getTime() <= Date.now()) return 'Kickoff passed';
    return m.stage === 'group' ? 'Group betting not open' : 'Knockout betting not open yet';
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
