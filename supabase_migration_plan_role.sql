-- ============================================
-- Migração: Colunas plan e role na tabela profiles
-- ============================================
-- Execute no Supabase SQL Editor.
-- Novos usuários (cadastro ou Google) passam a nascer com plan='free' e role='user'.
-- Para dar acesso admin a um usuário, atualize manualmente: UPDATE profiles SET role = 'admin' WHERE email = 'seu@email.com';

-- 1. Adicionar colunas plan e role
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Garantir defaults para registros já existentes (opcional)
UPDATE public.profiles SET plan = 'free' WHERE plan IS NULL;
UPDATE public.profiles SET role = 'user' WHERE role IS NULL;

-- 2. Atualizar a função do trigger: nome/sobrenome vêm do cadastro ou do Google (given_name, family_name, full_name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  fn TEXT;
  ln TEXT;
  full_name TEXT;
BEGIN
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  fn := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'given_name'), ''),
    NULLIF(TRIM(SPLIT_PART(full_name, ' ', 1)), '')
  );
  ln := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'family_name'), ''),
    CASE WHEN POSITION(' ' IN full_name) > 0
      THEN NULLIF(TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)), '')
      ELSE NULL
    END
  );
  INSERT INTO public.profiles (id, first_name, last_name, date_of_birth, gender, email, plan, role)
  VALUES (
    NEW.id,
    fn,
    ln,
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    NEW.raw_user_meta_data->>'gender',
    NEW.email,
    'free',
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função que verifica se o usuário atual é admin (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 4. Políticas: usuário lê/atualiza próprio perfil OU é admin
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id OR public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (public.current_user_is_admin());

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id OR public.current_user_is_admin());

-- Nota: se existirem políticas antigas como "Users can view own profile", podem coexistir
-- (várias políticas para o mesmo comando são unidas com OR). Se der conflito de nome, use
-- DROP POLICY "nome_antigo" ON public.profiles; antes de rodar esta migração.
