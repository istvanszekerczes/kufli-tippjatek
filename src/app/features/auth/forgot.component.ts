import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-forgot',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto mt-6 max-w-md sm:mt-14">
      <div class="mb-6 text-center">
        <img src="/kufli-logo.png" alt="Kufli TippJáték" class="mx-auto mb-4 h-24 w-24 drop-shadow-[0_10px_40px_rgba(47,181,110,0.4)] sm:h-28 sm:w-28" />
        <h1 class="font-display text-2xl font-extrabold">{{ 'auth.forgotTitle' | t }}</h1>
        <p class="mt-1 text-sm text-slate-400">{{ 'auth.forgotSub' | t }}</p>
      </div>

      @if (sent()) {
        <div class="card space-y-3 p-6 text-center">
          <p class="text-2xl">📬</p>
          <p class="text-sm text-slate-300">{{ 'auth.forgotSent' | t: { email: email } }}</p>
          <a routerLink="/login" class="btn-ghost">{{ 'auth.signin' | t }}</a>
        </div>
      } @else {
        <form class="card space-y-4 p-6" (ngSubmit)="submit()">
          <div>
            <label class="label" for="email">{{ 'auth.email' | t }}</label>
            <input id="email" name="email" type="email" class="input" autocomplete="email"
              [(ngModel)]="email" required />
          </div>
          @if (error()) {
            <p class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {{ error() }}
            </p>
          }
          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            {{ loading() ? ('c.loading' | t) : ('auth.forgotBtn' | t) }}
          </button>
        </form>
      }

      <p class="mt-4 text-center text-sm text-slate-400">
        <a routerLink="/login" class="font-semibold text-pitch-400 hover:underline">← {{ 'auth.signin' | t }}</a>
      </p>
    </div>
  `
})
export class ForgotComponent {
  private readonly sb = inject(SupabaseService);

  email = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly sent = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      const { error } = await this.sb.client.auth.resetPasswordForEmail(this.email.trim(), {
        redirectTo: `${location.origin}/reset`
      });
      if (error) throw error;
      this.sent.set(true);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not send the reset email.');
    } finally {
      this.loading.set(false);
    }
  }
}
