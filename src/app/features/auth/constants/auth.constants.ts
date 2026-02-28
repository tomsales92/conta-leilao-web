/**
 * Constantes de autenticação.
 * Centraliza chaves de storage e mensagens para facilitar manutenção.
 */

/** Chaves usadas no localStorage para "Salvar usuário" (login). */
export const AUTH_STORAGE_KEYS = {
  remember: 'login_remember_credentials',
  email: 'login_saved_email',
  password: 'login_saved_password',
} as const;

/** Mensagens exibidas ao usuário em caso de erro no login. */
export const LOGIN_ERROR_MESSAGES = {
  invalidCredentials: 'E-mail ou senha incorretos. Verifique os dados e tente novamente.',
  providerNotEnabled:
    'Ative o provedor Google no Supabase: Authentication → Providers → Google (Client ID e Secret do Google Cloud).',
  generic: 'Erro ao entrar. Tente novamente.',
} as const;

/** Código de erro retornado pelo Supabase para credenciais inválidas. */
export const SUPABASE_ERROR_CODE_INVALID_CREDENTIALS = 'invalid_credentials';

/** Padrões de mensagem do Supabase que indicam credenciais inválidas. */
export const INVALID_CREDENTIALS_PATTERNS = [
  'invalid login credentials',
  'invalid email or password',
  'email not confirmed',
] as const;
