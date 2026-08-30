import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * `{{ 'key' | t }}` or `{{ 'key' | t: { n: count() } }}`.
 * Impure so it re-renders when the language changes (the app is small,
 * the cost is negligible).
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    // touch the signal so Angular keeps calling us after a language switch
    this.i18n.lang();
    return this.i18n.t(key, params);
  }
}
