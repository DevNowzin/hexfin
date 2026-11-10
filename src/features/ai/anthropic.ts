// Chamada ao modelo via SDK oficial da Anthropic. Compartilhado entre o modo
// "chave própria" do app e o backend, para que os dois validem igual.
import Anthropic from '@anthropic-ai/sdk';
import {
  buildCategorizeSystemPrompt,
  buildCategorizeUserMessage,
  categorySuggestionSchema,
  parseCategorySuggestion,
} from './categorize.ts';
import { buildInsightsSystemPrompt, buildInsightsUserMessage, insightsResponseSchema, parseInsightsResponse } from './insights.ts';
import {
  AiError,
  DEFAULT_AI_TIMEOUT_MS,
  type AiInsight,
  type CategorizeRequest,
  type CategorySuggestion,
  type InsightsRequest,
} from './types.ts';

export { DEFAULT_AI_MODEL, DEFAULT_AI_TIMEOUT_MS } from './types.ts';

/** Modelos que aceitam `fallbacks: "default"` (server-side fallback em recusas). */
const MODELS_WITH_DEFAULT_FALLBACK = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

export interface AnthropicClientOptions {
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
  /** O app precisa disso no Web: a chave é do próprio usuário, digitada no aparelho. */
  allowBrowser?: boolean;
}

export function createAnthropicClient(options: AnthropicClientOptions): Anthropic {
  return new Anthropic({
    apiKey: options.apiKey,
    baseURL: options.baseURL || undefined,
    timeout: options.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
    maxRetries: 1,
    dangerouslyAllowBrowser: options.allowBrowser ?? false,
  });
}

/** Converte erros do SDK em códigos estáveis que a UI e o backend entendem. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError('auth', 'Chave de API recusada.');
  }
  if (error instanceof Anthropic.RateLimitError) return new AiError('rate_limit', 'Limite de uso atingido.');
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AiError('timeout', 'A IA demorou demais.');
  if (error instanceof Anthropic.APIUserAbortError) return new AiError('timeout', 'Requisição cancelada.');
  if (error instanceof Anthropic.APIConnectionError) return new AiError('network', 'Sem conexão com a IA.');
  if (error instanceof Anthropic.APIError) return new AiError('server', `Erro da API (${error.status ?? '?'}).`);
  return new AiError('server', 'Erro inesperado ao chamar a IA.');
}

function extractJsonText(content: ReadonlyArray<{ type: string }>): string {
  for (const block of content) {
    if (block.type === 'text') return (block as { type: 'text'; text: string }).text;
  }
  throw new AiError('invalid_response', 'Resposta sem texto.');
}

interface StructuredCall {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

/** Uma chamada com saída estruturada; devolve o JSON ainda sem validar o conteúdo. */
async function requestStructuredJson(client: Anthropic, model: string, call: StructuredCall, signal?: AbortSignal): Promise<unknown> {
  const useFallback = MODELS_WITH_DEFAULT_FALLBACK.has(model);
  let response;
  try {
    response = await client.beta.messages.create(
      {
        model,
        max_tokens: call.maxTokens,
        ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        output_config: { effort: 'low', format: { type: 'json_schema', schema: call.schema } },
        system: call.system,
        messages: [{ role: 'user', content: call.user }],
      },
      { signal },
    );
  } catch (error) {
    throw toAiError(error);
  }

  if (response.stop_reason === 'refusal') throw new AiError('refused', 'O modelo recusou o pedido.');
  if (response.stop_reason === 'max_tokens') throw new AiError('invalid_response', 'Resposta cortada.');

  try {
    return JSON.parse(extractJsonText(response.content));
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('invalid_response', 'JSON inválido.');
  }
}

export async function requestCategorySuggestion(
  client: Anthropic,
  model: string,
  request: CategorizeRequest,
  signal?: AbortSignal,
): Promise<CategorySuggestion> {
  const parsed = await requestStructuredJson(
    client,
    model,
    {
      system: buildCategorizeSystemPrompt(request.type),
      user: buildCategorizeUserMessage(request),
      schema: categorySuggestionSchema(request.type),
      maxTokens: 2048,
    },
    signal,
  );
  const suggestion = parseCategorySuggestion(parsed, request.type);
  if (!suggestion) throw new AiError('invalid_response', 'Categoria fora da lista permitida.');
  return suggestion;
}

/** Comentários sobre o mês a partir só de percentuais; a resposta passa pela checagem de números. */
export async function requestInsights(
  client: Anthropic,
  model: string,
  request: InsightsRequest,
  signal?: AbortSignal,
): Promise<AiInsight[]> {
  const parsed = await requestStructuredJson(
    client,
    model,
    {
      system: buildInsightsSystemPrompt(),
      user: buildInsightsUserMessage(request),
      schema: insightsResponseSchema,
      maxTokens: 8000,
    },
    signal,
  );
  const insights = parseInsightsResponse(parsed, request);
  if (!insights) throw new AiError('invalid_response', 'Nenhum comentário válido.');
  return insights;
}
