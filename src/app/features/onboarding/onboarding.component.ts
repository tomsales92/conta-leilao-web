import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JourneyStateService } from '../../core/services/journey-state.service';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [RouterLink, HeaderComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class OnboardingComponent {
  protected readonly auth = inject(AuthService);

  constructor() {
    inject(JourneyStateService).clearAllData();
  }

  protected get firstName(): string {
    const user = this.auth.currentUser();
    const meta = user?.user_metadata;
    return meta?.['first_name'] ?? meta?.['given_name'] ?? meta?.['name'] ?? '';
  }

  protected get welcomeWord(): string {
    const user = this.auth.currentUser();
    const gender = user?.user_metadata?.['gender'];
    if (gender === 'M') return 'bem-vindo';
    if (gender === 'F') return 'bem-vinda';
    return 'bem-vindo';
  }
}
