import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  signal
} from '@angular/core';
import { Team } from '../../core/models';

/**
 * Team badge with a graceful fallback. If the crest URL is missing, or the
 * image fails to load (UEFA's CDN is occasionally flaky / blocked by privacy
 * extensions), it retries a couple of times and then shows the team's initials
 * instead of a broken-image icon.
 */
@Component({
  selector: 'app-team-crest',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10"
      [class]="boxCls()"
    >
      @if (src() && !broken()) {
        <img
          [src]="src()"
          [alt]="label()"
          (error)="onError()"
          loading="lazy"
          referrerpolicy="no-referrer"
          class="object-contain"
          [class]="imgCls()"
        />
      } @else {
        <span class="font-bold text-slate-300" [class]="textCls()">{{ initials() }}</span>
      }
    </span>
  `
})
export class TeamCrestComponent {
  readonly team = input<Team | null | undefined>(null);
  /** overrides, e.g. from a joined row that isn't a full Team */
  readonly name = input<string | null>(null);
  readonly crestUrl = input<string | null>(null);
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  private readonly attempt = signal(0);

  /** reset when the team / URL changes (cards are reused as the list updates) */
  readonly broken = linkedSignal(() => {
    this.crestUrl();
    this.team();
    this.attempt.set(0);
    return false;
  });

  private readonly url = computed(() => this.crestUrl() || this.team()?.crest_url || null);

  /** a throwaway query param on retry forces the browser to actually re-fetch */
  readonly src = computed(() => {
    const u = this.url();
    if (!u) return null;
    if (this.attempt() === 0) return u;
    return u + (u.includes('?') ? '&' : '?') + '_r=' + this.attempt();
  });

  readonly label = computed(() => this.name() || this.team()?.name || 'TBD');

  readonly initials = computed(() => {
    const n = this.name() || this.team()?.name;
    if (!n) return '?';
    return n
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  });

  onError(): void {
    if (this.attempt() < 2) this.attempt.update((n) => n + 1);
    else this.broken.set(true);
  }

  readonly boxCls = computed(
    () => ({ sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-14 w-14' })[this.size()]
  );
  readonly imgCls = computed(
    () => ({ sm: 'h-6 w-6', md: 'h-9 w-9', lg: 'h-10 w-10' })[this.size()]
  );
  readonly textCls = computed(
    () => ({ sm: 'text-[11px]', md: 'text-sm', lg: 'text-base' })[this.size()]
  );
}
