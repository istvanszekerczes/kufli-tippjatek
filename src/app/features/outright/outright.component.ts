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
import { OutrightService } from '../../core/outright.service';
import { TournamentService } from '../../core/tournament.service';
import { OUTRIGHT_POINTS, Team } from '../../core/models';

@Component({
  selector: 'app-outright',
  standalone: true,
  imports: [LoadingSpinnerComponent, CountdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5">
      <h1 class="font-display text-2xl font-extrabold">Outright winner</h1>
      <p class="mt-1 text-sm text-slate-400">
        Call the Champions League winner before the tournament starts. Get it right for
        <strong class="text-pitch-300">{{ points }} points</strong>.
      </p>
    </div>

    @if (outright.loading() && outright.teams().length === 0) {
      <app-loading-spinner label="Loading teams…" />
    } @else {
      <div class="card mb-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        @if (champion(); as champ) {
          <p class="text-sm">
            🏆 Champions: <strong class="text-pitch-300">{{ champ.name }}</strong> —
            @if (myPickCorrect()) {
              <span class="text-pitch-300">you nailed it, +{{ points }} pts!</span>
            } @else {
              <span class="text-slate-400">better luck next season.</span>
            }
          </p>
        } @else if (tournament.outrightOpen) {
          <p class="text-sm text-slate-300">
            @if (deadline()) {
              Picks lock <app-countdown [target]="deadline()!" prefix="in " class="font-semibold text-pitch-300" />
            } @else {
              Picks are open.
            }
          </p>
        } @else {
          <p class="text-sm text-slate-400">🔒 Outright picks are locked.</p>
        }

        @if (myTeam(); as t) {
          <span class="chip border-pitch-400/30 bg-pitch-400/10 text-pitch-200">
            Your pick: <strong>{{ t.name }}</strong>
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
            <div class="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
              @if (t.crest_url) {
                <img [src]="t.crest_url" [alt]="t.name" class="h-10 w-10 object-contain" />
              } @else {
                <span class="text-base font-bold text-slate-300">{{ initials(t) }}</span>
              }
            </div>
            <span class="text-sm font-semibold leading-tight">{{ t.name }}</span>
            @if (t.group_label) {
              <span class="text-[11px] text-slate-500">Group {{ t.group_label }}</span>
            }
            @if (selectedId() === t.id) {
              <span class="chip border-pitch-400/40 bg-pitch-400/10 text-pitch-300">✓ Selected</span>
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
      this.message.set(`Locked in: ${t.name} to win it all.`);
      setTimeout(() => this.message.set(''), 4000);
    } catch (e: any) {
      this.message.set(e?.message ?? 'Could not save pick.');
    } finally {
      this.busyId.set(null);
    }
  }

  initials(t: Team): string {
    return t.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }
}
