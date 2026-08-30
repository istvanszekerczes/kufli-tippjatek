import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto mt-6 max-w-md sm:mt-14">
      <div class="mb-6 text-center">
        <img src="/kufli-logo.png" alt="Kufli TippJáték" class="mx-auto mb-4 h-24 w-24 drop-shadow-[0_10px_40px_rgba(47,181,110,0.4)] sm:h-28 sm:w-28" />
        <h1 class="font-display text-2xl font-extrabold">Welcome back</h1>
        <p class="mt-1 text-sm text-slate-400">Sign in to submit your predictions.</p>
      </div>

      <form class="card space-y-4 p-6" (ngSubmit)="submit()">
        <div>
          <label class="label" for="email">Email</label>
          <input id="email" name="email" type="email" class="input" autocomplete="email"
            [(ngModel)]="email" required />
        </div>
        <div>
          <label class="label" for="password">Password</label>
          <input id="password" name="password" type="password" class="input" autocomplete="current-password"
            [(ngModel)]="password" required />
        </div>

        @if (error()) {
          <p class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {{ error() }}
          </p>
        }

        <button type="submit" class="btn-primary w-full" [disabled]="loading()">
          {{ loading() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-400">
        No account?
        <a routerLink="/register" class="font-semibold text-pitch-400 hover:underline">Create one</a>
      </p>
    </div>
  `
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    this.error.set('');
    this.loading.set(true);
    try {
      await this.auth.signIn(this.email.trim(), this.password);
      const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/';
      await this.router.navigateByUrl(redirect);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not sign in.');
    } finally {
      this.loading.set(false);
    }
  }
}
