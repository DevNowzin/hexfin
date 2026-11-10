import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS, type AiSettings } from '@/features/ai/config';
import { AiError } from '@/features/ai/types';
import { clearSuggestionCache, suggestCategory, type FetchFn, type SuggestDeps } from './ai';

const consentedAt = '2026-11-09T12:00:00.000Z';
const direct: AiSettings = { ...DEFAULT_AI_SETTINGS, mode: 'direct', apiKey: 'sk-ant-chave-de-teste-123456', consentedAt };
const backend: AiSettings = {
  ...DEFAULT_AI_SETTINGS,
  mode: 'backend',
  backendUrl: 'https://api.exemplo.test/',
  backendToken: 'token-de-teste-com-mais-de-24-chars',
  consentedAt,
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => clearSuggestionCache());

describe('suggestCategory', () => {
  it('sem IA configurada usa só as regras locais', async () => {
    const requestDirect = vi.fn();
    const outcome = await suggestCategory({ description: 'Uber', type: 'expense' }, DEFAULT_AI_SETTINGS, { requestDirect });
    expect(outcome.suggestion).toMatchObject({ categoryId: 'transport', source: 'local' });
    expect(requestDirect).not.toHaveBeenCalled();
  });

  it('sem consentimento não chama a IA', async () => {
    const requestDirect = vi.fn();
    await suggestCategory({ description: 'Uber', type: 'expense' }, { ...direct, consentedAt: undefined }, { requestDirect });
    expect(requestDirect).not.toHaveBeenCalled();
  });

  it('modo direto devolve a sugestão da IA e guarda em cache', async () => {
    const requestDirect = vi.fn<NonNullable<SuggestDeps['requestDirect']>>().mockResolvedValue({ categoryId: 'food', confidence: 0.95, reason: 'Mercado' });
    const first = await suggestCategory({ description: 'Pão de Açúcar', type: 'expense' }, direct, { requestDirect });
    const second = await suggestCategory({ description: 'pao de acucar', type: 'expense' }, direct, { requestDirect });
    expect(first.suggestion).toMatchObject({ categoryId: 'food', source: 'ai', confidence: 0.95 });
    expect(second.suggestion).toEqual(first.suggestion);
    expect(requestDirect).toHaveBeenCalledTimes(1);
  });

  it('falha da IA cai nas regras locais e informa o motivo', async () => {
    const requestDirect = vi.fn().mockRejectedValue(new AiError('rate_limit'));
    const outcome = await suggestCategory({ description: 'Netflix', type: 'expense' }, direct, { requestDirect });
    expect(outcome).toEqual({
      suggestion: expect.objectContaining({ categoryId: 'subscriptions', source: 'local', fallbackReason: 'rate_limit' }),
      error: 'rate_limit',
    });
  });

  it('falha sem regra local devolve só o erro', async () => {
    const requestDirect = vi.fn().mockRejectedValue(new AiError('network'));
    expect(await suggestCategory({ description: 'xyz', type: 'expense' }, direct, { requestDirect })).toEqual({ suggestion: null, error: 'network' });
  });

  it('timeout aborta a chamada lenta', async () => {
    const requestDirect = vi.fn(
      (_settings: AiSettings, _request: unknown, signal: AbortSignal) =>
        new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new AiError('timeout')))),
    );
    const outcome = await suggestCategory({ description: 'Uber', type: 'expense' }, direct, { requestDirect, timeoutMs: 10 });
    expect(outcome.error).toBe('timeout');
    expect(outcome.suggestion?.source).toBe('local');
  });

  it('modo backend envia só descrição, tipo e locale com o token', async () => {
    const fetchImpl = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(200, { categoryId: 'food', confidence: 0.8, reason: 'ok' }));
    const outcome = await suggestCategory({ description: 'Feira', type: 'expense' }, backend, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.exemplo.test/api/ai/categorize');
    expect(JSON.parse(init!.body as string)).toEqual({ description: 'Feira', type: 'expense', locale: 'pt-BR' });
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${backend.backendToken}`);
    expect(outcome.suggestion).toMatchObject({ categoryId: 'food', source: 'ai' });
  });

  it('modo backend rejeita categoria fora da lista e mapeia 401', async () => {
    const invalid = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(200, { categoryId: 'salary', confidence: 0.8, reason: '' }));
    expect((await suggestCategory({ description: 'Feira', type: 'expense' }, backend, { fetchImpl: invalid })).error).toBe('invalid_response');
    const unauthorized = vi.fn<FetchFn>().mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }));
    expect((await suggestCategory({ description: 'Feira livre', type: 'expense' }, backend, { fetchImpl: unauthorized })).error).toBe('auth');
  });

  it('descrição vazia não gera sugestão', async () => {
    expect(await suggestCategory({ description: '  ', type: 'expense' }, direct)).toEqual({ suggestion: null });
  });
});
