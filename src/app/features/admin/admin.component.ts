import { Component, inject, signal, OnInit } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { ConfirmExitDialogComponent } from '../../shared/components/confirm-exit-dialog/confirm-exit-dialog.component';
import { ProfileFormDialogComponent } from './profile-form-dialog/profile-form-dialog.component';
import { AdminService, type Profile, type ProfileInsertWithPassword, type ProfileUpdate } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly dialog = inject(Dialog);

  readonly profiles = signal<Profile[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await this.admin.listProfiles();
      this.profiles.set(list);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erro ao carregar usuários.');
    } finally {
      this.loading.set(false);
    }
  }

  add(): void {
    const ref = this.dialog.open(ProfileFormDialogComponent, {
      data: { profile: null },
      panelClass: 'app-admin-dialog-panel',
    });
    ref.closed.subscribe((value) => {
      if (!this.isCreatePayload(value)) return;
      void this.createUser(value);
    });
  }

  edit(profile: Profile): void {
    const ref = this.dialog.open(ProfileFormDialogComponent, {
      data: { profile },
      panelClass: 'app-admin-dialog-panel',
    });
    ref.closed.subscribe((value) => {
      if (!this.isUpdatePayload(value)) return;
      void this.updateProfile(profile.id, value);
    });
  }

  async remove(profile: Profile): Promise<void> {
    const ref = this.dialog.open(ConfirmExitDialogComponent, {
      data: {
        title: 'Excluir usuário?',
        message: `Deseja realmente excluir ${profile.email ?? profile.first_name ?? profile.id}? Esta ação não pode ser desfeita.`,
      },
      panelClass: 'app-confirm-exit-dialog-panel',
    });
    const confirmed = await ref.closed.toPromise();
    if (confirmed !== true) return;
    try {
      await this.admin.deleteProfile(profile.id);
      await this.load();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erro ao excluir usuário.');
    }
  }

  private async createUser(value: ProfileInsertWithPassword): Promise<void> {
    try {
      await this.admin.createUserWithProfile(value);
      this.error.set(null);
      await this.load();
    } catch (e) {
      this.error.set(this.getCreateUserErrorMessage(e));
    }
  }

  private getCreateUserErrorMessage(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e ?? '');
    if (/email.*invalid|invalid.*email|is invalid/i.test(msg)) {
      return 'O e-mail foi rejeitado pelo Supabase. Tente outro endereço (ex.: Gmail) ou verifique em Supabase → Authentication → Providers/Email se o domínio está permitido.';
    }
    if (/already registered|already exists|already been registered/i.test(msg)) {
      return 'Este e-mail já está cadastrado. Use outro ou edite o usuário existente na lista.';
    }
    return msg || 'Erro ao criar usuário.';
  }

  private async updateProfile(id: string, value: ProfileUpdate): Promise<void> {
    try {
      await this.admin.updateProfile(id, value);
      await this.load();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erro ao atualizar usuário.');
    }
  }

  private isCreatePayload(value: unknown): value is ProfileInsertWithPassword {
    return typeof value === 'object' && value !== null && 'password' in value && typeof (value as ProfileInsertWithPassword).password === 'string';
  }

  private isUpdatePayload(value: unknown): value is ProfileUpdate {
    return typeof value === 'object' && value !== null;
  }
}
