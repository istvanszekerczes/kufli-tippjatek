import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  input,
  signal
} from '@angular/core';

@Component({
  selector: 'app-countdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class.text-rose-300]="urgent()">{{ text() }}</span>`
})
export class CountdownComponent implements OnInit, OnDestroy {
  readonly target = input.required<string>();
  readonly prefix = input('');

  private readonly now = signal(Date.now());
  private timer?: ReturnType<typeof setInterval>;

  readonly msLeft = computed(() => new Date(this.target()).getTime() - this.now());
  readonly urgent = computed(() => this.msLeft() > 0 && this.msLeft() < 60 * 60 * 1000);

  readonly text = computed(() => {
    const ms = this.msLeft();
    if (ms <= 0) return 'Kicked off';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    let out: string;
    if (d > 0) out = `${d}d ${h}h`;
    else if (h > 0) out = `${h}h ${m}m`;
    else out = `${m}m ${s % 60}s`;
    return `${this.prefix()}${out}`;
  });

  ngOnInit(): void {
    this.timer = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
