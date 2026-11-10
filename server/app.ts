// BFF do HexFin: valida, autentica, limita uso e chama a IA. Nunca registra payloads.
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { suggestionCacheKey, validateCategorizeRequest } from '../src/features/ai/categorize.ts';
import { insightsCacheKey, validateInsightsRequest } from '../src/features/ai/insights.ts';
import { AiError, type AiInsight, type CategorizeRequest, type CategorySuggestion, type InsightsRequest } from '../src/features/ai/types.ts';
import type { ServerConfig } from './config.ts';

export const MAX_BODY_BYTES = 2048;
const CACHE_LIMIT = 500;
const WINDOW_MS = 60_000;

export type CategorizeFn = (request: CategorizeRequest, signal: AbortSignal) => Promise<CategorySuggestion>;
export type InsightsFn = (request: InsightsRequest, signal: AbortSignal) => Promise<AiInsight[]>;

export interface AppDeps {
  config: Pick<ServerConfig, 'appToken' | 'allowedOrigin' | 'rateLimitPerMinute' | 'aiTimeoutMs'>;
  categorize: CategorizeFn;
  insights: InsightsFn;
  now?: () => number;
}

// Sem "parameter properties": o Node só remove tipos, não transforma TypeScript.
class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function isAuthorized(header: string | undefined, token: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const type = req.headers['content-type'] ?? '';
  if (!type.startsWith('application/json')) throw new HttpError(415, 'unsupported_media_type');
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

/** Janela fixa por cliente. Simples e suficiente para um único processo. */
function createRateLimiter(limit: number, now: () => number) {
  const hits = new Map<string, { windowStart: number; count: number }>();
  return (key: string): boolean => {
    const current = now();
    const entry = hits.get(key);
    if (!entry || current - entry.windowStart >= WINDOW_MS) {
      if (hits.size > 10_000) hits.clear();
      hits.set(key, { windowStart: current, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

function createCache<T>() {
  const entries = new Map<string, T>();
  return {
    get: (key: string) => entries.get(key),
    set(key: string, value: T) {
      if (entries.size >= CACHE_LIMIT) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key, value);
    },
  };
}

const AI_ERROR_STATUS: Record<string, number> = { timeout: 504, rate_limit: 503, refused: 422 };

export function createRequestHandler(deps: AppDeps) {
  const now = deps.now ?? Date.now;
  const allow = createRateLimiter(deps.config.rateLimitPerMinute, now);
  const cache = createCache<CategorySuggestion>();
  const insightsCache = createCache<AiInsight[]>();

  async function handleCategorize(req: IncomingMessage, res: ServerResponse, corsHeaders: Record<string, string>) {
    if (!isAuthorized(req.headers.authorization, deps.config.appToken)) throw new HttpError(401, 'unauthorized');
    if (!allow(req.socket.remoteAddress ?? 'unknown')) throw new HttpError(429, 'rate_limited');

    const validation = validateCategorizeRequest(await readJsonBody(req));
    if (!validation.ok) return sendJson(res, 400, { error: 'invalid_request', message: validation.error }, corsHeaders);

    const key = suggestionCacheKey(validation.value);
    const cached = cache.get(key);
    if (cached) return sendJson(res, 200, cached, corsHeaders);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.config.aiTimeoutMs);
    try {
      const suggestion = await deps.categorize(validation.value, controller.signal);
      cache.set(key, suggestion);
      return sendJson(res, 200, suggestion, corsHeaders);
    } catch (error) {
      const code = error instanceof AiError ? error.code : 'server';
      // Só o código do erro vai para o log: nunca a descrição da transação.
      console.warn(`[categorize] falha da IA: ${code}`);
      return sendJson(res, AI_ERROR_STATUS[code] ?? 502, { error: 'ai_unavailable', code }, corsHeaders);
    } finally {
      clearTimeout(timer);
    }
  }

  async function handleInsights(req: IncomingMessage, res: ServerResponse, corsHeaders: Record<string, string>) {
    if (!isAuthorized(req.headers.authorization, deps.config.appToken)) throw new HttpError(401, 'unauthorized');
    if (!allow(req.socket.remoteAddress ?? 'unknown')) throw new HttpError(429, 'rate_limited');

    // Validação estrita: só percentuais; qualquer campo a mais (ex.: valores em reais) é recusado.
    const validation = validateInsightsRequest(await readJsonBody(req));
    if (!validation.ok) return sendJson(res, 400, { error: 'invalid_request', message: validation.error }, corsHeaders);

    const key = insightsCacheKey(validation.value);
    const cached = insightsCache.get(key);
    if (cached) return sendJson(res, 200, { insights: cached }, corsHeaders);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deps.config.aiTimeoutMs);
    try {
      const insights = await deps.insights(validation.value, controller.signal);
      insightsCache.set(key, insights);
      return sendJson(res, 200, { insights }, corsHeaders);
    } catch (error) {
      const code = error instanceof AiError ? error.code : 'server';
      console.warn(`[insights] falha da IA: ${code}`);
      return sendJson(res, AI_ERROR_STATUS[code] ?? 502, { error: 'ai_unavailable', code }, corsHeaders);
    } finally {
      clearTimeout(timer);
    }
  }

  return async function handle(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin;
    const corsHeaders: Record<string, string> =
      deps.config.allowedOrigin && origin === deps.config.allowedOrigin
        ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
        : {};
    const path = (req.url ?? '/').split('?')[0];
    try {
      if (req.method === 'OPTIONS' && corsHeaders['Access-Control-Allow-Origin']) {
        res.writeHead(204, {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '600',
        });
        return res.end();
      }
      if (req.method === 'GET' && path === '/health') return sendJson(res, 200, { ok: true }, corsHeaders);
      if (path === '/api/ai/categorize') {
        if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
        return await handleCategorize(req, res, corsHeaders);
      }
      if (path === '/api/ai/insights') {
        if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed');
        return await handleInsights(req, res, corsHeaders);
      }
      throw new HttpError(404, 'not_found');
    } catch (error) {
      if (error instanceof HttpError) return sendJson(res, error.status, { error: error.code }, corsHeaders);
      console.error('[server] erro inesperado', error instanceof Error ? error.name : 'unknown');
      return sendJson(res, 500, { error: 'internal_error' }, corsHeaders);
    }
  };
}
