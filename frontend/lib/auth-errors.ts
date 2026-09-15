import { ApiError } from "./api";

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mail ou senha inválidos. Confira os dados e tente novamente.",
  ACCOUNT_SUSPENDED: "Esta conta está suspensa. Fale com o administrador da empresa.",
  MFA_REQUIRED: "Informe o código de seis dígitos do seu aplicativo autenticador.",
  INVALID_TOTP: "O código do autenticador está incorreto ou expirou.",
  EMAIL_TAKEN: "Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.",
  TOO_MANY_REQUESTS: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
  SESSION_EXPIRED: "Sua sessão expirou. Entre novamente para continuar.",
  API_UNAVAILABLE: "Não foi possível conectar ao servidor. Verifique se a API está disponível.",
  OAUTH_NOT_CONFIGURED: "Este provedor ainda não está configurado neste ambiente.",
  BAD_REQUEST: "Confira os campos informados e tente novamente.",
};

export function authErrorMessage(error: unknown) {
  if (error instanceof ApiError) return messages[error.code] ?? error.message;
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export function authErrorCode(error: unknown) {
  return error instanceof ApiError ? error.code : "ERROR";
}
