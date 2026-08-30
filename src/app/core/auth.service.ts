import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { RuntimeConfigService } from './runtime-config.service';
import { Profile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sb = inject(SupabaseService);
  private readonly cfg = inject(RuntimeConfigService);
  private readonly router = inject(Router);

  readonly session = signal<Session | null>(null);
  readonly user = signal<User | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly initialized = signal(false);

  readonly isLoggedIn = computed(() => !!this.user());
  readonly isAdmin = computed(() => !!this.profile()?.is_admin);
  readonly displayName = computed(
    () => this.profile()?.username || this.user()?.email?.split('@')[0] || 'Player'
  );

  private readyResolve!: () => void;
  private readyDone = false;
  readonly ready = new Promise<void>((r) => (this.readyResolve = r));

  private finishInit(): void {
    if (this.readyDone) return;
    this.readyDone = true;
    this.initialized.set(true);
    this.readyResolve();
  }

  async init(): Promise<void> {
    if (!this.cfg.isConfigured) {
      // No Supabase credentials — let the app render its "not configured" banner.
      this.finishInit();
      return;
    }

    // Never let a slow / hung network call block the whole app from rendering.
    const guard = setTimeout(() => {
      console.warn('[auth] session check timed out — continuing without a session');
      this.finishInit();
    }, 6000);

    try {
      const { data } = await this.sb.client.auth.getSession();
      await this.applySession(data.session);

      this.sb.client.auth.onAuthStateChange((_event, session) => {
        void this.applySession(session);
      });
    } catch (e) {
      console.error('AuthService.init', e);
    } finally {
      clearTimeout(guard);
      this.finishInit();
    }
  }

  private async applySession(session: Session | null): Promise<void> {
    this.session.set(session);
    this.user.set(session?.user ?? null);
    if (session?.user) {
      await this.loadProfile();
    } else {
      this.profile.set(null);
    }
  }

  async loadProfile(): Promise<void> {
    const uid = this.user()?.id;
    if (!uid) return;
    const { data, error } = await this.sb.client
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      console.error('loadProfile', error);
      return;
    }
    this.profile.set(data as Profile);
  }

  async signUp(email: string, password: string, username: string) {
    const { data, error } = await this.sb.client.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } }
    });
    if (error) throw error;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    await this.sb.client.auth.signOut();
    this.profile.set(null);
    await this.router.navigateByUrl('/login');
  }
}
