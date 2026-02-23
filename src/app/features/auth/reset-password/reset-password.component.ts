import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected error = '';
  protected success = false;
  protected loading = false;

  protected form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async onSubmit() {
    if (this.form.invalid) return;
    this.error = '';
    this.success = false;
    this.loading = true;
    try {
      await this.auth.resetPasswordForEmail(this.form.controls.email.value);
      this.success = true;
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Erro ao enviar e-mail. Tente novamente.';
    } finally {
      this.loading = false;
    }
  }
}
