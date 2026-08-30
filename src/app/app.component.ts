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
