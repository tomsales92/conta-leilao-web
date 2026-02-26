import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

export type Plan = 'free' | 'premium';
export type ProfileRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  plan: Plan | null;
  role: ProfileRole | null;
  created_at?: string;
  updated_at?: string;
}

export type ProfileInsert = Omit<Profile, 'id' | 'created_at' | 'updated_at'> & { id?: string };
/** Payload para criar novo usuário pelo admin: inclui senha temporária. O perfil é criado via signUp + trigger e depois atualizado com plan/role. */
export type ProfileInsertWithPassword = ProfileInsert & { password: string };
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

const TABLE = 'profiles';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly supabase: SupabaseService) {}

  readonly selectFields = 'id, email, first_name, last_name, date_of_birth, gender, plan, role, created_at';

  async getProfileRole(id: string): Promise<ProfileRole | null> {
    const { data, error } = await this.supabase.client
      .from(TABLE)
      .select('role')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return (data?.role ?? null) as ProfileRole | null;
  }

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await this.supabase.client
      .from(TABLE)
      .select(this.selectFields)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Profile[];
  }

  async getProfile(id: string): Promise<Profile | null> {
    const { data, error } = await this.supabase.client
      .from(TABLE)
      .select(this.selectFields)
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as Profile;
  }

  /**
   * Cria um novo usuário via Edge Function (Auth Admin API).
   * Aceita qualquer e-mail (inclusive corporativos); não troca a sessão do admin.
   */
  async createUserWithProfile(payload: ProfileInsertWithPassword): Promise<Profile> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Sessão expirada. Faça login novamente.');

    const url = `${environment.supabaseUrl}/functions/v1/admin-create-user`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: (payload.email ?? '').trim(),
        password: payload.password,
        first_name: payload.first_name ?? null,
        last_name: payload.last_name ?? null,
        date_of_birth: payload.date_of_birth ?? null,
        gender: payload.gender ?? null,
        plan: payload.plan ?? 'free',
        role: payload.role ?? 'user',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Erro ao criar usuário.');
    }
    return data as Profile;
  }

  async updateProfile(id: string, profile: ProfileUpdate): Promise<Profile> {
    const payload: Record<string, unknown> = {
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      date_of_birth: profile.date_of_birth,
      gender: profile.gender,
      plan: profile.plan,
      role: profile.role,
    };
    const { data, error } = await this.supabase.client
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  }

  async deleteProfile(id: string): Promise<void> {
    const { error } = await this.supabase.client.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }
}
