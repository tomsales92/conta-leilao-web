-- Bucket "matriculas" para PDFs de matrícula (usado pela Edge Function analyze-matricula).
-- Usuários autenticados fazem upload apenas na própria pasta: {user_id}/...

-- Criar bucket (privado; a Edge Function usa service role para baixar)
INSERT INTO storage.buckets (id, name, public)
VALUES ('matriculas', 'matriculas', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Políticas: usuário só acessa arquivos em storage_path = auth.uid()::text / ...
DROP POLICY IF EXISTS "matriculas_select_own" ON storage.objects;
CREATE POLICY "matriculas_select_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'matriculas' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "matriculas_insert_own" ON storage.objects;
CREATE POLICY "matriculas_insert_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'matriculas' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "matriculas_update_own" ON storage.objects;
CREATE POLICY "matriculas_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'matriculas' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "matriculas_delete_own" ON storage.objects;
CREATE POLICY "matriculas_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'matriculas' AND (storage.foldername(name))[1] = auth.uid()::text);
