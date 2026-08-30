import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-rank-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex min-w-[2.75rem] items-center justify-center gap-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums"
      [class]="cls()"
    >
      @if (medal()) {
        <span>{{ medal() }}</span>
      }
      <span>#{{ rank() }}</span>
    </span>
  `
})
export class RankBadgeComponent {
  readonly rank = input.required<number>();

  readonly medal = computed(() => ({ 1: '🥇', 2: '🥈', 3: '🥉' })[this.rank()] ?? '');

  readonly cls = computed(() => {
    switch (this.rank()) {
      case 1:
        return 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30';
      case 2:
        return 'bg-slate-300/15 text-slate-200 ring-1 ring-slate-300/30';
      case 3:
        return 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30';
      default:
        return 'bg-white/5 text-slate-300 ring-1 ring-white/10';
    }
  });
}
