import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface AnalyzeResult {
  job_id: string;
  status: string;
  confidence: number;
}

export interface MatriculaFactsJson {
  identificacao?: {
    municipio_uf?: string | null;
    numero_matricula?: string | null;
    endereco?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MatriculaReportJson {
  resumo_executivo?: string;
  linha_do_tempo?: Array<{
    data?: string | null;
    data_desconhecida?: boolean;
    tipo?: string;
    descricao_curta?: string;
    impacto_no_arremate?: 'baixo' | 'medio' | 'alto';
    referencia?: { pagina?: string; trecho?: string };
  }>;
  onus_e_gravames?: Array<{
    tipo?: string;
    status?: string;
    detalhes?: string | null;
    impacto_no_arremate?: 'baixo' | 'medio' | 'alto';
    referencia?: { pagina?: string; trecho?: string };
  }>;
  pontos_de_atencao_para_arremate?: Array<{ prioridade?: string; descricao?: string }>;
  itens_a_confirmar_no_cartorio?: string[];
  confianca?: number;
  fontes?: Array<{ pagina?: string; trecho?: string; usado_em?: string[] }>;
}

@Injectable({ providedIn: 'root' })
export class MatriculaAnalysisService {
  private readonly api = inject(ApiService);

  async uploadAndAnalyze(file: File): Promise<AnalyzeResult> {
    const uploaded = await this.api.uploadFile<{ path: string }>('storage/matriculas', file);

    const job = await this.api.post<{ jobId: string; status: string }>('analyze-matricula', {
      storagePath: uploaded.path,
    });

    return { job_id: job.jobId, status: job.status, confidence: 0 };
  }

  async pollUntilDone(jobId: string, maxWaitMs = 120_000): Promise<AnalyzeResult> {
    const interval = 3_000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      const job = await this.api.get<{ status: string; error: string | null; confidence: number | null }>(
        `analyze-matricula/${jobId}/status`
      );

      if (job.status === 'Done') {
        return { job_id: jobId, status: job.status, confidence: job.confidence ?? 0 };
      }
      if (job.status === 'Error') {
        throw new Error(job.error ?? 'Erro ao analisar matrícula.');
      }

      await delay(interval);
    }

    throw new Error('Tempo limite de análise excedido. Tente novamente.');
  }

  async getReport(jobId: string): Promise<{
    facts_json: MatriculaFactsJson;
    report_json: MatriculaReportJson;
    confidence: number;
  } | null> {
    try {
      const data = await this.api.get<{
        factsJson: MatriculaFactsJson;
        reportJson: MatriculaReportJson;
        confidence: number;
      }>(`matricula-reports/${jobId}`);

      return {
        facts_json:  data.factsJson  ?? {},
        report_json: data.reportJson ?? {},
        confidence:  data.confidence ?? 0,
      };
    } catch {
      return null;
    }
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
