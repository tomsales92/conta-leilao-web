import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import type { Profile } from '../../../core/services/admin.service';

export interface ConfirmDeleteUserDialogData {
  profile: Profile;
}

@Component({
  selector: 'app-confirm-delete-user-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './confirm-delete-user-dialog.component.html',
  styleUrl: './confirm-delete-user-dialog.component.css',
})
export class ConfirmDeleteUserDialogComponent {
  readonly dialogRef = inject(DialogRef<boolean>);
  readonly data = inject<ConfirmDeleteUserDialogData>(DIALOG_DATA);

  firstNameConfirm = '';
  lastNameConfirm = '';
  emailConfirm = '';
  mismatchError = false;

  private normalize(s: string | null | undefined): string {
    return (s ?? '').trim().toLowerCase();
  }

  get hasName(): boolean {
    const p = this.data.profile;
    return !!(p.firstName?.trim() || p.lastName?.trim());
  }

  get canConfirm(): boolean {
    const p = this.data.profile;
    if (this.hasName) {
      const firstMatch = this.normalize(this.firstNameConfirm) === this.normalize(p.firstName);
      const lastMatch = this.normalize(this.lastNameConfirm) === this.normalize(p.lastName);
      return firstMatch && lastMatch;
    }
    return this.normalize(this.emailConfirm) === this.normalize(p.email);
  }

  get displayName(): string {
    const p = this.data.profile;
    if (p.firstName || p.lastName) return [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return p.email ?? p.id;
  }

  confirm(): void {
    if (!this.canConfirm) {
      this.mismatchError = true;
      return;
    }
    this.mismatchError = false;
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
