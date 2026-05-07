import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface IptuQueryPayload {
  inscricao_imobiliaria?: string;
  inscricao?: string;
  endereco?: string;
  exercicio?: string;
}

export interface IptuQueryResult {
  municipio: string;
  uf: string;
  inscricao_imobiliaria?: string;
  situacao: 'COM_DEBITO' | 'SEM_DEBITO' | 'NAO_CONSEGUI_CONSULTAR';
  debitos?: Array<{ exercicio: string; valor: number; status: string; vencimento?: string }>;
  total_aberto?: number;
  fonte: { tipo: string; consulta_url?: string; observacao?: string };
  link_oficial?: string;
  instrucoes?: string[];
  required_fields?: string[];
}

@Injectable({ providedIn: 'root' })
export class IptuService {
  private readonly api = inject(ApiService);

  consultar(uf: string, municipio: string, payload?: IptuQueryPayload): Promise<IptuQueryResult> {
    return this.api.post<IptuQueryResult>('iptu-query', {
      uf:        uf.trim().toUpperCase().slice(0, 2),
      municipio: municipio.trim(),
      payload:   payload ?? {},
    });
  }
}
