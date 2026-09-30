export interface Config {
  port: number;
  jwtSecret: string;
  ingestKey: string;
  staleMs: number;
  expireMs: number;
  databaseUrl: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 5000),
    jwtSecret: env.JWT_SECRET ?? "harborwatch-dev-jwt-change-me",
    ingestKey: env.INGEST_KEY ?? "harborwatch-ingest-dev",
    staleMs: Number(env.STALE_MS ?? 15_000),
    expireMs: Number(env.EXPIRE_MS ?? 45_000),
    databaseUrl: env.DATABASE_URL ?? "memory://harborwatch",
    logLevel: (env.LOG_LEVEL as Config["logLevel"]) ?? "info",
  };
}
