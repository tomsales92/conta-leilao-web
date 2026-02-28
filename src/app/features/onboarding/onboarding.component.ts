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
      const meta = user.user_metadata ?? {};
      this.form.patchValue({
        firstName: p?.first_name ?? meta['first_name'] ?? meta['given_name'] ?? '',
        lastName: p?.last_name ?? meta['last_name'] ?? meta['family_name'] ?? '',
        dateOfBirth: p?.date_of_birth ?? '',
        gender: (p?.gender === 'F' ? 'F' : 'M') as 'M' | 'F',
      });
    } finally {
      this.loadingProfile.set(false);
    }
  }

  protected get profileIncomplete(): boolean {
    const p = this.profile();
    if (!p) return true;
    return !p.first_name || !p.last_name || !p.date_of_birth || !p.gender;
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
      await this.admin.upsertProfile(id, {
        email: user?.email ?? this.profile()?.email ?? null,
        first_name: v.firstName || null,
        last_name: v.lastName || null,
        date_of_birth: v.dateOfBirth || null,
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

  protected get firstName(): string {
    const p = this.profile();
    if (p?.first_name) return p.first_name;
    const user = this.auth.currentUser();
    const meta = user?.user_metadata;
    return meta?.['first_name'] ?? meta?.['given_name'] ?? meta?.['name'] ?? '';
  }

  protected get welcomeWord(): string {
    const p = this.profile();
    const gender = p?.gender ?? this.auth.currentUser()?.user_metadata?.['gender'];
    if (gender === 'M') return 'bem-vindo';
    if (gender === 'F') return 'bem-vinda';
    return 'bem-vindo';
  }
}
