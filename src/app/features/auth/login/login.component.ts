import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  AUTH_STORAGE_KEYS,
  LOGIN_ERROR_MESSAGES,
  INVALID_CREDENTIALS_PATTERNS,
  SUPABASE_ERROR_CODE_INVALID_CREDENTIALS,
} from '../constants/auth.constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);

  protected error = '';
  protected loading = false;
  protected loadingGoogle = false;
  protected rememberCredentials = signal(false);

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected get showUserCreatedMessage(): boolean {
    return this.route.snapshot.queryParams['user_created'] === '1';
  }

  ngOnInit(): void {
    this.loadSavedCredentials();
  }

  protected async onGoogleLogin(): Promise<void> {
    this.error = '';
    this.loadingGoogle = true;
    this.cdr.detectChanges();
    try {
      await this.auth.signInWithGoogle();
      // Redirecionamento feito pelo AuthService; ao voltar do Google a sessão é restaurada
    } catch (e: unknown) {
      this.error = this.getLoginErrorMessage(e);
      this.cdr.detectChanges();
    } finally {
      this.loadingGoogle = false;
      this.cdr.detectChanges();
    }
  }

  protected toggleRemember(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.rememberCredentials.set(checked);
    if (!checked) {
      this.clearSavedCredentials();
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }
    this.error = '';
    this.loading = true;
    this.cdr.detectChanges();
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signInWithEmail(email, password);
      this.rememberCredentials() ? this.saveCredentials(email, password) : this.clearSavedCredentials();
      this.router.navigate(['/onboarding']);
    } catch (e: unknown) {
      this.error = this.getLoginErrorMessage(e);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private loadSavedCredentials(): void {
    const remember = localStorage.getItem(AUTH_STORAGE_KEYS.remember) === 'true';
    this.rememberCredentials.set(remember);
    if (!remember) return;
    const email = localStorage.getItem(AUTH_STORAGE_KEYS.email) ?? '';
    const password = localStorage.getItem(AUTH_STORAGE_KEYS.password) ?? '';
    if (email) this.form.controls.email.setValue(email);
    if (password) this.form.controls.password.setValue(password);
  }

  private saveCredentials(email: string, password: string): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.remember, 'true');
    localStorage.setItem(AUTH_STORAGE_KEYS.email, email);
    localStorage.setItem(AUTH_STORAGE_KEYS.password, password);
  }

  private clearSavedCredentials(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.remember);
    localStorage.removeItem(AUTH_STORAGE_KEYS.email);
    localStorage.removeItem(AUTH_STORAGE_KEYS.password);
  }

  private getLoginErrorMessage(e: unknown): string {
    const msg = this.getErrorMessage(e);
    if (this.isProviderNotEnabledError(e) || /provider is not enabled|provider not enabled/i.test(msg)) {
      return LOGIN_ERROR_MESSAGES.providerNotEnabled;
    }
    const isInvalidCredentials =
      this.isInvalidCredentialsError(e) ||
      INVALID_CREDENTIALS_PATTERNS.some((p) => msg.toLowerCase().includes(p));
    return isInvalidCredentials
      ? LOGIN_ERROR_MESSAGES.invalidCredentials
      : (msg || LOGIN_ERROR_MESSAGES.generic);
  }

  private isProviderNotEnabledError(e: unknown): boolean {
    if (!e || typeof e !== 'object') return false;
    const o = e as { error_code?: string; msg?: string };
    return (
      o.error_code === 'validation_failed' &&
      /provider.*not enabled|unsupported provider/i.test(o.msg ?? '')
    );
  }

  private getErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
      return (e as { message: string }).message;
    }
    return '';
  }

  private isInvalidCredentialsError(e: unknown): boolean {
    if (!e || typeof e !== 'object' || !('code' in e)) return false;
    return (e as { code: string }).code === SUPABASE_ERROR_CODE_INVALID_CREDENTIALS;
  }
}
