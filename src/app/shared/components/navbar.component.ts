import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LeaderboardService } from '../../core/leaderboard.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-40 border-b border-white/10 bg-night-950/80 backdrop-blur-lg">
      <nav class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <a routerLink="/" class="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
          <img src="/kufli-logo.png" alt="" width="34" height="34" class="h-[34px] w-[34px] drop-shadow-[0_2px_10px_rgba(47,181,110,0.35)]" />
          <span>Kufli<span class="text-pitch-400"> TippJáték</span></span>
        </a>

        <!-- desktop links -->
        <div class="ml-4 hidden items-center gap-1 md:flex">
          @for (l of links; track l.path) {
            <a
              [routerLink]="l.path"
              routerLinkActive="bg-white/10 text-white"
              [routerLinkActiveOptions]="{ exact: l.path === '/' }"
              class="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              {{ l.label }}
            </a>
          }
          @if (auth.isAdmin()) {
            <a
              routerLink="/admin"
              routerLinkActive="bg-white/10 text-white"
              class="rounded-lg px-3 py-2 text-sm font-medium text-amber-300/90 transition hover:bg-white/5"
            >
              Admin
            </a>
          }
        </div>

        <div class="ml-auto flex items-center gap-2">
          @if (lb.me(); as me) {
            <a
              routerLink="/leaderboard"
              class="chip hidden border-pitch-400/30 bg-pitch-400/10 text-pitch-200 sm:inline-flex"
              title="Your points and rank"
            >
              <span class="font-bold tabular-nums">{{ me.total_points }}</span> pts
              <span class="text-slate-400">·</span> #{{ me.rank }}
            </a>
          }

          <a routerLink="/profile" class="btn-ghost !px-3 !py-2" routerLinkActive="!bg-white/10">
            <span class="grid h-6 w-6 place-items-center rounded-full bg-pitch-500 text-xs font-bold text-night-950">
              {{ initial() }}
            </span>
            <span class="hidden max-w-[9rem] truncate sm:inline">{{ auth.displayName() }}</span>
          </a>

          <button class="btn-ghost !px-3 !py-2 md:!hidden" (click)="open.set(!open())" aria-label="Menu">
            ☰
          </button>
          <button class="btn-ghost hidden !px-3 !py-2 md:!inline-flex" (click)="auth.signOut()">
            Sign out
          </button>
        </div>
      </nav>

      @if (open()) {
        <div class="border-t border-white/10 px-4 py-2 md:hidden">
          @for (l of links; track l.path) {
            <a
              [routerLink]="l.path"
              (click)="open.set(false)"
              routerLinkActive="text-pitch-300"
              [routerLinkActiveOptions]="{ exact: l.path === '/' }"
              class="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5"
            >
              {{ l.label }}
            </a>
          }
          @if (auth.isAdmin()) {
            <a routerLink="/admin" (click)="open.set(false)" class="block rounded-lg px-3 py-2.5 text-sm font-medium text-amber-300">
              Admin
            </a>
          }
          <button class="mt-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-300 hover:bg-white/5" (click)="auth.signOut()">
            Sign out
          </button>
        </div>
      }
    </header>
  `
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  readonly lb = inject(LeaderboardService);
  readonly open = signal(false);

  readonly links = [
    { path: '/', label: 'Matches' },
    { path: '/outright', label: 'Outright' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/rules', label: 'Rules' }
  ];

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) void this.lb.loadMe();
    });
  }

  initial(): string {
    return (this.auth.displayName()[0] || 'P').toUpperCase();
  }
}
