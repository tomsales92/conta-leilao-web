import { Component, inject, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import type { Profile } from '../../../core/services/admin.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly admin = inject(AdminService);
  protected readonly profile = signal<Profile | null>(null);
  protected readonly role = signal<'user' | 'admin' | null>(null);

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      if (user?.id) {
        this.admin.getProfile(user.id).then((p) => this.profile.set(p));
        this.admin.getProfileRole(user.id).then((r) => this.role.set(r));
      } else {
        this.profile.set(null);
        this.role.set(null);
      }
    });
  }

  get isAdmin(): boolean {
    return this.role() === 'admin' || this.profile()?.role === 'admin';
  }
}
