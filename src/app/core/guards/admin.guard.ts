import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminService } from '../services/admin.service';

/**
 * Guard que permite acessar a rota apenas se o usuário estiver logado e tiver role 'admin' no perfil.
 * Caso contrário, redireciona para a home.
 * Use após authGuard: canActivate: [authGuard, adminGuard].
 */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const admin = inject(AdminService);
  const router = inject(Router);

  await auth.whenReady();
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const user = auth.currentUser();
  if (!user?.id) {
    return router.createUrlTree(['/admin-negado']);
  }

  try {
    const role = await admin.getProfileRole(user.id);
    if (role === 'admin') {
      return true;
    }
    console.warn('[adminGuard] Acesso negado: perfil sem role admin.', { profileRole: role, userId: user.id });
  } catch (e) {
    console.error('[adminGuard] Erro ao buscar perfil (RLS ou colunas plan/role no Supabase).', e);
  }
  return router.createUrlTree(['/admin-negado']);
};
