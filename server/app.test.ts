import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiError, type CategorySuggestion } from '../src/features/ai/types.ts';
import { createRequestHandler, MAX_BODY_BYTES, type CategorizeFn, type InsightsFn } from './app.ts';
import { loadConfig } from './config.ts';

const TOKEN = 'token-de-teste-com-mais-de-24-chars';
const suggestion: CategorySuggestion = { categoryId: 'food', confidence: 0.9, reason: 'Supermercado' };
let server: Server | undefined;

async function start(
  categorize: CategorizeFn,
  overrides: Partial<{ rateLimitPerMinute: number; allowedOrigin: string }> = {},
  insights: InsightsFn = vi.fn<InsightsFn>(),
) {
  const handler = createRequestHandler({
    config: { appToken: TOKEN, rateLimitPerMinute: 30, aiTimeoutMs: 1000, ...overrides },
    categorize,
    insights,
  });
  server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function post(base: string, body: unknown, token = TOKEN) {
  return fetch(`${base}/api/ai/categorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('POST /api/ai/categorize', () => {
  it('retorna a sugestão validada', async () => {
    const categorize = vi.fn<CategorizeFn>().mockResolvedValue(suggestion);
    const base = await start(categorize);
    const response = await post(base, { description: ' Mercado Pão de Açúcar ', type: 'expense', locale: 'pt-BR' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(suggestion);
    expect(categorize.mock.calls[0]![0]).toEqual({ description: 'Mercado Pão de Açúcar', type: 'expense', locale: 'pt-BR' });
  });

  it('exige o token do app', async () => {
    const categorize = vi.fn<CategorizeFn>();
    const base = await start(categorize);
    expect((await post(base, { description: 'x', type: 'expense' }, 'errado')).status).toBe(401);
    expect(categorize).not.toHaveBeenCalled();
  });

  it('rejeita entrada inválida, JSON quebrado e corpo grande', async () => {
    const base = await start(vi.fn<CategorizeFn>());
    expect((await post(base, { description: '', type: 'expense' })).status).toBe(400);
    expect((await post(base, { description: 'ok', type: 'transfer' })).status).toBe(400);
    expect((await post(base, '{quebrado')).status).toBe(400);
    expect((await post(base, { description: 'a'.repeat(MAX_BODY_BYTES), type: 'expense' })).status).toBe(413);
  });

  it('usa cache por descrição normalizada', async () => {
    const categorize = vi.fn<CategorizeFn>().mockResolvedValue(suggestion);
    const base = await start(categorize);
    await post(base, { description: 'Padaria São João', type: 'expense' });
    await post(base, { description: 'padaria sao joao', type: 'expense' });
    expect(categorize).toHaveBeenCalledTimes(1);
  });

  it('aplica limite por minuto', async () => {
    const base = await start(vi.fn<CategorizeFn>().mockResolvedValue(suggestion), { rateLimitPerMinute: 2 });
    await post(base, { description: 'a', type: 'expense' });
    await post(base, { description: 'b', type: 'expense' });
    expect((await post(base, { description: 'c', type: 'expense' })).status).toBe(429);
  });

  it('devolve código estável quando a IA falha, sem vazar detalhes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const base = await start(vi.fn<CategorizeFn>().mockRejectedValue(new AiError('invalid_response', 'segredo')));
    const response = await post(base, { description: 'Mercado', type: 'expense' });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'ai_unavailable', code: 'invalid_response' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Mercado');
    warn.mockRestore();
  });

  it('libera CORS só para a origem configurada', async () => {
    const base = await start(vi.fn<CategorizeFn>(), { allowedOrigin: 'http://127.0.0.1:4173' });
    const ok = await fetch(`${base}/health`, { headers: { Origin: 'http://127.0.0.1:4173' } });
    const other = await fetch(`${base}/health`, { headers: { Origin: 'http://evil.test' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:4173');
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('loadConfig', () => {
  const base = { HEXFIN_APP_TOKEN: TOKEN, AI_API_KEY: 'sk-test' };

  it('aplica padrões', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({ port: 8787, host: '127.0.0.1', aiModel: 'claude-opus-5-5', aiTimeoutMs: 15000 });
  });

  it('falha sem chave, com token curto ou número inválido', () => {
    expect(() => loadConfig({ HEXFIN_APP_TOKEN: TOKEN })).toThrow(/AI_API_KEY/);
    expect(() => loadConfig({ ...base, HEXFIN_APP_TOKEN: 'curto' })).toThrow(/24/);
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});

describe('POST /api/ai/insights', () => {
  const body = { month: '2026-11', savingsRatePercent: 23, expenseChangePercent: -12, categories: [{ id: 'food', sharePercent: 40 }], locale: 'pt-BR' };
  const send = (base: string, payload: unknown, token = TOKEN) =>
    fetch(`${base}/api/ai/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });

  it('devolve os comentários e usa cache', async () => {
    const insights = vi.fn<InsightsFn>().mockResolvedValue([{ title: 'Boa margem', message: 'Sobrou 23% da renda.', tone: 'positive' }]);
    const base = await start(vi.fn<CategorizeFn>(), {}, insights);
    const first = await send(base, body);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ insights: [{ title: 'Boa margem', message: 'Sobrou 23% da renda.', tone: 'positive' }] });
    await send(base, body);
    expect(insights).toHaveBeenCalledTimes(1);
  });

  it('exige o token e recusa valores em reais no corpo', async () => {
    const insights = vi.fn<InsightsFn>();
    const base = await start(vi.fn<CategorizeFn>(), {}, insights);
    expect((await send(base, body, 'errado')).status).toBe(401);
    const withCents = await send(base, { ...body, incomeCents: 500000 });
    expect(withCents.status).toBe(400);
    expect(insights).not.toHaveBeenCalled();
  });

  it('falha da IA vira erro conhecido', async () => {
    const insights = vi.fn<InsightsFn>().mockRejectedValue(new AiError('refused'));
    const base = await start(vi.fn<CategorizeFn>(), {}, insights);
    const response = await send(base, body);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'ai_unavailable', code: 'refused' });
  });
});
