// Edge Function: analyze-matricula
// Recebe storage_path (e opcionalmente bucket), baixa o PDF do Storage,
// chama OpenAI em 2 etapas (extrair fatos -> gerar relatório), valida e salva em matricula_jobs + matricula_reports.
// Status do job: queued -> processing -> done | error

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const OPENAI_API = 'https://api.openai.com/v1';
const BUCKET_DEFAULT = 'matriculas';

function assertEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

// Validação mínima do JSON de fatos (Etapa A)
function validateFacts(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.identificacao === 'object' &&
    o.identificacao !== null &&
    Array.isArray(o.eventos) &&
    Array.isArray(o.onus_e_gravames)
  );
}

// Validação mínima do relatório (Etapa B)
function validateReport(obj: unknown): { ok: true; confidence: number } | { ok: false; reason: string } {
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'report must be an object' };
  const o = obj as Record<string, unknown>;
  if (typeof o.resumo_executivo !== 'string') return { ok: false, reason: 'missing resumo_executivo' };
  if (!Array.isArray(o.linha_do_tempo)) return { ok: false, reason: 'missing linha_do_tempo' };
  if (!Array.isArray(o.onus_e_gravames)) return { ok: false, reason: 'missing onus_e_gravames' };
  if (!Array.isArray(o.pontos_de_atencao_para_arremate)) return { ok: false, reason: 'missing pontos_de_atencao_para_arremate' };
  if (!Array.isArray(o.itens_a_confirmar_no_cartorio)) return { ok: false, reason: 'missing itens_a_confirmar_no_cartorio' };
  const conf = o.confianca;
  if (typeof conf !== 'number' || conf < 0 || conf > 100) return { ok: false, reason: 'confianca must be 0-100' };
  if (!Array.isArray(o.fontes)) return { ok: false, reason: 'missing fontes' };
  return { ok: true, confidence: conf };
}

const EXTRACTOR_SYSTEM = `Você é um especialista brasileiro em matrícula de imóvel, registro de imóveis e documentação cartorária.
Sua tarefa nesta etapa é APENAS EXTRAIR FATOS do documento fornecido. Não faça recomendações, não avalie impacto para arremate, não invente dados.
Regras: Extraia somente o que consta no documento. Se algo não constar ou estiver ilegível, use "não consta" ou "ilegível".
Para cada fato extraído, informe sempre que possível a referência: página e trecho citado.
Mantenha eventos em ordem cronológica quando houver data; quando não houver data, use data_desconhecida: true e data como null.
Tipos de evento: registro, averbacao, penhora, hipoteca, alienacao_fiduciaria, indisponibilidade, usufruto, servidao, clausula_restritiva, compra_venda, doacao, heranca, adjudicacao, arrematacao, outro.
Em ônus/gravames, indique status: ativo, baixado ou sem_info. Inclua menções a ocupação/posse/locação. Registre inconsistências.
Saída: retorne estritamente o JSON no schema fornecido, sem texto adicional.`;

const EXTRACTOR_USER = `Analise o documento de matrícula anexado e extraia todos os fatos objetivos no formato JSON definido. Não faça interpretações nem recomendações.`;

const ANALYST_SYSTEM = `Você é um especialista brasileiro em Registro de Imóveis, matrícula, ônus reais e leilões judiciais e extrajudiciais.
Sua tarefa é produzir um relatório de análise para quem deseja arrematar o imóvel, com base APENAS no JSON de fatos que você receberá. Não invente dados.
Regras: Resumo executivo 5 a 10 linhas. Linha do tempo com impacto_no_arremate (baixo/medio/alto). Ônus com impacto. pontos_de_atencao_para_arremate com prioridade (alta/media/baixa). itens_a_confirmar_no_cartorio. confianca 0-100. fontes com usado_em.
Não dê aconselhamento jurídico definitivo.`;

const ANALYST_USER_PREFIX = `Com base no JSON de fatos extraídos da matrícula abaixo, produza o relatório de análise para arremate no formato JSON definido. Use somente as informações contidas nos fatos.\n\n`;

// Schema reduzido para a API (strict JSON Schema) – apenas estrutura mínima para evitar tokens excessivos
const FACTS_SCHEMA = {
  name: 'facts_schema',
  strict: false,
  schema: {
    type: 'object',
    properties: {
      identificacao: {
        type: 'object',
        properties: {
          cartorio_servico: { type: ['string', 'null'] },
          numero_matricula: { type: ['string', 'null'] },
          livro_folha: { type: ['string', 'null'] },
          municipio_uf: { type: ['string', 'null'] },
          endereco: { type: ['string', 'null'] },
          descricao_imovel: { type: ['string', 'null'] },
          area: { type: ['string', 'null'] },
          confrontacoes: { type: ['string', 'null'] },
          fracao_ideal: { type: ['string', 'null'] },
          observacoes: { type: ['string', 'null'] },
        },
        required: ['cartorio_servico', 'numero_matricula'],
        additionalProperties: true,
      },
      eventos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            data: { type: ['string', 'null'] },
            data_desconhecida: { type: 'boolean' },
            tipo: { type: 'string' },
            descricao: { type: 'string' },
            referencia: { type: 'object', properties: { pagina: { type: 'string' }, trecho: { type: 'string' } }, required: ['pagina', 'trecho'] },
          },
          required: ['tipo', 'descricao', 'referencia'],
          additionalProperties: true,
        },
      },
      onus_e_gravames: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string' },
            status: { type: 'string', enum: ['ativo', 'baixado', 'sem_info'] },
            detalhes: { type: ['string', 'null'] },
            partes_envolvidas: { type: ['string', 'null'] },
            referencia: { type: 'object', properties: { pagina: { type: 'string' }, trecho: { type: 'string' } }, required: ['pagina', 'trecho'] },
          },
          required: ['tipo', 'status', 'referencia'],
          additionalProperties: true,
        },
      },
      mencoes_ocupacao_posse: { type: 'array', items: { type: 'object' } },
      inconsistencias: { type: 'array', items: { type: 'object' } },
    },
    required: ['identificacao', 'eventos', 'onus_e_gravames'],
    additionalProperties: true,
  },
};

const REPORT_SCHEMA = {
  name: 'report_schema',
  strict: false,
  schema: {
    type: 'object',
    properties: {
      resumo_executivo: { type: 'string' },
      linha_do_tempo: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            data: { type: ['string', 'null'] },
            data_desconhecida: { type: 'boolean' },
            tipo: { type: 'string' },
            descricao_curta: { type: 'string' },
            impacto_no_arremate: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
            referencia: { type: 'object', properties: { pagina: { type: 'string' }, trecho: { type: 'string' } }, required: ['pagina', 'trecho'] },
          },
          required: ['tipo', 'descricao_curta', 'impacto_no_arremate', 'referencia'],
          additionalProperties: true,
        },
      },
      onus_e_gravames: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string' },
            status: { type: 'string' },
            detalhes: { type: ['string', 'null'] },
            impacto_no_arremate: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
            referencia: { type: 'object', properties: { pagina: { type: 'string' }, trecho: { type: 'string' } }, required: ['pagina', 'trecho'] },
          },
          required: ['tipo', 'status', 'impacto_no_arremate', 'referencia'],
          additionalProperties: true,
        },
      },
      pontos_de_atencao_para_arremate: {
        type: 'array',
        items: {
          type: 'object',
          properties: { prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] }, descricao: { type: 'string' } },
          required: ['prioridade', 'descricao'],
          additionalProperties: true,
        },
      },
      itens_a_confirmar_no_cartorio: { type: 'array', items: { type: 'string' } },
      confianca: { type: 'number' },
      fontes: {
        type: 'array',
        items: {
          type: 'object',
          properties: { pagina: { type: 'string' }, trecho: { type: 'string' }, usado_em: { type: 'array', items: { type: 'string' } } },
          required: ['pagina', 'trecho', 'usado_em'],
          additionalProperties: true,
        },
      },
    },
    required: ['resumo_executivo', 'linha_do_tempo', 'onus_e_gravames', 'pontos_de_atencao_para_arremate', 'itens_a_confirmar_no_cartorio', 'confianca', 'fontes'],
    additionalProperties: true,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authorization header required (Bearer token)' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = assertEnv('SUPABASE_URL');
  const serviceRoleKey = assertEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user?.id) {
    return new Response(
      JSON.stringify({ error: 'Token inválido' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const userId = user.id;

  let body: { storage_path?: string; bucket?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body JSON inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const storagePath = (body.storage_path ?? '').trim();
  const bucket = (body.bucket ?? BUCKET_DEFAULT).trim() || BUCKET_DEFAULT;
  if (!storagePath) {
    return new Response(
      JSON.stringify({ error: 'storage_path é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const openaiKey = assertEnv('OPENAI_API_KEY');
  const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o';

  // 1) Criar job (queued)
  const { data: job, error: insertJobError } = await admin
    .from('matricula_jobs')
    .insert({
      status: 'queued',
      user_id: userId,
      storage_path: storagePath,
      bucket,
    })
    .select('id')
    .single();

  if (insertJobError || !job?.id) {
    return new Response(
      JSON.stringify({ error: 'Falha ao criar job: ' + (insertJobError?.message ?? 'unknown') }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const jobId = job.id;

  const setJob = async (status: 'processing' | 'done' | 'error', err?: string) => {
    await admin
      .from('matricula_jobs')
      .update({ status, error: err ?? null })
      .eq('id', jobId);
  };

  try {
    // 2) processing
    await setJob('processing');

    // 3) Baixar PDF do Storage
    const { data: pdfBlob, error: downloadError } = await admin.storage.from(bucket).download(storagePath);
    if (downloadError || !pdfBlob) {
      await setJob('error', 'Falha ao baixar PDF: ' + (downloadError?.message ?? 'arquivo não encontrado'));
      return new Response(
        JSON.stringify({ error: 'Falha ao baixar PDF', job_id: jobId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfBytes = await pdfBlob.arrayBuffer();
    const filename = storagePath.split('/').pop() ?? 'matricula.pdf';

    // 4) Upload do PDF para a OpenAI (Files API)
    const form = new FormData();
    form.append('purpose', 'user_data');
    form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), filename);

    const uploadRes = await fetch(`${OPENAI_API}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      await setJob('error', 'OpenAI upload: ' + errText.slice(0, 200));
      return new Response(
        JSON.stringify({ error: 'Falha ao enviar PDF para a OpenAI', detail: errText.slice(0, 500), job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uploadData = (await uploadRes.json()) as { id?: string };
    const fileId = uploadData.id;
    if (!fileId) {
      await setJob('error', 'OpenAI não retornou file_id');
      return new Response(
        JSON.stringify({ error: 'Resposta inválida da OpenAI (upload)', job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5) Etapa A: extrair fatos (Responses API)
    const inputA = [
      { type: 'message', role: 'developer', content: [{ type: 'input_text', text: EXTRACTOR_SYSTEM }] },
      {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_file', file_id: fileId },
          { type: 'input_text', text: EXTRACTOR_USER },
        ],
      },
    ];

    const resA = await fetch(`${OPENAI_API}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model,
        input: inputA,
        text: {
          format: {
            type: 'json_schema',
            name: FACTS_SCHEMA.name,
            schema: FACTS_SCHEMA.schema,
            strict: FACTS_SCHEMA.strict,
          },
        },
      }),
    });

    if (!resA.ok) {
      const errText = await resA.text();
      await setJob('error', 'OpenAI Etapa A: ' + errText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: 'Falha na extração de fatos (OpenAI)', detail: errText.slice(0, 700), job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataA = (await resA.json()) as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
      refusal?: string;
    };

    if (dataA.refusal) {
      await setJob('error', 'Modelo recusou: ' + dataA.refusal);
      return new Response(
        JSON.stringify({ error: 'Modelo recusou a solicitação', job_id: jobId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const msgA = dataA.output?.find((o) => o.type === 'message');
    const textItemA = msgA?.content?.find((c) => c.type === 'output_text');
    const rawFacts = textItemA?.text?.trim();
    if (!rawFacts) {
      await setJob('error', 'Resposta da OpenAI sem texto (Etapa A)');
      return new Response(
        JSON.stringify({ error: 'Resposta da OpenAI inválida (Etapa A)', job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let facts: unknown;
    try {
      facts = JSON.parse(rawFacts);
    } catch {
      await setJob('error', 'JSON de fatos inválido');
      return new Response(
        JSON.stringify({ error: 'JSON de fatos inválido', job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateFacts(facts)) {
      await setJob('error', 'Schema de fatos inválido (campos obrigatórios)');
      return new Response(
        JSON.stringify({ error: 'Schema de fatos inválido', job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6) Etapa B: relatório para arremate
    const inputB = [
      { type: 'message', role: 'developer', content: [{ type: 'input_text', text: ANALYST_SYSTEM }] },
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: ANALYST_USER_PREFIX + JSON.stringify(facts, null, 2) }],
      },
    ];

    const resB = await fetch(`${OPENAI_API}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model,
        input: inputB,
        text: {
          format: {
            type: 'json_schema',
            name: REPORT_SCHEMA.name,
            schema: REPORT_SCHEMA.schema,
            strict: REPORT_SCHEMA.strict,
          },
        },
      }),
    });

    if (!resB.ok) {
      const errText = await resB.text();
      await setJob('error', 'OpenAI Etapa B: ' + errText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: 'Falha na geração do relatório (OpenAI)', detail: errText.slice(0, 700), job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataB = (await resB.json()) as {
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
      refusal?: string;
    };

    if (dataB.refusal) {
      await setJob('error', 'Modelo recusou (Etapa B): ' + dataB.refusal);
      return new Response(
        JSON.stringify({ error: 'Modelo recusou na Etapa B', job_id: jobId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const msgB = dataB.output?.find((o) => o.type === 'message');
    const textItemB = msgB?.content?.find((c) => c.type === 'output_text');
    const rawReport = textItemB?.text?.trim();
    if (!rawReport) {
      await setJob('error', 'Resposta da OpenAI sem texto (Etapa B)');
      return new Response(
        JSON.stringify({ error: 'Resposta da OpenAI inválida (Etapa B)', job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let report: unknown;
    try {
      report = JSON.parse(rawReport);
    } catch {
      await setJob('error', 'JSON do relatório inválido');
      return new Response(
        JSON.stringify({ error: 'JSON do relatório inválido', job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reportValidation = validateReport(report);
    if (!reportValidation.ok) {
      await setJob('error', 'Schema do relatório inválido: ' + reportValidation.reason);
      return new Response(
        JSON.stringify({ error: 'Schema do relatório inválido: ' + reportValidation.reason, job_id: jobId }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7) Salvar em matricula_reports
    const { error: insertReportError } = await admin.from('matricula_reports').insert({
      job_id: jobId,
      facts_json: facts,
      report_json: report,
      confidence: reportValidation.confidence,
    });

    if (insertReportError) {
      await setJob('error', 'Falha ao salvar relatório: ' + insertReportError.message);
      return new Response(
        JSON.stringify({ error: 'Falha ao salvar relatório', job_id: jobId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8) done
    await setJob('done');

    return new Response(
      JSON.stringify({
        job_id: jobId,
        status: 'done',
        confidence: reportValidation.confidence,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await setJob('error', message);
    return new Response(
      JSON.stringify({ error: 'Erro interno', job_id: jobId, detail: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
