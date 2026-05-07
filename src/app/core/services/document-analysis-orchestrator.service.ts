import { Injectable, inject } from '@angular/core';
import { MatriculaAnalysisService } from './matricula-analysis.service';
import type { MatriculaFactsJson, MatriculaReportJson } from './matricula-analysis.service';
import { IptuService, type IptuQueryResult, type IptuQueryPayload } from './iptu.service';
import { ApiService } from './api.service';

export type PipelineStepId = 'document' | 'municipio' | 'iptu_auto' | 'iptu_assisted';

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  detail?: string;
  at?: string;
}

export interface IptuStrategy {
  type: 'api' | 'scrape' | 'linkOnly';
  url?: string;
  instructions?: string[];
  requiredFields?: string[];
  observacao?: string;
}

export interface UnifiedReport {
  matriculaJobId: string;
  analysisJobId?: string;
  report: MatriculaReportJson | null;
  facts: MatriculaFactsJson | null;
  confidence: number;
  iptuStatus: 'success' | 'assisted' | 'unavailable' | 'skipped';
  iptuResult?: IptuQueryResult | null;
  iptuStrategy?: IptuStrategy | null;
  iptuPrefilled?: { uf: string; municipio: string; inscricao?: string; exercicio?: string };
  iptuAssistedEvidence?: { textoColado?: string; anexoPath?: string } | null;
  error?: string;
}

function parseMunicipioUf(municipioUf: string | null | undefined): { municipio: string; uf: string } | null {
  const s = (municipioUf ?? '').trim();
  if (!s) return null;
  const match = s.match(/^(.+?)\s*[\/\-\(,]\s*([A-Za-z]{2})\s*\)?$/);
  if (match) return { municipio: match[1].trim(), uf: match[2].trim().toUpperCase().slice(0, 2) };
  if (s.length >= 2) {
    const uf = s.slice(-2).toUpperCase();
    const municipio = s.slice(0, -2).replace(/[\s\-,\/]+$/, '').trim();
    if (/^[A-Z]{2}$/.test(uf) && municipio) return { municipio, uf };
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class DocumentAnalysisOrchestratorService {
  private readonly matricula = inject(MatriculaAnalysisService);
  private readonly iptu      = inject(IptuService);
  private readonly api       = inject(ApiService);

  async run(
    file: File,
    userId: string,
    onStep: (step: PipelineStep) => void
  ): Promise<UnifiedReport> {
    const etapas: PipelineStep[] = [];
    const tempos: Record<string, string> = {};
    const erros:  Record<string, string> = {};

    const emit = (step: PipelineStep) => {
      onStep(step);
      const idx = etapas.findIndex((s) => s.id === step.id);
      if (idx >= 0) etapas[idx] = { ...step, at: new Date().toISOString() };
      else          etapas.push({ ...step, at: new Date().toISOString() });
    };

    let matriculaJobId: string | null = null;
    let analysisJobId:  string | null = null;
    let report:         MatriculaReportJson | null = null;
    let facts:          MatriculaFactsJson  | null = null;
    let confidence      = 0;
    let iptuStatus:     UnifiedReport['iptuStatus'] = 'skipped';
    let iptuResult:     IptuQueryResult | null = null;
    let iptuStrategy:   IptuStrategy   | null = null;
    let iptuPrefilled:  UnifiedReport['iptuPrefilled'];
    let nonBlockingWarning: string | undefined;

    try {
      // ── Etapa 1: extrair dados do documento ─────────────────────────────
      emit({ id: 'document', label: 'Extraindo dados do documento', status: 'running' });
      const t0  = Date.now();
      const job = await this.matricula.uploadAndAnalyze(file);
      matriculaJobId = job.job_id;

      const done = await this.matricula.pollUntilDone(job.job_id);
      confidence = done.confidence;

      const full = await this.matricula.getReport(job.job_id);
      if (!full) throw new Error('Relatório não encontrado');
      report = full.report_json;
      facts  = full.facts_json;
      tempos['document'] = `${Date.now() - t0}ms`;
      emit({ id: 'document', label: 'Extraindo dados do documento', status: 'done', detail: 'Concluído' });

      // ── Criar analysis_job para pipeline ────────────────────────────────
      try {
        const aj = await this.api.post<{ id: string }>('analysis-jobs', {
          matriculaJobId,
          etapas,
        });
        analysisJobId = aj.id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        nonBlockingWarning = `Análise concluída, mas o chat está indisponível (${msg}).`;
      }

      // ── Etapa 2: identificar município ───────────────────────────────────
      const parsed    = parseMunicipioUf(facts.identificacao?.municipio_uf ?? undefined);
      const inscricao = facts.identificacao?.numero_matricula ?? undefined;
      iptuPrefilled   = parsed
        ? { uf: parsed.uf, municipio: parsed.municipio, inscricao: inscricao ? String(inscricao).trim() : undefined }
        : undefined;

      emit({ id: 'municipio', label: 'Identificando município e método de consulta', status: 'running' });

      if (!parsed) {
        emit({ id: 'municipio', label: 'Identificando município e método de consulta', status: 'done', detail: 'Município/UF não identificado' });
        iptuStatus = 'unavailable';
      } else {
        emit({ id: 'municipio', label: 'Identificando município e método de consulta', status: 'done', detail: `${parsed.municipio} / ${parsed.uf}` });

        // ── Etapa 3: consulta automática de IPTU ──────────────────────────
        emit({ id: 'iptu_auto', label: 'Tentando consulta automática do IPTU', status: 'running' });
        const t1 = Date.now();
        try {
          const payload: IptuQueryPayload | undefined = iptuPrefilled?.inscricao
            ? { inscricao_imobiliaria: iptuPrefilled.inscricao }
            : undefined;

          iptuResult   = await this.iptu.consultar(parsed.uf, parsed.municipio, payload);
          tempos['iptu'] = `${Date.now() - t1}ms`;
          iptuStrategy = {
            type:         iptuResult.fonte?.tipo === 'AUTO' ? 'api' : 'linkOnly',
            url:          iptuResult.link_oficial ?? iptuResult.fonte?.consulta_url,
            instructions: iptuResult.instrucoes,
            requiredFields: iptuResult.required_fields,
            observacao:   iptuResult.fonte?.observacao,
          };

          if (iptuResult.situacao === 'COM_DEBITO' || iptuResult.situacao === 'SEM_DEBITO') {
            iptuStatus = 'success';
            emit({ id: 'iptu_auto', label: 'Tentando consulta automática do IPTU', status: 'done', detail: `Situação: ${iptuResult.situacao}` });
          } else {
            iptuStatus = 'assisted';
            emit({ id: 'iptu_assisted', label: 'Consulta assistida necessária', status: 'running', detail: 'Use o link e os dados abaixo' });
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Erro ao consultar IPTU';
          erros['iptu'] = errMsg;
          iptuStatus   = 'assisted';
          iptuResult   = null;
          iptuStrategy = { type: 'linkOnly', instructions: ['Consulte o portal da prefeitura para IPTU/2ª via.'], observacao: errMsg };
          emit({ id: 'iptu_assisted', label: 'Consulta assistida necessária', status: 'running', detail: errMsg });
        }

        if (analysisJobId) {
          this.api.post('iptu-query-attempts', {
            analysisJobId,
            strategyType:    iptuStrategy?.type ?? 'linkOnly',
            payload:         iptuPrefilled ?? {},
            status:          iptuStatus === 'success' ? 'ok' : iptuStatus === 'assisted' ? 'assisted' : 'error',
            error:           erros['iptu'] ?? null,
            responseSnippet: iptuResult ? JSON.stringify(iptuResult) : null,
          }).catch(() => {});
        }
      }

      if (analysisJobId) {
        this.api.patch(`analysis-jobs/${analysisJobId}`, { status: 'Done', etapas, tempos, erros }).catch(() => {});
      }

      return {
        matriculaJobId: matriculaJobId!,
        analysisJobId:  analysisJobId ?? undefined,
        report, facts, confidence, iptuStatus,
        iptuResult:   iptuResult   ?? undefined,
        iptuStrategy: iptuStrategy ?? undefined,
        iptuPrefilled,
        error: nonBlockingWarning,
      };

    } catch (e) {
      const pipelineError = e instanceof Error ? e.message : 'Erro no pipeline';
      emit({ id: 'document', label: 'Extraindo dados do documento', status: 'error', detail: pipelineError });
      if (analysisJobId) {
        this.api.patch(`analysis-jobs/${analysisJobId}`, {
          status: 'Error',
          erros:  { ...erros, pipeline: pipelineError },
        }).catch(() => {});
      }
      throw new Error(pipelineError);
    }
  }

  async saveAssistedEvidence(
    analysisJobId: string,
    userId: string,
    textoColado?: string,
    anexoPath?: string
  ): Promise<void> {
    await this.api.post('iptu-assisted-evidence', {
      analysisJobId,
      textoColado: textoColado ?? null,
      anexoPath:   anexoPath   ?? null,
    });
    await this.api.patch(`analysis-jobs/${analysisJobId}`, { status: 'Done' });
  }
}
