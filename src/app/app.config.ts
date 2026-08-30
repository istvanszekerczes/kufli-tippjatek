import { ApplicationConfig, provideAppInitializer, inject } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling
} from '@angular/router';

import { routes } from './app.routes';
import { RuntimeConfigService } from './core/runtime-config.service';
import { AuthService } from './core/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),
    provideAppInitializer(() => {
      // All inject() calls happen synchronously here, while we are still in the
      // injection context. Anything after an `await` would throw NG0203.
      const config = inject(RuntimeConfigService);
      const auth = inject(AuthService);

      // Only the (fast, local) config load blocks bootstrap; the auth session
      // check runs in the background — route guards await `AuthService.ready`.
      return config.load().then(() => {
        void auth.init();
      });
    })
  ]
};
