import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface IptuMunicipioStrategy {
  consulta_url: string | null;
  instrucoes: string | null;
  campos_requeridos: string[];
  tipo: 'linkOnly' | 'scrape' | 'api';
  observacoes: string | null;
}

@Injectable({ providedIn: 'root' })
export class IptuMunicipiosService {
  private readonly api = inject(ApiService);

  async getStrategy(uf: string, municipio: string): Promise<IptuMunicipioStrategy | null> {
    const ufNorm = uf.trim().toUpperCase().slice(0, 2);
    const munNorm = municipio.trim().toLowerCase().replace(/\s+/g, ' ');
    try {
      return await this.api.get<IptuMunicipioStrategy>(
        `iptu-municipios/strategy?uf=${encodeURIComponent(ufNorm)}&municipio=${encodeURIComponent(munNorm)}`
      );
    } catch {
      return null;
    }
  }
}
