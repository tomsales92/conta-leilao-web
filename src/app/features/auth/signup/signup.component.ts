import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, SignUpData } from '../../../core/services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})
export class SignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  protected error = '';
  protected success = false;
  protected loading = false;

  protected form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    dateOfBirth: ['', Validators.required],
    gender: ['M' as 'M' | 'F', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }
    this.error = '';
    this.success = false;
    this.loading = true;
    this.cdr.detectChanges();
    try {
      const data: SignUpData = {
        firstName: this.form.controls.firstName.value,
        lastName: this.form.controls.lastName.value,
        dateOfBirth: this.form.controls.dateOfBirth.value,
        gender: this.form.controls.gender.value,
        email: this.form.controls.email.value,
        password: this.form.controls.password.value,
      };
      await this.auth.signUpWithProfile(data);
      this.success = true;
      const user = this.auth.currentUser();
      if (user && !user.identities?.length) {
        this.success = true;
      } else {
        this.router.navigate(['/onboarding']);
      }
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Erro ao criar conta. Tente novamente.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}
