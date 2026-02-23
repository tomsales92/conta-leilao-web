import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private _client: SupabaseClient | null = null;

  get client(): SupabaseClient {
    if (!this._client) {
      const { supabaseUrl, supabaseAnonKey } = environment;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          'Supabase não configurado. Defina supabaseUrl e supabaseAnonKey em src/environments/environment.ts (copie do .env do teste-cursor).'
        );
      }
      this._client = createClient(supabaseUrl, supabaseAnonKey);
    }
    return this._client;
  }
}
