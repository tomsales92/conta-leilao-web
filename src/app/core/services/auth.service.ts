import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AuthStorageService, type StoredUser } from './auth-storage.service';

export interface SignUpData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'M' | 'F';
  email: string;
  password: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api     = inject(ApiService);
  private readonly storage = inject(AuthStorageService);
  private readonly router  = inject(Router);

  private readonly _currentUser = signal<StoredUser | null>(this.storage.getUser());

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn  = computed(() => !!this._currentUser() && this.storage.hasSession());

  /** Compatibilidade com guards que chamam whenReady(). Resolve imediatamente pois o estado vem do localStorage. */
  whenReady(): Promise<void> {
    return Promise.resolve();
  }

  isAuthenticated(): boolean {
    return this.isLoggedIn();
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    const res = await this.api.post<AuthResponse>('auth/signin', { email, password });
    this.applySession(res);
  }

  async signUpWithProfile(data: SignUpData): Promise<void> {
    const res = await this.api.post<AuthResponse>('auth/signup', {
      email:       data.email.trim(),
      password:    data.password,
      firstName:   data.firstName.trim(),
      lastName:    data.lastName.trim(),
      dateOfBirth: data.dateOfBirth || null,
      gender:      data.gender,
    });
    this.applySession(res);
  }

  async signOut(): Promise<void> {
    const refreshToken = this.storage.getRefreshToken();
    try {
      if (refreshToken) {
        await this.api.post('auth/signout', { refreshToken });
      }
    } finally {
      this.storage.clear();
      this._currentUser.set(null);
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  async resetPasswordForEmail(email: string): Promise<void> {
    await this.api.post('auth/reset-password', { email: email.trim() });
  }

  /** Google OAuth — implementar na Fase 2. */
  async signInWithGoogle(): Promise<void> {
    throw new Error('Login com Google disponível em breve.');
  }

  /** Mantido para compatibilidade — e-mail sempre confirmado na nova API. */
  async resendConfirmationEmail(_email: string): Promise<void> {}

  private applySession(res: AuthResponse): void {
    this.storage.save(res.accessToken, res.refreshToken, res.user);
    this._currentUser.set(res.user);
  }
}
