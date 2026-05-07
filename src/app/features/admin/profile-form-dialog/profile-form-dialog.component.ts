import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import type { Profile, ProfileUpdate, ProfileInsertWithPassword, Plan, ProfileRole } from '../../../core/services/admin.service';

export interface ProfileFormDialogData {
  profile: Profile | null;
}

@Component({
  selector: 'app-profile-form-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile-form-dialog.component.html',
  styleUrl: './profile-form-dialog.component.css',
})
export class ProfileFormDialogComponent {
  readonly dialogRef = inject(DialogRef<ProfileInsertWithPassword | ProfileUpdate | null>);
  readonly data = inject<ProfileFormDialogData>(DIALOG_DATA);

  email = this.data.profile?.email ?? '';
  password = '';
  firstName = this.data.profile?.firstName ?? '';
  lastName = this.data.profile?.lastName ?? '';
  dateOfBirth = this.data.profile?.dateOfBirth ?? '';
  gender = this.data.profile?.gender ?? '';
  plan: Plan = (this.data.profile?.plan as Plan) ?? 'free';
  role: ProfileRole = (this.data.profile?.role as ProfileRole) ?? 'user';

  readonly planOptions: Plan[] = ['free', 'premium'];
  readonly roleOptions: ProfileRole[] = ['user', 'admin'];

  get isEdit(): boolean {
    return this.data.profile != null;
  }

  save(): void {
    const base: ProfileUpdate = {
      email: this.email || null,
      firstName: this.firstName || null,
      lastName: this.lastName || null,
      dateOfBirth: this.dateOfBirth || null,
      gender: this.gender || null,
      plan: this.plan,
      role: this.role,
    };
    if (this.isEdit) {
      this.dialogRef.close(base);
    } else {
      this.dialogRef.close({ ...base, id: '', password: this.password } as ProfileInsertWithPassword);
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
