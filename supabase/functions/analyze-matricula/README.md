# Edge Function: analyze-matricula

Recebe o **caminho do PDF no Supabase Storage**, baixa o arquivo, chama a API da OpenAI em duas etapas (extrair fatos → gerar relatório), valida os JSONs e persiste em `matricula_jobs` e `matricula_reports`. O status do job é atualizado em tempo real: `queued` → `processing` → `done` ou `error`.

## Pré-requisitos

1. **Migration aplicada**: tabelas `matricula_jobs` e `matricula_reports` (ver `supabase/migrations/20250223100000_matricula_jobs_and_reports.sql`).

2. **Bucket no Storage**: crie um bucket (ex.: `matriculas`) e defina políticas para o usuário autenticado poder fazer upload. A função usa o bucket `matriculas` por padrão; pode ser alterado no body.

3. **Secrets da função** — veja [Configurar secrets](#configurar-secrets) abaixo.

## Configurar secrets

A função usa variáveis de ambiente (secrets). Configure-as de uma das formas abaixo.

### Opção 1: Supabase Dashboard

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) e abra o projeto.
2. No menu lateral: **Project Settings** (ícone de engrenagem) → **Edge Functions**.
3. Na seção **Secrets**, clique em **Add new secret** e crie:
   - **Name:** `OPENAI_API_KEY`  
     **Value:** sua chave da API OpenAI (ex.: `sk-proj-...`).  
     Obtenha em [API Keys](https://platform.openai.com/api-keys).
   - (Opcional) **Name:** `OPENAI_MODEL`  
     **Value:** modelo com visão e structured outputs (padrão: `gpt-4o`). Ex.: `gpt-4o`, `gpt-4o-mini`.

### Opção 2: Supabase CLI

No terminal, na pasta do projeto (onde está o `supabase/`):

```bash
# Obrigatório: chave da OpenAI
supabase secrets set OPENAI_API_KEY=sk-proj-sua-chave-aqui

# Opcional: modelo (padrão é gpt-4o)
supabase secrets set OPENAI_MODEL=gpt-4o
```

Os secrets são aplicados a **todas** as Edge Functions do projeto. Após alterar, faça redeploy da função:

```bash
supabase functions deploy analyze-matricula
```

---

## Request

- **Método:** `POST`
- **Headers:** `Authorization: Bearer <JWT do usuário>`, `Content-Type: application/json`
- **Body (JSON):**
  - `storage_path` (obrigatório): caminho do arquivo no bucket, ex. `user-123/matricula.pdf`
  - `bucket` (opcional): nome do bucket; padrão `matriculas`

## Resposta de sucesso (200)

```json
{
  "job_id": "uuid",
  "status": "done",
  "confidence": 75
}
```

Em caso de erro, a resposta inclui `job_id` e a tabela `matricula_jobs` terá `status = 'error'` e `error` preenchido.

## Exemplo de chamada

### 1. Upload do PDF para o Storage (frontend ou cliente)

Use o cliente Supabase para fazer upload e obter o `path`:

```typescript
const { data, error } = await supabase.storage
  .from('matriculas')
  .upload(`${userId}/${file.name}`, file, { contentType: 'application/pdf', upsert: true });

if (error) throw error;
const storagePath = data.path; // ex.: "user-uuid/matricula.pdf"
```

### 2. Chamar a Edge Function

```typescript
const { data, error } = await supabase.functions.invoke('analyze-matricula', {
  body: { storage_path: storagePath },
});

if (error) throw error;
// data.job_id, data.status, data.confidence
```

### 3. Acompanhar o status do job (polling ou realtime)

```typescript
const { data: job } = await supabase
  .from('matricula_jobs')
  .select('id, status, error, updated_at')
  .eq('id', jobId)
  .single();
```

Quando `status === 'done'`, buscar o relatório:

```typescript
const { data: report } = await supabase
  .from('matricula_reports')
  .select('facts_json, report_json, confidence')
  .eq('job_id', jobId)
  .single();
```

### Exemplo com cURL

```bash
# Obtenha o JWT do usuário (ex.: após login) e defina:
JWT="eyJhbGciOiJIUzI1NiIs..."
PROJECT_REF="seu-project-ref"
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/analyze-matricula"

curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"storage_path": "user-123/matricula.pdf"}'
```

Resposta esperada (sucesso):

```json
{"job_id":"...","status":"done","confidence":75}
```
