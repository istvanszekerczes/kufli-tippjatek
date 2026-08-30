import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { TeamCrestComponent } from '../../shared/components/team-crest.component';
import { OutrightService } from '../../core/outright.service';
import { TournamentService } from '../../core/tournament.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { OUTRIGHT_POINTS, Team } from '../../core/models';

@Component({
  selector: 'app-outright',
  standalone: true,
  imports: [LoadingSpinnerComponent, CountdownComponent, TeamCrestComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5">
      <h1 class="font-display text-2xl font-extrabold">{{ 'or.title' | t }}</h1>
      <p class="mt-1 text-sm text-slate-400">{{ 'or.sub' | t: { n: points } }}</p>
    </div>

    @if (outright.loading() && outright.teams().length === 0) {
      <app-loading-spinner [label]="'or.loading' | t" />
    } @else {
      <div class="card mb-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        @if (champion(); as champ) {
          <p class="text-sm">
            {{ 'or.championsPre' | t }} <strong class="text-pitch-300">{{ champ.name }}</strong> —
            @if (myPickCorrect()) {
              <span class="text-pitch-300">{{ 'or.nailedIt' | t: { n: points } }}</span>
            } @else {
              <span class="text-slate-400">{{ 'or.betterLuck' | t }}</span>
            }
          </p>
        } @else if (tournament.outrightOpen) {
          <p class="text-sm text-slate-300">
            @if (deadline()) {
              {{ 'or.locksIn' | t }} <app-countdown [target]="deadline()!" class="font-semibold text-pitch-300" />
            } @else {
              {{ 'or.picksOpen' | t }}
            }
          </p>
        } @else {
          <p class="text-sm text-slate-400">{{ 'or.locked' | t }}</p>
        }

        @if (myTeam(); as t) {
          <span class="chip border-pitch-400/30 bg-pitch-400/10 text-pitch-200">
            {{ 'or.yourPick' | t }} <strong>{{ t.name }}</strong>
          </span>
        }
      </div>

      @if (message(); as msg) {
        <div class="mb-4 rounded-xl border border-pitch-400/30 bg-pitch-400/10 px-4 py-2.5 text-sm text-pitch-200">
          {{ msg }}
        </div>
      }

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        @for (t of outright.teams(); track t.id) {
          <button
            class="card flex flex-col items-center gap-2 p-4 text-center transition hover:border-pitch-400/40 hover:bg-white/[0.06] disabled:cursor-not-allowed"
            [class]="selectedId() === t.id ? 'border-pitch-400/70 shadow-glow' : ''"
            [disabled]="!canPick() || busyId() === t.id"
            (click)="choose(t)"
          >
            <app-team-crest [team]="t" size="lg" />
            <span class="text-sm font-semibold leading-tight">{{ t.name }}</span>
            @if (t.group_label) {
              <span class="text-[11px] text-slate-500">{{ 'or.group' | t: { x: t.group_label } }}</span>
            }
            @if (selectedId() === t.id) {
              <span class="chip border-pitch-400/40 bg-pitch-400/10 text-pitch-300">{{ 'or.selected' | t }}</span>
            }
          </button>
        }
      </div>
    }
  `
})
export class OutrightComponent implements OnInit {
  readonly outright = inject(OutrightService);
  readonly tournament = inject(TournamentService);
  private readonly i18n = inject(I18nService);

  readonly points = OUTRIGHT_POINTS;
  readonly busyId = signal<string | null>(null);
  readonly message = signal('');

  readonly selectedId = computed(() => this.outright.myPick()?.team_id ?? null);
  readonly myTeam = computed<Team | null>(
    () => this.outright.teams().find((t) => t.id === this.selectedId()) ?? null
  );
  readonly champion = computed<Team | null>(() => {
    const id = this.tournament.config()?.champion_team_id;
    return id ? this.outright.teams().find((t) => t.id === id) ?? null : null;
  });
  readonly myPickCorrect = computed(
    () => !!this.champion() && this.champion()!.id === this.selectedId()
  );
  readonly deadline = computed(() => this.tournament.config()?.outright_deadline ?? null);
  readonly canPick = computed(() => this.tournament.outrightOpen && !this.champion());

  async ngOnInit(): Promise<void> {
    await Promise.all([this.tournament.refresh(), this.outright.load()]);
  }

  async choose(t: Team): Promise<void> {
    if (!this.canPick()) return;
    this.busyId.set(t.id);
    this.message.set('');
    try {
      await this.outright.setPick(t.id);
      this.message.set(this.i18n.t('or.lockedInMsg', { team: t.name }));
      setTimeout(() => this.message.set(''), 4000);
    } catch (e: any) {
      this.message.set(e?.message ?? 'Could not save pick.');
    } finally {
      this.busyId.set(null);
    }
  }
}
