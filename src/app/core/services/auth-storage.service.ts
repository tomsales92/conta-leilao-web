import { Injectable } from '@angular/core';

export interface StoredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  plan: string | null;
}

const KEYS = {
  accessToken:  'cl_access_token',
  refreshToken: 'cl_refresh_token',
  user:         'cl_user',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthStorageService {
  getAccessToken(): string | null {
    return localStorage.getItem(KEYS.accessToken);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(KEYS.refreshToken);
  }

  getUser(): StoredUser | null {
    try {
      const raw = localStorage.getItem(KEYS.user);
      return raw ? (JSON.parse(raw) as StoredUser) : null;
    } catch {
      return null;
    }
  }

  save(accessToken: string, refreshToken: string, user: StoredUser): void {
    localStorage.setItem(KEYS.accessToken,  accessToken);
    localStorage.setItem(KEYS.refreshToken, refreshToken);
    localStorage.setItem(KEYS.user,         JSON.stringify(user));
  }

  clear(): void {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  }

  hasSession(): boolean {
    return !!this.getAccessToken();
  }
}
