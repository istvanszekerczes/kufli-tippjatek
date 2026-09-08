import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Landing page for the Supabase recovery link. supabase-js picks the session
 * out of the URL hash (detectSessionInUrl), then the user sets a new password.
 */
@Component({
  selector: 'app-reset',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto mt-6 max-w-md sm:mt-14">
      <div class="mb-6 text-center">
        <img src="/kufli-logo.png" alt="Kufli TippJáték" class="mx-auto mb-4 h-24 w-24 drop-shadow-[0_10px_40px_rgba(47,181,110,0.4)] sm:h-28 sm:w-28" />
        <h1 class="font-display text-2xl font-extrabold">{{ 'auth.resetTitle' | t }}</h1>
      </div>

      @if (done()) {
        <div class="card space-y-3 p-6 text-center">
          <p class="text-2xl">✅</p>
          <p class="text-sm text-slate-300">{{ 'auth.resetDone' | t }}</p>
          <a routerLink="/" class="btn-primary">{{ 'nav.matches' | t }}</a>
        </div>
      } @else if (!ready()) {
        <div class="card p-6 text-center text-sm text-slate-400">{{ 'auth.resetNoSession' | t }}
          <a routerLink="/forgot" class="mt-3 block font-semibold text-pitch-400 hover:underline">
            {{ 'auth.forgotBtn' | t }}
          </a>
        </div>
      } @else {
        <form class="card space-y-4 p-6" (ngSubmit)="submit()">
          <div>
            <label class="label" for="pw">{{ 'auth.newPassword' | t }}</label>
            <input id="pw" name="pw" type="password" class="input" autocomplete="new-password" minlength="6"
              [(ngModel)]="pw" required />
            <p class="mt-1 text-xs text-slate-500">{{ 'auth.min6' | t }}</p>
          </div>
          @if (error()) {
            <p class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {{ error() }}
            </p>
          }
          <button type="submit" class="btn-primary w-full" [disabled]="loading() || pw.length < 6">
            {{ loading() ? ('c.loading' | t) : ('auth.resetBtn' | t) }}
          </button>
        </form>
      }
    </div>
  `
})
export class ResetComponent implements OnInit {
  private readonly sb = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  pw = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly done = signal(false);
  readonly ready = signal(false);

  async ngOnInit(): Promise<void> {
    await this.auth.ready;
    // supabase-js has parsed the recovery token from the URL by now
    const { data } = await this.sb.client.auth.getSession();
    this.ready.set(!!data.session);
  }

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      const { error } = await this.sb.client.auth.updateUser({ password: this.pw });
      if (error) throw error;
      this.done.set(true);
      setTimeout(() => this.router.navigateByUrl('/'), 2500);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not update the password.');
    } finally {
      this.loading.set(false);
    }
  }
}
