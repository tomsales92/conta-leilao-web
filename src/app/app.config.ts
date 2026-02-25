import { ApplicationConfig, provideBrowserGlobalErrorListeners, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNgxMask } from 'ngx-mask';
import { DialogModule } from '@angular/cdk/dialog';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
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
