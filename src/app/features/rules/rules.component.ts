import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OUTRIGHT_POINTS, SCORING_RULES } from '../../core/models';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl">
      <h1 class="font-display text-2xl font-extrabold">How it works</h1>
      <p class="mt-1 text-sm text-slate-400">
        Predict scorelines, call the tournament winner, and rack up points. Highest matching rule
        always wins — the rules below are checked from the top down.
      </p>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">Match scoring</h2>
      <div class="mt-3 space-y-3">
        @for (rule of rules; track rule.points) {
          <div class="card flex items-start gap-4 p-4">
            <span
              class="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black"
              [class]="badge(rule.points)"
            >
              {{ rule.points }}
            </span>
            <div>
              <p class="font-semibold">{{ rule.title }}</p>
              <p class="mt-0.5 text-sm text-slate-400">{{ rule.example }}</p>
            </div>
          </div>
        }
      </div>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">Outright winner</h2>
      <div class="card mt-3 p-4 text-sm text-slate-300">
        Before the first match kicks off, pick the team you think will lift the trophy. A correct call
        is worth <strong class="text-pitch-300">{{ outrightPoints }} points</strong>. Once the
        tournament starts, your pick is locked.
      </div>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">Game phases</h2>
      <ol class="mt-3 space-y-3">
        <li class="card p-4 text-sm text-slate-300">
          <strong class="text-slate-100">1 · Pre-tournament.</strong> Only the outright winner market
          is open. Match betting is closed.
        </li>
        <li class="card p-4 text-sm text-slate-300">
          <strong class="text-slate-100">2 · Group stage.</strong> Predictions open for all group
          matches. Each match locks at kickoff.
        </li>
        <li class="card p-4 text-sm text-slate-300">
          <strong class="text-slate-100">3 · Knockout stage.</strong> When the group stage ends,
          betting unlocks for the Round of 16, Quarter-finals, Semi-finals and Final as the draws are
          confirmed.
        </li>
      </ol>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">Good to know</h2>
      <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
        <li>A prediction can be edited as many times as you like until kickoff.</li>
        <li>Scores and match statuses update automatically from the fixtures feed.</li>
        <li>Points are awarded within seconds of a match being marked <em>finished</em>.</li>
        <li>The leaderboard ranks by total points; ties share a rank.</li>
      </ul>

      <div class="mt-8 flex gap-3">
        <a routerLink="/" class="btn-primary">Start predicting</a>
        <a routerLink="/leaderboard" class="btn-ghost">See the leaderboard</a>
      </div>
    </div>
  `
})
export class RulesComponent {
  readonly rules = SCORING_RULES;
  readonly outrightPoints = OUTRIGHT_POINTS;

  badge(points: number): string {
    switch (points) {
      case 5:
        return 'bg-emerald-400/15 text-emerald-300';
      case 3:
        return 'bg-pitch-400/15 text-pitch-300';
      case 2:
        return 'bg-lime-400/15 text-lime-300';
      case 1:
        return 'bg-sky-400/15 text-sky-300';
      default:
        return 'bg-white/5 text-slate-400';
    }
  }
}
