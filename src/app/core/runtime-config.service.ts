import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export interface RuntimeConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/**
 * Loads Supabase credentials at runtime from `/config.json` so the same built
 * artifact can be deployed to different environments. Falls back to the values
 * compiled into `environment.ts` (useful for `ng serve`).
 */
@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private config: RuntimeConfig = {
    supabaseUrl: environment.supabaseUrl,
    supabaseAnonKey: environment.supabaseAnonKey
  };

  async load(): Promise<void> {
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      const ct = res.headers.get('content-type') ?? '';
      if (res.ok && ct.includes('json')) {
        const json = (await res.json()) as Partial<RuntimeConfig>;
        if (json.supabaseUrl) this.config.supabaseUrl = json.supabaseUrl;
        if (json.supabaseAnonKey) this.config.supabaseAnonKey = json.supabaseAnonKey;
      }
    } catch {
      /* no config.json in dev — fall back to environment.ts */
    }

    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      console.warn(
        '[RuntimeConfig] Supabase credentials are missing. ' +
          'Set SUPABASE_URL / SUPABASE_ANON_KEY and run `npm run config`, ' +
          'or fill in src/environments/environment.ts for local dev.'
      );
    }
  }

  get supabaseUrl(): string {
    return this.config.supabaseUrl;
  }

  get supabaseAnonKey(): string {
    return this.config.supabaseAnonKey;
  }

  get isConfigured(): boolean {
    return !!this.config.supabaseUrl && !!this.config.supabaseAnonKey;
  }
}
