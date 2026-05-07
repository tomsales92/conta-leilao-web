import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, throwError } from 'rxjs';
import { from } from 'rxjs';
import { AuthStorageService } from '../services/auth-storage.service';
import { environment } from '../../../environments/environment';

const PUBLIC_PATHS = ['/auth/signin', '/auth/signup', '/auth/refresh', '/auth/reset-password'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storage = inject(AuthStorageService);

  const isPublic = PUBLIC_PATHS.some((p) => req.url.includes(p));
  if (isPublic) return next(req);

  const token = storage.getAccessToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        return from(tryRefresh(req, next, storage)) as Observable<HttpEvent<unknown>>;
      }
      return throwError(() => err);
    })
  );
};

async function tryRefresh(
  original: HttpRequest<unknown>,
  next: HttpHandlerFn,
  storage: AuthStorageService
): Promise<unknown> {
  const refreshToken = storage.getRefreshToken();
  if (!refreshToken) {
    storage.clear();
    window.location.href = '/login';
    throw new Error('Sessão expirada.');
  }

  try {
    const res = await fetch(`${environment.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh falhou');

    const data = await res.json() as { accessToken: string; refreshToken: string; user: Parameters<AuthStorageService['save']>[2] };
    storage.save(data.accessToken, data.refreshToken, data.user);

    const retried = original.clone({ setHeaders: { Authorization: `Bearer ${data.accessToken}` } });
    return new Promise((resolve, reject) =>
      next(retried).subscribe({ next: resolve, error: reject })
    );
  } catch {
    storage.clear();
    window.location.href = '/login';
    throw new Error('Sessão expirada. Faça login novamente.');
  }
}
