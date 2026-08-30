import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center gap-3 py-10 text-slate-400">
      <span
        class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-pitch-400"
      ></span>
      <span class="text-sm">{{ label() }}</span>
    </div>
  `
})
export class LoadingSpinnerComponent {
  readonly label = input('Loading…');
}
