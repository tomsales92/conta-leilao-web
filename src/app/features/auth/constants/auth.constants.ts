/** Chaves usadas no localStorage para "Salvar usuário" (login). */
export const AUTH_STORAGE_KEYS = {
  remember: 'login_remember_credentials',
  email: 'login_saved_email',
  password: 'login_saved_password',
} as const;

/** Mensagens exibidas ao usuário em caso de erro no login. */
export const LOGIN_ERROR_MESSAGES = {
  invalidCredentials: 'E-mail ou senha incorretos. Verifique os dados e tente novamente.',
  providerNotEnabled: 'Login com Google ainda não está disponível. Use e-mail e senha.',
  generic: 'Erro ao entrar. Tente novamente.',
} as const;

/** Padrões de mensagem que indicam credenciais inválidas. */
export const INVALID_CREDENTIALS_PATTERNS = [
  'invalid login credentials',
  'invalid email or password',
  'credenciais inválidas',
  'senha incorreta',
  'invalid credentials',
] as const;
