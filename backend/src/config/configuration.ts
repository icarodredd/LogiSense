export interface JwtConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  jwt: JwtConfig;
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
  };
};
