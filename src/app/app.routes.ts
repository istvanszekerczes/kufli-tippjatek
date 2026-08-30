import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
    title: 'Sign in — UCL Tipp'
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
    title: 'Create account — UCL Tipp'
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Matches — UCL Tipp'
  },
  {
    path: 'outright',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/outright/outright.component').then((m) => m.OutrightComponent),
    title: 'Outright winner — UCL Tipp'
  },
  {
    path: 'leaderboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/leaderboard/leaderboard.component').then((m) => m.LeaderboardComponent),
    title: 'Leaderboard — UCL Tipp'
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'My profile — UCL Tipp'
  },
  {
    path: 'rules',
    loadComponent: () => import('./features/rules/rules.component').then((m) => m.RulesComponent),
    title: 'Rules — UCL Tipp'
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
    title: 'Admin — UCL Tipp'
  },
  { path: '**', redirectTo: '' }
];
