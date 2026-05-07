import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export type Plan = 'free' | 'premium';
export type ProfileRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  plan: Plan | null;
  role: ProfileRole | null;
  createdAt?: string;
}

export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'createdAt'>>;
export type ProfileInsertWithPassword = Profile & { password: string };

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  getProfileRole(id: string): Promise<ProfileRole | null> {
    return this.api.get<{ role: ProfileRole }>(`admin/users/${id}/role`)
      .then((r) => r.role)
      .catch(() => null);
  }

  listProfiles(): Promise<Profile[]> {
    return this.api.get<Profile[]>('admin/users');
  }

  getProfile(id: string): Promise<Profile | null> {
    return this.api.get<Profile>(`admin/users/${id}`).catch(() => null);
  }

  createUserWithProfile(payload: ProfileInsertWithPassword): Promise<Profile> {
    return this.api.post<Profile>('admin/users', payload);
  }

  updateProfile(id: string, profile: ProfileUpdate): Promise<Profile> {
    return this.api.patch<Profile>(`admin/users/${id}`, profile);
  }

  deleteProfile(id: string): Promise<void> {
    return this.api.delete<void>(`admin/users/${id}`);
  }
}
