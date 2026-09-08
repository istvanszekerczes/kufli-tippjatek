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
          <div class="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            @for (l of langs; track l) {
              <button
                class="rounded-md px-2 py-1.5 text-xs font-bold transition"
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
          <p class="label mb-1.5 mt-3">{{ 'settings.notifs' | t }}</p>
          <div
            class="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-white/5 p-1 transition"
            [class.pointer-events-none]="disabled()"
            [class.opacity-40]="disabled()"
          >
            <button
              class="rounded-md px-2 py-1.5 text-xs font-bold transition"
              [class]="
                !push.enabled() ? 'bg-pitch-500 text-night-950' : 'text-slate-300 hover:text-white'
              "
              (click)="setNotifs(false)"
            >
              {{ 'settings.off' | t }}
            </button>
            <button
              class="rounded-md px-2 py-1.5 text-xs font-bold transition"
              [class]="
                push.enabled() ? 'bg-pitch-500 text-night-950' : 'text-slate-300 hover:text-white'
              "
              (click)="setNotifs(true)"
            >
              {{ 'settings.on' | t }}
            </button>
          </div>
          @if (hint(); as h) {
            <p class="mt-1.5 text-[11px] leading-tight text-slate-500">{{ h }}</p>
          }
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

  disabled(): boolean {
    return this.push.busy() || !this.push.supported || this.push.permission() === 'denied';
  }

  hint(): string {
    if (this.push.iosNeedsInstall) return this.i18n.t('settings.notifsIos');
    if (!this.push.supported) return this.i18n.t('settings.notifsUnsupported');
    if (this.push.permission() === 'denied') return this.i18n.t('settings.notifsBlocked');
    return '';
  }

  async setNotifs(on: boolean): Promise<void> {
    if (on === this.push.enabled()) return;
    if (on) await this.push.enable();
    else await this.push.disable();
  }
}
