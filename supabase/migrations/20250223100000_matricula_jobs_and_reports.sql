-- Tabelas para análise de matrícula (Edge Function analyze-matricula).
-- Não reaproveita nenhuma tabela anterior.

-- Status do job: queued -> processing -> done | error
CREATE TABLE matricula_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'matriculas',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_matricula_jobs_user_id ON matricula_jobs(user_id);
CREATE INDEX idx_matricula_jobs_status ON matricula_jobs(status);
CREATE INDEX idx_matricula_jobs_created_at ON matricula_jobs(created_at DESC);

-- Relatório gerado pela Edge Function (facts + report JSON)
CREATE TABLE matricula_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES matricula_jobs(id) ON DELETE CASCADE,
  facts_json jsonb NOT NULL,
  report_json jsonb NOT NULL,
  confidence int NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_matricula_reports_job_id ON matricula_reports(job_id);
CREATE INDEX idx_matricula_reports_confidence ON matricula_reports(confidence);

-- Atualizar updated_at em matricula_jobs
CREATE OR REPLACE FUNCTION set_matricula_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_matricula_jobs_updated_at
  BEFORE UPDATE ON matricula_jobs
  FOR EACH ROW
  EXECUTE PROCEDURE set_matricula_jobs_updated_at();

-- RLS: usuário vê apenas seus próprios jobs; reports via job ownership
ALTER TABLE matricula_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matricula_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY matricula_jobs_select_own ON matricula_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT/UPDATE em matricula_jobs só pela Edge Function (service role); usuário não insere direto.

CREATE POLICY matricula_reports_select_via_job ON matricula_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matricula_jobs j
      WHERE j.id = matricula_reports.job_id AND j.user_id = auth.uid()
    )
  );

-- Service role (Edge Function) precisa inserir/atualizar jobs e inserir reports
-- A função roda com service_role, então bypassa RLS; não criamos policy para INSERT/UPDATE em jobs.
-- Para o usuário não atualizar o próprio job (apenas a Edge Function), não damos UPDATE em matricula_jobs.
COMMENT ON TABLE matricula_jobs IS 'Jobs de análise de matrícula; status atualizado pela Edge Function analyze-matricula';
COMMENT ON TABLE matricula_reports IS 'Relatório (fatos + análise) gerado por analyze-matricula';
