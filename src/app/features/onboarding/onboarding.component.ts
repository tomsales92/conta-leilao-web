import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JourneyStateService } from '../../core/services/journey-state.service';
import { AdminService, type Profile } from '../../core/services/admin.service';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [HeaderComponent, ReactiveFormsModule],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class OnboardingComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly journey = inject(JourneyStateService);
  private readonly router = inject(Router);
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  protected readonly profile = signal<Profile | null>(null);
  protected readonly loadingProfile = signal(true);
  protected readonly savingProfile = signal(false);
  protected readonly profileError = signal<string | null>(null);

  protected form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    dateOfBirth: ['', Validators.required],
    gender: ['M' as 'M' | 'F', Validators.required],
  });

  constructor() {
    this.journey.clearAllData();
  }

  ngOnInit(): void {
    void this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user?.id) {
      this.loadingProfile.set(false);
      return;
    }
    this.loadingProfile.set(true);
    try {
      const p = await this.admin.getProfile(user.id);
      this.profile.set(p);
      this.form.patchValue({
        firstName: p?.firstName ?? '',
        lastName: p?.lastName ?? '',
        dateOfBirth: p?.dateOfBirth ?? '',
        gender: (p?.gender === 'F' ? 'F' : 'M') as 'M' | 'F',
      });
    } finally {
      this.loadingProfile.set(false);
    }
  }

  protected get profileIncomplete(): boolean {
    const p = this.profile();
    if (!p) return true;
    return !p.firstName || !p.lastName || !p.dateOfBirth || !p.gender;
  }

  protected async submitCompleteProfile(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const user = this.auth.currentUser();
    const id = user?.id ?? this.profile()?.id;
    if (!id) return;
    this.profileError.set(null);
    this.savingProfile.set(true);
    try {
      const v = this.form.getRawValue();
      await this.admin.updateProfile(id, {
        email: user?.email ?? this.profile()?.email ?? null,
        firstName: v.firstName || null,
        lastName: v.lastName || null,
        dateOfBirth: v.dateOfBirth || null,
        gender: v.gender as 'M' | 'F',
        plan: 'free',
        role: 'user',
      });
      await this.loadProfile();
    } catch (e) {
      this.profileError.set(e instanceof Error ? e.message : 'Erro ao salvar. Tente de novo.');
    } finally {
      this.savingProfile.set(false);
    }
  }

  startJourney(): void {
    this.journey.setJourneyStarted(true);
    this.router.navigate(['/forma-pagamento']);
  }

  goToAnaliseMatricula(): void {
    this.router.navigate(['/analise-matricula']);
  }

  protected get firstName(): string {
    const p = this.profile();
    const user = this.auth.currentUser();
    return p?.firstName ?? user?.firstName ?? '';
  }

  protected get welcomeWord(): string {
    const p = this.profile();
    const gender = p?.gender;
    if (gender === 'M') return 'bem-vindo';
    if (gender === 'F') return 'bem-vinda';
    return 'bem-vindo';
  }
}
