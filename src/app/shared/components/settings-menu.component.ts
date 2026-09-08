import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { I18nService, Lang } from '../../core/i18n/i18n.service';
import { PushService } from '../../core/push.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-settings-menu',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        class="btn-ghost grid h-9 w-9 place-items-center !p-0 text-base"
        [class.!text-pitch-400]="open()"
        (click)="open.set(!open())"
        [attr.aria-expanded]="open()"
        aria-label="Settings"
      >
        ⚙️
      </button>

      @if (open()) {
        <div class="fixed inset-0 z-40" (click)="open.set(false)"></div>
        <div
          class="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-white/10 bg-night-900 p-3 shadow-xl shadow-black/40"
        >
          <!-- language -->
          <p class="label mb-1.5">{{ 'settings.language' | t }}</p>
          <div class="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            @for (l of langs; track l) {
              <button
                class="flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition"
                [class]="
                  i18n.lang() === l ? 'bg-pitch-500 text-night-950' : 'text-slate-300 hover:text-white'
                "
                (click)="i18n.setLang(l)"
              >
                {{ l === 'hu' ? 'Magyar' : 'English' }}
              </button>
            }
          </div>

          <!-- notifications -->
          <div class="mt-3 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium">{{ 'settings.notifs' | t }}</p>
              @if (hint(); as h) {
                <p class="text-[11px] leading-tight text-slate-500">{{ h }}</p>
              }
            </div>
            <button
              role="switch"
              [attr.aria-checked]="push.enabled()"
              class="relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
              [class]="push.enabled() ? 'bg-pitch-500' : 'bg-white/15'"
              [disabled]="push.busy() || !push.supported || push.permission() === 'denied'"
              (click)="toggle()"
            >
              <span
                class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                [class]="push.enabled() ? 'left-[22px]' : 'left-0.5'"
              ></span>
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsMenuComponent {
  readonly i18n = inject(I18nService);
  readonly push = inject(PushService);
  readonly open = signal(false);
  readonly langs: Lang[] = ['hu', 'en'];

  hint(): string {
    if (this.push.iosNeedsInstall) return this.i18n.t('settings.notifsIos');
    if (!this.push.supported) return this.i18n.t('settings.notifsUnsupported');
    if (this.push.permission() === 'denied') return this.i18n.t('settings.notifsBlocked');
    return '';
  }

  async toggle(): Promise<void> {
    if (this.push.enabled()) await this.push.disable();
    else await this.push.enable();
  }
}
