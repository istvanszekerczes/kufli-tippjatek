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
    provideAppInitializer(async () => {
      await inject(RuntimeConfigService).load();
      await inject(AuthService).init();
    })
  ]
};
