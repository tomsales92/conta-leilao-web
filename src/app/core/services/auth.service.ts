import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

const LOGIN_AT_KEY = 'auth_login_at_sec';
const MAX_SESSION_DURATION_SEC = 3600; // 1 hora (igual ao app Flutter)

export interface SignUpData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'M' | 'F';
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<User | null>(null);
  private readonly sessionSignal = signal<Session | null>(null);
  private readonly readyPromise: Promise<void>;

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();

  /** Resolve quando a sessão inicial foi carregada (evita race em guards). */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  readonly isLoggedIn = computed(() => {
    const session = this.sessionSignal();
    if (!session) return false;
    if (session.expires_at && session.expires_at * 1000 < Date.now()) return false;
    const loginAt = this.getStoredLoginAt();
    if (loginAt == null) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now - loginAt > MAX_SESSION_DURATION_SEC) return false;
    return true;
  });

  /** Para uso em guards e templates. */
  isAuthenticated(): boolean {
    return this.isLoggedIn() ?? false;
  }

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router
  ) {
    this.readyPromise = this.supabase.client.auth.getSession().then(({ data: { session } }) => {
      this.sessionSignal.set(session);
      this.currentUserSignal.set(session?.user ?? null);
      this.loadLoginTimestamp();
    });
    this.supabase.client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      this.sessionSignal.set(session);
      this.currentUserSignal.set(session?.user ?? null);
      if (event === 'SIGNED_OUT') this.clearLoginTimestamp();
      if (event === 'SIGNED_IN' && session) this.saveLoginTimestamp();
    });
  }

  private getStoredLoginAt(): number | null {
    try {
      const v = localStorage.getItem(LOGIN_AT_KEY);
      return v != null ? parseInt(v, 10) : null;
    } catch {
      return null;
    }
  }

  private saveLoginTimestamp(): void {
    const sec = Math.floor(Date.now() / 1000);
    try {
      localStorage.setItem(LOGIN_AT_KEY, String(sec));
    } catch {}
  }

  private loadLoginTimestamp(): void {
    // Apenas para leitura; já usado em isLoggedIn
  }

  private clearLoginTimestamp(): void {
    try {
      localStorage.removeItem(LOGIN_AT_KEY);
    } catch {}
  }

  async signInWithEmail(email: string, password: string) {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (data.session) this.saveLoginTimestamp();
    return data;
  }

  /**
   * Redireciona para o fluxo de login com Google (OAuth).
   * O redirectTo deve estar configurado em Supabase > Authentication > URL Configuration.
   */
  async signInWithGoogle(): Promise<void> {
    const redirectTo = `${window.location.origin}/onboarding`;
    const { data, error } = await this.supabase.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  }

  async signUpWithProfile(data: SignUpData) {
    const { data: result, error } = await this.supabase.client.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          date_of_birth: data.dateOfBirth,
          gender: data.gender,
        },
      },
    });
    if (error) throw error;
    if (result.session) this.saveLoginTimestamp();
    return result;
  }

  /** Logout completo: invalida sessão, limpa estado e redireciona. */
  async signOut(): Promise<void> {
    // 2. Remover token/metadata local
    this.clearLoginTimestamp();

    // 1. Invalidar sessão no Supabase (limpa localStorage + revoga refresh token no servidor)
    await this.supabase.client.auth.signOut({ scope: 'global' });

    // 3. Limpar estado da aplicação
    this.sessionSignal.set(null);
    this.currentUserSignal.set(null);

    // 4. Redirecionar para login
    // 5. replaceUrl evita acúmulo de histórico e impede "voltar" para páginas autenticadas
    await this.router.navigate(['/login'], { replaceUrl: true });
  }

  async resetPasswordForEmail(email: string) {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  }

  async resendConfirmationEmail(email: string) {
    const { error } = await this.supabase.client.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (error) throw error;
  }
}
