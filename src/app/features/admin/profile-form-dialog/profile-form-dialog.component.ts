import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { DIALOG_DATA } from '@angular/cdk/dialog';
import type { Profile, ProfileInsert, ProfileUpdate, ProfileInsertWithPassword, Plan, ProfileRole } from '../../../core/services/admin.service';

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
  firstName = this.data.profile?.first_name ?? '';
  lastName = this.data.profile?.last_name ?? '';
  dateOfBirth = this.data.profile?.date_of_birth ?? '';
  gender = this.data.profile?.gender ?? '';
  plan: Plan = (this.data.profile?.plan as Plan) ?? 'free';
  role: ProfileRole = (this.data.profile?.role as ProfileRole) ?? 'user';

  readonly planOptions: Plan[] = ['free', 'premium'];
  readonly roleOptions: ProfileRole[] = ['user', 'admin'];

  get isEdit(): boolean {
    return this.data.profile != null;
  }

  save(): void {
    const base = {
      email: this.email || null,
      first_name: this.firstName || null,
      last_name: this.lastName || null,
      date_of_birth: this.dateOfBirth || null,
      gender: this.gender || null,
      plan: this.plan,
      role: this.role,
    };
    if (this.isEdit) {
      this.dialogRef.close(base as ProfileUpdate);
    } else {
      this.dialogRef.close({ ...base, password: this.password } as ProfileInsertWithPassword);
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
