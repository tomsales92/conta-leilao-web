import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { JourneyStateService } from '../services/journey-state.service';

/**
 * Guard que permite acessar a rota apenas se o usuário entrou na jornada pelo onboarding.
 * Se acessar a URL diretamente (ex.: /forma-pagamento), redireciona para /onboarding.
 */
export const journeyGuard: CanActivateFn = () => {
  const journey = inject(JourneyStateService);
  const router = inject(Router);
  if (journey.journeyStarted()) return true;
  return router.createUrlTree(['/onboarding']);
};
