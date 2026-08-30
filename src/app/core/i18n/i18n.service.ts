import { Injectable, signal } from '@angular/core';
import { en } from './en';
import { hu } from './hu';

export type Lang = 'hu' | 'en';
const DICTS: Record<Lang, Record<string, string>> = { hu, en };
const KEY = 'kufli-lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(this.read());

  constructor() {
    try {
      document.documentElement.lang = this.lang();
    } catch {
      /* ignore */
    }
  }

  private read(): Lang {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'hu' || v === 'en') return v;
    } catch {
      /* private mode / SSR */
    }
    return 'hu';
  }

  setLang(l: Lang): void {
    this.lang.set(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  }

  toggle(): void {
    this.setLang(this.lang() === 'hu' ? 'en' : 'hu');
  }

  /**
   * Look up `key`, interpolate `{name}` placeholders, and pick the right
   * plural side of an `a|b` string using `params.n` (n === 1 → left).
   */
  t(key: string, params?: Record<string, string | number>): string {
    const dict = DICTS[this.lang()];
    let s = dict[key] ?? en[key] ?? key;

    if (s.includes('|')) {
      const [one, other] = s.split('|');
      s = Number(params?.['n']) === 1 ? one : other;
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return s;
  }
}
