import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OUTRIGHT_POINTS } from '../../core/models';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl">
      <h1 class="font-display text-2xl font-extrabold">{{ 'rules.title' | t }}</h1>
      <p class="mt-1 text-sm text-slate-400">{{ 'rules.intro' | t }}</p>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">{{ 'rules.matchScoring' | t }}</h2>
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
              <p class="font-semibold">{{ 'rules.r' + rule.points + '.title' | t }}</p>
              <p class="mt-0.5 text-sm text-slate-400">{{ 'rules.r' + rule.points + '.ex' | t }}</p>
            </div>
          </div>
        }
      </div>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">{{ 'rules.outrightTitle' | t }}</h2>
      <div class="card mt-3 p-4 text-sm text-slate-300">
        {{ 'rules.outrightBody' | t: { n: outrightPoints } }}
      </div>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">{{ 'rules.phasesTitle' | t }}</h2>
      <ol class="mt-3 space-y-3">
        <li class="card p-4 text-sm text-slate-300">{{ 'rules.phase1' | t }}</li>
        <li class="card p-4 text-sm text-slate-300">{{ 'rules.phase2' | t }}</li>
        <li class="card p-4 text-sm text-slate-300">{{ 'rules.phase3' | t }}</li>
      </ol>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-400">{{ 'rules.gtkTitle' | t }}</h2>
      <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
        <li>{{ 'rules.gtk1' | t }}</li>
        <li>{{ 'rules.gtk2' | t }}</li>
        <li>{{ 'rules.gtk3' | t }}</li>
        <li>{{ 'rules.gtk4' | t }}</li>
        <li>{{ 'rules.gtk5' | t }}</li>
      </ul>

      <div class="mt-8 flex gap-3">
        <a routerLink="/" class="btn-primary">{{ 'rules.startPredicting' | t }}</a>
        <a routerLink="/leaderboard" class="btn-ghost">{{ 'rules.seeLeaderboard' | t }}</a>
      </div>
    </div>
  `
})
export class RulesComponent {
  readonly rules = [{ points: 5 }, { points: 3 }, { points: 2 }, { points: 1 }, { points: 0 }];
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
