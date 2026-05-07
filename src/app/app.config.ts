import { ApplicationConfig, provideBrowserGlobalErrorListeners, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNgxMask } from 'ngx-mask';
import { DialogModule } from '@angular/cdk/dialog';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(DialogModule),
    provideNgxMask({
      thousandSeparator: '.',
      decimalMarker: ',',
      separatorLimit: '',
      leadZero: true,
      dropSpecialCharacters: true,
      allowNegativeNumbers: false,
    }),
  ],
};
