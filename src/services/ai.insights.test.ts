import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS, isInsightsReady, type AiSettings } from '@/features/ai/config';
import { AiError, type AiInsight, type InsightsRequest } from '@/features/ai/types';
import { clearInsightsCache, suggestInsights, type FetchFn, type InsightsDeps } from './ai';

const consentedAt = '2026-11-09T12:00:00.000Z';
const direct: AiSettings = {
  ...DEFAULT_AI_SETTINGS,
  mode: 'direct',
  apiKey: 'sk-ant-chave-de-teste-123456',
  consentedAt,
  insightsConsentedAt: consentedAt,
};
const backend: AiSettings = {
  ...DEFAULT_AI_SETTINGS,
  mode: 'backend',
  backendUrl: 'https://api.exemplo.test/',
  backendToken: 'token-de-teste-com-mais-de-24-chars',
  consentedAt,
  insightsConsentedAt: consentedAt,
};
const request: InsightsRequest = {
  month: '2026-11',
  savingsRatePercent: 23,
  expenseChangePercent: -12,
  categories: [{ id: 'food', sharePercent: 40 }],
  locale: 'pt-BR',
};
const insight: AiInsight = { title: 'Boa margem', message: 'Sobrou 23% da renda neste mês.', tone: 'positive' };

type RequestDirect = NonNullable<InsightsDeps['requestDirect']>;

beforeEach(() => clearInsightsCache());

describe('consentimento dos comentários', () => {
  it('exige a IA pronta e o consentimento próprio, separado do da categorização', () => {
    expect(isInsightsReady(direct)).toBe(true);
    expect(isInsightsReady({ ...direct, insightsConsentedAt: undefined })).toBe(false);
    expect(isInsightsReady({ ...direct, consentedAt: undefined })).toBe(false);
    expect(isInsightsReady({ ...DEFAULT_AI_SETTINGS, insightsConsentedAt: consentedAt })).toBe(false);
  });
});

describe('suggestInsights', () => {
  it('sem o consentimento próprio não chama a IA', async () => {
    const requestDirect = vi.fn<RequestDirect>();
    const outcome = await suggestInsights(request, { ...direct, insightsConsentedAt: undefined }, { requestDirect });
    expect(outcome).toEqual({ insights: [], error: 'not_configured' });
    expect(requestDirect).not.toHaveBeenCalled();
  });

  it('modo direto devolve os comentários e guarda em cache', async () => {
    const requestDirect = vi.fn<RequestDirect>().mockResolvedValue([insight]);
    expect(await suggestInsights(request, direct, { requestDirect })).toEqual({ insights: [insight] });
    expect(await suggestInsights(request, direct, { requestDirect })).toEqual({ insights: [insight] });
    expect(requestDirect).toHaveBeenCalledTimes(1);
  });

  it('pedido fora do contrato não sai do aparelho', async () => {
    const requestDirect = vi.fn<RequestDirect>();
    const tampered = { ...request, incomeCents: 500000 } as unknown as InsightsRequest;
    expect((await suggestInsights(tampered, direct, { requestDirect })).insights).toEqual([]);
    expect(requestDirect).not.toHaveBeenCalled();
  });

  it('falha da IA devolve lista vazia com o motivo, sem lançar erro', async () => {
    const requestDirect = vi.fn<RequestDirect>().mockRejectedValue(new AiError('rate_limit'));
    expect(await suggestInsights(request, direct, { requestDirect })).toEqual({ insights: [], error: 'rate_limit' });
  });

  it('timeout aborta a chamada lenta', async () => {
    const requestDirect = vi.fn<RequestDirect>(
      (_settings, _request, signal) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new AiError('timeout')))),
    );
    expect(await suggestInsights(request, direct, { requestDirect, timeoutMs: 20 })).toEqual({ insights: [], error: 'timeout' });
  });

  it('modo backend envia só os percentuais, com o token, e valida a resposta de novo', async () => {
    const fetchImpl = vi.fn<FetchFn>().mockResolvedValue(
      new Response(JSON.stringify({ insights: [insight, { ...insight, message: 'Você gastou R$ 900.' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const outcome = await suggestInsights(request, backend, { fetchImpl });
    expect(outcome).toEqual({ insights: [insight] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.exemplo.test/api/ai/insights');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${backend.backendToken}`);
    expect(JSON.parse(String(init.body))).toEqual(request);
  });
});
