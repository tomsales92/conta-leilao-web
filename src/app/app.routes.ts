import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard],
  },
  {
    path: 'forma-pagamento',
    loadComponent: () => import('./features/journey/forma-pagamento/forma-pagamento.component').then(m => m.FormaPagamentoComponent),
    canActivate: [authGuard],
  },
  {
    path: 'financiamento',
    loadComponent: () => import('./features/journey/financiamento/financiamento.component').then(m => m.FinanciamentoComponent),
    canActivate: [authGuard],
  },
  {
    path: 'arrematacao',
    loadComponent: () => import('./features/journey/arrematacao/arrematacao.component').then(m => m.ArrematacaoComponent),
    canActivate: [authGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'cadastro',
    loadComponent: () => import('./features/auth/signup/signup.component').then(m => m.SignupComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    canActivate: [guestGuard],
  },
  { path: '**', redirectTo: '' },
];
