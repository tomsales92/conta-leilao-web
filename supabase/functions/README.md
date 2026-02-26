# Edge Functions

## admin-create-user

Cria usuário pelo **Auth Admin API** (service role), aceitando **qualquer e-mail** (inclusive corporativos como `@contaleilao.com`). Só pode ser chamada por um usuário com `role = 'admin'` na tabela `profiles`.

### Deploy

1. Instale o [Supabase CLI](https://supabase.com/docs/guides/cli) se ainda não tiver.
2. Na pasta do projeto (`conta-leilao-web`), faça login e link ao projeto:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   ```
   O `project-ref` está na URL do projeto no dashboard (ex.: `https://supabase.com/dashboard/project/xzoqeepndndkklztpgqz` → ref é `xzoqeepndndkklztpgqz`).
3. Faça o deploy da function:
   ```bash
   npx supabase functions deploy admin-create-user
   ```
4. As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetadas automaticamente no ambiente da function; não é preciso configurá-las manualmente.

Depois do deploy, o botão **Adicionar** na tela Admin passará a usar essa function e aceitará e-mails corporativos.
