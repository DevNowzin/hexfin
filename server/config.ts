import { DEFAULT_AI_MODEL, DEFAULT_AI_TIMEOUT_MS } from '../src/features/ai/anthropic.ts';

type Env = Record<string, string | undefined>;

export interface ServerConfig {
  port: number;
  host: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl?: string;
  aiTimeoutMs: number;
  /** Token que o app envia em `Authorization: Bearer`. Obrigatório. */
  appToken: string;
  /** Origem liberada no CORS (preview Web). Vazio = sem CORS. */
  allowedOrigin?: string;
  rateLimitPerMinute: number;
}

function readInt(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return value;
}

function readRequired(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Variável ${name} não definida.`);
  return value;
}

export function loadConfig(env: Env = process.env): ServerConfig {
  const appToken = readRequired(env, 'HEXFIN_APP_TOKEN');
  if (appToken.length < 24) throw new Error('HEXFIN_APP_TOKEN precisa de pelo menos 24 caracteres.');
  return {
    port: readInt(env, 'PORT', 8787, 1, 65535),
    host: env.HOST?.trim() || '127.0.0.1',
    aiApiKey: readRequired(env, 'AI_API_KEY'),
    aiModel: env.AI_MODEL?.trim() || DEFAULT_AI_MODEL,
    aiBaseUrl: env.AI_BASE_URL?.trim() || undefined,
    aiTimeoutMs: readInt(env, 'AI_TIMEOUT_MS', DEFAULT_AI_TIMEOUT_MS, 1000, 60000),
    appToken,
    allowedOrigin: env.AI_ALLOWED_ORIGIN?.trim() || undefined,
    rateLimitPerMinute: readInt(env, 'AI_RATE_LIMIT_PER_MINUTE', 30, 1, 10000),
  };
}
