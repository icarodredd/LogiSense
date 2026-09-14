export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export interface OAuthConfig {
  google: { clientId: string; clientSecret: string; callbackUrl: string };
  github: { clientId: string; clientSecret: string; callbackUrl: string };
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  frontendUrl: string;
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  jwt: JwtConfig;
  oauth: OAuthConfig;
  mfa: { encryptionKey: string };
  cookieSecure: boolean;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default (): AppConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3001),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    jwt: {
      // Secrets obrigatórios: falham no boot em vez de usar default inseguro.
      accessSecret: required('JWT_ACCESS_SECRET', isProduction ? undefined : 'dev-access-secret'),
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      // Refresh tokens são opacos (armazenados com hash no banco + rotação),
      // por isso não há segredo de assinatura para eles.
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    },
    cookieSecure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : isProduction,
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        callbackUrl:
          process.env.GOOGLE_CALLBACK_URL ??
          'http://localhost:3001/api/auth/google/callback',
      },
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
        callbackUrl:
          process.env.GITHUB_CALLBACK_URL ??
          'http://localhost:3001/api/auth/github/callback',
      },
    },
    mfa: {
      // Chave que cifra segredos TOTP em repouso (AES-256-GCM).
      // Obrigatória em produção: falha no boot em vez de default inseguro.
      encryptionKey: required('MFA_ENCRYPTION_KEY', isProduction ? undefined : 'dev-mfa-key'),
    },
  };
};
