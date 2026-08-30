import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A compact goal-count picker: [ − | n | + ]. Uses a text input with a numeric
 * keyboard so there are no ugly native number spinners.
 */
@Component({
  selector: 'app-score-stepper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-night-950/70">
      <button
        type="button"
        tabindex="-1"
        class="grid w-9 place-items-center text-xl leading-none text-slate-400 transition hover:bg-white/10 hover:text-white active:bg-white/20 disabled:opacity-25"
        [disabled]="(value() ?? 0) <= 0"
        (click)="bump(-1)"
        aria-label="one fewer goal"
      >
        −
      </button>
      <input
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="2"
        class="h-11 w-10 border-x border-white/10 bg-transparent text-center text-lg font-bold text-slate-100 focus:bg-white/5 focus:outline-none"
        [value]="value() ?? ''"
        (input)="onInput($event)"
        (focus)="select($event)"
        [attr.aria-label]="ariaLabel()"
      />
      <button
        type="button"
        tabindex="-1"
        class="grid w-9 place-items-center text-xl leading-none text-slate-400 transition hover:bg-white/10 hover:text-white active:bg-white/20 disabled:opacity-25"
        [disabled]="(value() ?? 0) >= 30"
        (click)="bump(1)"
        aria-label="one more goal"
      >
        +
      </button>
    </div>
  `
})
export class ScoreStepperComponent {
  readonly value = input<number | null>(null);
  readonly ariaLabel = input('Predicted goals');
  readonly valueChange = output<number | null>();

  bump(delta: number): void {
    this.valueChange.emit(this.clamp((this.value() ?? 0) + delta));
  }

  onInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '');
    this.valueChange.emit(raw === '' ? null : this.clamp(parseInt(raw, 10)));
  }

  select(e: Event): void {
    (e.target as HTMLInputElement).select();
  }

  private clamp(n: number): number | null {
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(99, n));
  }
}
