# Login com Google (OAuth)

O app já tem o botão e o fluxo implementados. Para funcionar, configure **Google Cloud** e **Supabase**.

---

## 1. Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto ou selecione um existente.
3. Vá em **APIs e Serviços** → **Credenciais**.
4. Clique em **+ Criar credenciais** → **ID do cliente OAuth**.
5. Se pedir, configure a **tela de consentimento OAuth**:
   - Tipo: **Externo** (ou Interno se for só para usuários do seu Workspace).
   - Preencha nome do app, e-mail de suporte, etc.
   - Em **Escopos**, adicione: `email`, `profile`, `openid`.
   - Salve e volte para criar a credencial.
6. Tipo de aplicativo: **Aplicativo da Web**.
7. Nome: ex. `Conta Leilão Web`.
8. Em **URIs de redirecionamento autorizados**, adicione **exatamente**:
   ```
   https://SEU_PROJECT_REF.supabase.co/auth/v1/callback
   ```
   Troque `SEU_PROJECT_REF` pelo ref do seu projeto Supabase (ex.: `xzoqeepndndkklztpgqz`).
   - O ref está na URL do dashboard: `https://supabase.com/dashboard/project/xzoqeepndndkklztpgqz` → ref é `xzoqeepndndkklztpgqz`.
9. Clique em **Criar**.
10. Copie o **ID do cliente** e o **Segredo do cliente** (você usará no Supabase).

---

## 2. Supabase Dashboard

1. Acesse [Supabase](https://supabase.com/dashboard) → seu projeto.
2. Vá em **Authentication** → **Providers**.
3. Encontre **Google** e ative (toggle **Enabled**).
4. Cole:
   - **Client ID (for OAuth)**: o ID do cliente do Google.
   - **Client Secret (for OAuth)**: o segredo do cliente do Google.
5. Salve.

---

## 3. URLs de redirecionamento (Supabase) — importante para produção

1. Em **Authentication** → **URL Configuration**.
2. **Site URL**: use a URL principal do app em produção, ex. `https://www.contaleilao.com.br`.  
   (Se estiver como `http://localhost:4200`, o Supabase pode redirecionar para o localhost após o Google e dar “Não é possível acessar esse site” em produção.)
3. Em **Redirect URLs**, adicione **as duas**:
   - Desenvolvimento: `http://localhost:4200/**`
   - Produção: `https://www.contaleilao.com.br/**`
   O `/**` permite qualquer path (ex.: `/onboarding`).
4. Salve.

---

## 4. Comportamento no app

- **Login**: o usuário clica em **Continuar com o Google** → é redirecionado ao Google → após autorizar, volta para **`/onboarding`** já logado.
- **Primeiro acesso**: o Supabase cria o usuário no Auth e o trigger `handle_new_user` cria o perfil em `profiles` com `plan = 'free'` e `role = 'user'` (conforme a migração `supabase_migration_plan_role.sql`).

---

## Resumo rápido

| Onde | O quê |
|------|--------|
| Google Cloud | Criar credenciais OAuth (Web), adicionar URI de redirecionamento `https://SEU_REF.supabase.co/auth/v1/callback` |
| Supabase Providers | Habilitar Google e colar Client ID e Client Secret |
| Supabase URL Configuration | Incluir `http://localhost:4200/**` e a URL de produção em Redirect URLs |

Depois disso, o botão **Continuar com o Google** na tela de login deve funcionar.
