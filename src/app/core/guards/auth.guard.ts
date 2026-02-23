import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.whenReady().then(() => {
    if (auth.isAuthenticated()) return true;
    return router.createUrlTree(['/login']);
  });
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.whenReady().then(() => {
    if (!auth.isAuthenticated()) return true;
    return router.createUrlTree(['/onboarding']);
  });
};
