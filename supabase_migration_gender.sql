-- ============================================
-- Migração: Adicionar coluna gender na tabela profiles
-- ============================================
-- Execute no Supabase SQL Editor para usuários que já têm a tabela profiles.
-- Novos projetos podem usar o supabase_setup.sql atualizado.

-- 1. Adicionar coluna gender (M ou F)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT;

-- 2. Atualizar a função do trigger para incluir gender
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, date_of_birth, gender, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    (NEW.raw_user_meta_data->>'date_of_birth')::DATE,
    NEW.raw_user_meta_data->>'gender',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
