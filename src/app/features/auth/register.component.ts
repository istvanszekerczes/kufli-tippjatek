import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto mt-6 max-w-md sm:mt-14">
      <div class="mb-6 text-center">
        <img src="/kufli-logo.png" alt="Kufli TippJáték" class="mx-auto mb-4 h-24 w-24 drop-shadow-[0_10px_40px_rgba(47,181,110,0.4)] sm:h-28 sm:w-28" />
        <h1 class="font-display text-2xl font-extrabold">Create your account</h1>
        <p class="mt-1 text-sm text-slate-400">Pick a display name — it shows on the leaderboard.</p>
      </div>

      @if (done()) {
        <div class="card space-y-3 p-6 text-center">
          <p class="text-2xl">📬</p>
          <p class="text-sm text-slate-300">
            Almost there — check <strong>{{ email }}</strong> for a confirmation link, then
            <a routerLink="/login" class="font-semibold text-pitch-400 hover:underline">sign in</a>.
          </p>
        </div>
      } @else {
        <form class="card space-y-4 p-6" (ngSubmit)="submit()">
          <div>
            <label class="label" for="username">Display name</label>
            <input id="username" name="username" class="input" autocomplete="nickname" minlength="2" maxlength="24"
              [(ngModel)]="username" required />
          </div>
          <div>
            <label class="label" for="email">Email</label>
            <input id="email" name="email" type="email" class="input" autocomplete="email"
              [(ngModel)]="email" required />
          </div>
          <div>
            <label class="label" for="password">Password</label>
            <input id="password" name="password" type="password" class="input" autocomplete="new-password" minlength="6"
              [(ngModel)]="password" required />
            <p class="mt-1 text-xs text-slate-500">At least 6 characters.</p>
          </div>

          @if (error()) {
            <p class="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {{ error() }}
            </p>
          }

          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            {{ loading() ? 'Creating…' : 'Create account' }}
          </button>
        </form>
      }

      <p class="mt-4 text-center text-sm text-slate-400">
        Already registered?
        <a routerLink="/login" class="font-semibold text-pitch-400 hover:underline">Sign in</a>
      </p>
    </div>
  `
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly done = signal(false);

  async submit(): Promise<void> {
    this.error.set('');
    if (this.username.trim().length < 2) {
      this.error.set('Display name must be at least 2 characters.');
      return;
    }
    this.loading.set(true);
    try {
      const data = await this.auth.signUp(this.email.trim(), this.password, this.username);
      if (data.session) {
        await this.router.navigateByUrl('/');
      } else {
        this.done.set(true);
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not create account.');
    } finally {
      this.loading.set(false);
    }
  }
}
