// Único ponto do app que fala com a IA (direto com a chave do usuário ou via backend).
// Sempre devolve algo utilizável: se a IA falhar, cai nas regras locais.
import { localCategorize, parseCategorySuggestion, suggestionCacheKey, validateCategorizeRequest } from '@/features/ai/categorize';
import { isAiReady, isInsightsReady, type AiSettings } from '@/features/ai/config';
import { insightsCacheKey, parseInsightsResponse, validateInsightsRequest } from '@/features/ai/insights';
import {
  AiError,
  INSIGHTS_TIMEOUT_MS,
  type AiErrorCode,
  type AiInsight,
  type CategorizableType,
  type CategorizeRequest,
  type CategorySuggestion,
  type InsightsRequest,
  type SuggestionResult,
} from '@/features/ai/types';

/** Só o necessário para chamar o backend; evita conflito entre os tipos de fetch do DOM e do React Native. */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export const CLIENT_TIMEOUT_MS = 15000;
const CACHE_LIMIT = 200;

export interface SuggestionOutcome {
  suggestion: SuggestionResult | null;
  /** Erro da IA quando ela estava ativa e falhou. */
  error?: AiErrorCode;
}

export interface SuggestDeps {
  fetchImpl?: FetchFn;
  requestDirect?: (settings: AiSettings, request: CategorizeRequest, signal: AbortSignal) => Promise<CategorySuggestion>;
  timeoutMs?: number;
  /** Cancela a chamada (ex.: o usuário continuou digitando). */
  signal?: AbortSignal;
}

const cache = new Map<string, SuggestionResult>();

export function clearSuggestionCache(): void {
  cache.clear();
}

function remember(key: string, value: SuggestionResult) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * O SDK é carregado só quando o modo "chave própria" faz a primeira chamada: abrir o app
 * nunca depende dele. requestCategorySuggestion já converte erros do SDK em AiError.
 */
async function defaultRequestDirect(settings: AiSettings, request: CategorizeRequest, signal: AbortSignal) {
  let sdk: typeof import('@/features/ai/anthropic');
  try {
    sdk = await import('@/features/ai/anthropic');
  } catch {
    throw new AiError('server', 'Não foi possível carregar o cliente da IA.');
  }
  const client = sdk.createAnthropicClient({ apiKey: settings.apiKey.trim(), allowBrowser: true, timeoutMs: CLIENT_TIMEOUT_MS });
  return sdk.requestCategorySuggestion(client, settings.model.trim(), request, signal);
}

function toErrorCode(error: unknown): AiErrorCode {
  return error instanceof AiError ? error.code : 'server';
}

const STATUS_ERRORS: Record<number, AiErrorCode> = { 401: 'auth', 403: 'auth', 429: 'rate_limit', 504: 'timeout' };

/** POST no backend do usuário. Devolve o corpo JSON de uma resposta 2xx; erros viram AiError. */
async function postBackend(settings: AiSettings, path: string, payload: unknown, signal: AbortSignal, fetchImpl: FetchFn): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${settings.backendUrl.trim().replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.backendToken.trim()}` },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw new AiError('timeout');
    throw new AiError('network', error instanceof Error ? error.message : undefined);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AiError('invalid_response', 'Resposta do servidor não é JSON.');
  }
  if (!response.ok) {
    const code = (body as { code?: unknown } | null)?.code;
    if (code === 'refused' || code === 'invalid_response' || code === 'timeout' || code === 'rate_limit') throw new AiError(code);
    throw new AiError(STATUS_ERRORS[response.status] ?? 'server');
  }
  return body;
}

async function requestBackend(
  settings: AiSettings,
  request: CategorizeRequest,
  signal: AbortSignal,
  fetchImpl: FetchFn,
): Promise<CategorySuggestion> {
  const body = await postBackend(settings, '/api/ai/categorize', request, signal, fetchImpl);
  const suggestion = parseCategorySuggestion(body, request.type);
  if (!suggestion) throw new AiError('invalid_response', 'Categoria inválida vinda do servidor.');
  return suggestion;
}

export async function suggestCategory(
  input: { description: string; type: CategorizableType },
  settings: AiSettings,
  deps: SuggestDeps = {},
): Promise<SuggestionOutcome> {
  const validation = validateCategorizeRequest(input);
  if (!validation.ok) return { suggestion: null };
  const request = validation.value;
  const local = localCategorize(request.description, request.type);
  const localResult: SuggestionResult | null = local ? { ...local, source: 'local' } : null;
  if (!isAiReady(settings)) return { suggestion: localResult };

  const key = `${settings.mode}:${settings.model}:${suggestionCacheKey(request)}`;
  const cached = cache.get(key);
  if (cached) return { suggestion: cached };

  try {
    const suggestion = await withTimeout(deps.timeoutMs ?? CLIENT_TIMEOUT_MS, deps.signal, (signal) =>
      settings.mode === 'direct'
        ? (deps.requestDirect ?? defaultRequestDirect)(settings, request, signal)
        : requestBackend(settings, request, signal, deps.fetchImpl ?? fetch),
    );
    const result: SuggestionResult = { ...suggestion, source: 'ai' };
    remember(key, result);
    return { suggestion: result };
  } catch (error) {
    const code = toErrorCode(error);
    return { suggestion: localResult ? { ...localResult, fallbackReason: code } : null, error: code };
  }
}

/** Corta a chamada no tempo limite ou quando quem pediu cancelar. */
async function withTimeout<T>(timeoutMs: number, outer: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  outer?.addEventListener('abort', abort);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', abort);
  }
}

// Comentários da IA nos Assistentes: só percentuais saem do aparelho.

export interface InsightsOutcome {
  /** Vazio quando a IA está desligada ou falhou: a tela segue só com os assistentes locais. */
  insights: AiInsight[];
  error?: AiErrorCode;
}

export interface InsightsDeps {
  fetchImpl?: FetchFn;
  requestDirect?: (settings: AiSettings, request: InsightsRequest, signal: AbortSignal) => Promise<AiInsight[]>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const INSIGHTS_CACHE_LIMIT = 50;
const insightsCache = new Map<string, AiInsight[]>();

export function clearInsightsCache(): void {
  insightsCache.clear();
}

async function defaultInsightsDirect(settings: AiSettings, request: InsightsRequest, signal: AbortSignal) {
  let sdk: typeof import('@/features/ai/anthropic');
  try {
    sdk = await import('@/features/ai/anthropic');
  } catch {
    throw new AiError('server', 'Não foi possível carregar o cliente da IA.');
  }
  const client = sdk.createAnthropicClient({ apiKey: settings.apiKey.trim(), allowBrowser: true, timeoutMs: INSIGHTS_TIMEOUT_MS });
  return sdk.requestInsights(client, settings.model.trim(), request, signal);
}

async function requestInsightsBackend(settings: AiSettings, request: InsightsRequest, signal: AbortSignal, fetchImpl: FetchFn) {
  const body = await postBackend(settings, '/api/ai/insights', request, signal, fetchImpl);
  const insights = parseInsightsResponse(body, request);
  if (!insights) throw new AiError('invalid_response', 'Comentários inválidos vindos do servidor.');
  return insights;
}

/** Pede até 3 comentários sobre o mês. Exige o consentimento próprio; nunca lança erro. */
export async function suggestInsights(request: InsightsRequest, settings: AiSettings, deps: InsightsDeps = {}): Promise<InsightsOutcome> {
  if (!isInsightsReady(settings)) return { insights: [], error: 'not_configured' };
  const validation = validateInsightsRequest(request);
  if (!validation.ok) return { insights: [], error: 'server' };

  const key = `${settings.mode}:${settings.model}:${insightsCacheKey(validation.value)}`;
  const cached = insightsCache.get(key);
  if (cached) return { insights: cached };

  try {
    const insights = await withTimeout(deps.timeoutMs ?? INSIGHTS_TIMEOUT_MS, deps.signal, (signal) =>
      settings.mode === 'direct'
        ? (deps.requestDirect ?? defaultInsightsDirect)(settings, validation.value, signal)
        : requestInsightsBackend(settings, validation.value, signal, deps.fetchImpl ?? fetch),
    );
    if (insightsCache.size >= INSIGHTS_CACHE_LIMIT) {
      const oldest = insightsCache.keys().next().value;
      if (oldest !== undefined) insightsCache.delete(oldest);
    }
    insightsCache.set(key, insights);
    return { insights };
  } catch (error) {
    return { insights: [], error: toErrorCode(error) };
  }
}

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  not_configured: 'IA não configurada.',
  auth: 'A chave ou o token foi recusado.',
  rate_limit: 'Limite de uso da IA atingido.',
  timeout: 'A IA demorou demais para responder.',
  network: 'Sem conexão com a IA.',
  refused: 'A IA recusou o pedido.',
  invalid_response: 'A IA respondeu algo inválido.',
  server: 'A IA está indisponível agora.',
};
