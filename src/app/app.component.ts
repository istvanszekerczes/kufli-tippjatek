import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar.component';
import { AuthService } from './core/auth.service';
import { RuntimeConfigService } from './core/runtime-config.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Kufli crest — a prominent background mark on the right, clipped to the viewport -->
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <img
        src="/kufli-logo.png"
        alt=""
        class="absolute right-0 top-1/2 w-[min(96vw,520px)] max-w-none -translate-y-1/2 translate-x-[30%] opacity-[0.10]
               drop-shadow-[0_0_70px_rgba(47,181,110,0.22)]
               sm:w-[min(70vw,640px)] sm:translate-x-[22%] sm:opacity-[0.13]
               lg:w-[720px] lg:translate-x-[18%] lg:opacity-[0.15]
               xl:w-[820px] xl:translate-x-[10%] xl:opacity-[0.17]
               2xl:translate-x-[2%]"
      />
    </div>

    @if (!cfg.isConfigured) {
      <div class="bg-rose-600 px-4 py-2 text-center text-sm font-semibold text-white">
        Supabase is not configured — set <code>SUPABASE_URL</code> and
        <code>SUPABASE_ANON_KEY</code>, then run <code>npm run config</code>.
      </div>
    }

    @if (auth.initialized()) {
      @if (auth.isLoggedIn()) {
        <app-navbar />
      }
      <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <router-outlet />
      </main>
      <footer class="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-500">
        Kufli TippJáték · a Champions League prediction game · fixtures &amp; scores via the sync service
      </footer>
    } @else {
      <div class="grid min-h-screen place-items-center">
        <span class="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-pitch-400"></span>
      </div>
    }
  `,
  host: { class: 'flex min-h-screen flex-col' }
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly cfg = inject(RuntimeConfigService);
}
