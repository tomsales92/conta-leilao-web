import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/auth.guard';
import { journeyGuard } from './core/guards/journey.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard],
  },
  {
    path: 'forma-pagamento',
    loadComponent: () => import('./features/journey/forma-pagamento/forma-pagamento.component').then(m => m.FormaPagamentoComponent),
    canActivate: [authGuard, journeyGuard],
  },
  {
    path: 'financiamento',
    loadComponent: () => import('./features/journey/financiamento/financiamento.component').then(m => m.FinanciamentoComponent),
    canActivate: [authGuard, journeyGuard],
  },
  {
    path: 'arrematacao',
    loadComponent: () => import('./features/journey/arrematacao/arrematacao.component').then(m => m.ArrematacaoComponent),
    canActivate: [authGuard, journeyGuard],
  },
  {
    path: 'pos-imissao',
    loadComponent: () => import('./features/journey/pos-imissao/pos-imissao.component').then(m => m.PosImissaoComponent),
    canActivate: [authGuard, journeyGuard],
  },
  {
    path: 'despesas',
    loadComponent: () => import('./features/journey/despesas/despesas.component').then(m => m.DespesasComponent),
    canActivate: [authGuard, journeyGuard],
  },
  {
    path: 'venda',
    loadComponent: () => import('./features/journey/venda/venda.component').then(m => m.VendaComponent),
    canActivate: [authGuard, journeyGuard],
  },
  {
    path: 'resumo',
    loadComponent: () => import('./features/journey/resumo/resumo.component').then(m => m.ResumoComponent),
    canActivate: [authGuard, journeyGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: 'admin-negado',
    loadComponent: () => import('./features/admin-denied/admin-denied.component').then(m => m.AdminDeniedComponent),
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
