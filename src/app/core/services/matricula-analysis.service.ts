import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

const BUCKET = 'matriculas';
const ANALYZE_FN_URL = `${environment.supabaseUrl}/functions/v1/analyze-matricula`;

export interface AnalyzeResult {
  job_id: string;
  status: 'done';
  confidence: number;
}

export interface AnalyzeError {
  error: string;
  job_id?: string;
}

/** Estrutura do relatório exibido na tela (report_json da Edge Function). */
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
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Faz upload do PDF para o bucket matriculas (path: userId/nome-do-arquivo)
   * e chama a Edge Function analyze-matricula.
   * Requer usuário logado.
   */
  async uploadAndAnalyze(file: File, userId: string): Promise<AnalyzeResult> {
    const path = `${userId}/${file.name}`;

    const { data: uploadData, error: uploadError } = await this.supabase.client.storage
      .from(BUCKET)
      .upload(path, file, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      throw new Error('Falha no upload: ' + (uploadError.message ?? 'tente novamente'));
    }
    if (!uploadData?.path) {
      throw new Error('Upload não retornou o caminho do arquivo');
    }

    // Força renovação da sessão para evitar envio de JWT inválido/expirado.
    const { data: refreshed } = await this.supabase.client.auth.refreshSession();
    let accessToken = refreshed?.session?.access_token;
    if (!accessToken) {
      const { data: sessionData } = await this.supabase.client.auth.getSession();
      accessToken = sessionData?.session?.access_token;
    }
    if (!accessToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    if (accessToken.split('.').length !== 3) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }
    const { error: userError } = await this.supabase.client.auth.getUser(accessToken);
    if (userError) {
      await this.supabase.client.auth.signOut({ scope: 'local' });
      throw new Error(`Sessão inválida no Supabase (${userError.message}). Faça login novamente.`);
    }

    const res = await fetch(ANALYZE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: environment.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ storage_path: uploadData.path }),
    });

    const result = (await res.json().catch(() => null)) as AnalyzeResult | AnalyzeError | { message?: string } | null;
    if (!res.ok) {
      const msg =
        (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' && result.error) ||
        (result && typeof result === 'object' && 'message' in result && typeof result.message === 'string' && result.message) ||
        'Erro ao analisar matrícula';
      if (res.status === 401 || String(msg).toLowerCase().includes('jwt') || String(msg).toLowerCase().includes('unauthorized')) {
        throw new Error(`Sessão expirada ou inválida (${msg}). Faça login novamente.`);
      }
      throw new Error(msg);
    }
    if (!result) {
      throw new Error('Resposta inválida da função');
    }
    if ('error' in result && result.error) {
      const msg = result.job_id ? `${result.error} (job: ${result.job_id})` : result.error;
      throw new Error(msg);
    }
    return result as AnalyzeResult;
  }

  /**
   * Busca o status do job (para polling, se no futuro a função retornar job_id antes de concluir).
   */
  async getJob(jobId: string): Promise<{ status: string; error: string | null } | null> {
    const { data, error } = await this.supabase.client
      .from('matricula_jobs')
      .select('status, error')
      .eq('id', jobId)
      .single();

    if (error || !data) return null;
    return { status: data.status, error: data.error };
  }

  /**
   * Busca o relatório quando o job está com status 'done'.
   */
  async getReport(jobId: string): Promise<{
    facts_json: unknown;
    report_json: MatriculaReportJson;
    confidence: number;
  } | null> {
    const { data, error } = await this.supabase.client
      .from('matricula_reports')
      .select('facts_json, report_json, confidence')
      .eq('job_id', jobId)
      .single();

    if (error || !data) return null;
    return {
      facts_json: data.facts_json,
      report_json: (data.report_json ?? {}) as MatriculaReportJson,
      confidence: data.confidence ?? 0,
    };
  }
}
