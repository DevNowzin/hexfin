import { describe, expect, it, vi } from 'vitest';
import { syncOpenFinance } from './openFinance';

const CLIENT_ID = '11111111-2222-3333-4444-555555555555';
const ITEM = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const settings = { clientId: CLIENT_ID, clientSecret: 'segredo-de-teste', itemIds: [ITEM], consentedAt: '2026-11-10T10:00:00.000Z' };

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Pluggy de mentira: responde pelas rotas e registra as chamadas. */
function fakePluggy(overrides: Record<string, Route> = {}) {
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const routes: Record<string, Route> = {
    '/auth': () => json({ apiKey: 'chave-temporaria' }),
    [`/items/${ITEM}`]: () => json({ id: ITEM, connector: { name: 'MeuPluggy' } }),
    '/accounts': () => json({ page: 1, total: 1, totalPages: 1, results: [{ id: 'acc1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta', balance: 100.5, currencyCode: 'BRL' }] }),
    '/v2/transactions': (url) =>
      url.searchParams.get('after')
        ? json({ results: [{ id: 'tx2', description: 'Salário', amount: 50, type: 'CREDIT', date: '2026-11-02T12:00:00.000Z', status: 'POSTED' }], next: null })
        : json({ results: [{ id: 'tx1', description: 'Mercado', amount: -10.25, type: 'DEBIT', date: '2026-11-01T12:00:00.000Z', status: 'POSTED' }], next: '?accountId=acc1&after=cursor-2' }),
    '/loans': () => json({ results: [] }),
    ...overrides,
  };
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ path: `${url.pathname}${url.search}`, init });
    const route = routes[url.pathname];
    return route ? route(url, init) : json({ message: 'não existe' }, 404);
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('syncOpenFinance', () => {
  it('autentica, busca contas e todas as páginas de transações desde 90 dias atrás', async () => {
    const pluggy = fakePluggy();
    const outcome = await syncOpenFinance(settings, '2026-11-10', { fetchImpl: pluggy.fetchImpl });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const auth = pluggy.calls[0]!;
    expect(auth.path).toBe('/auth');
    expect(JSON.parse(String(auth.init.body))).toEqual({ clientId: CLIENT_ID, clientSecret: 'segredo-de-teste' });
    expect((pluggy.calls[1]!.init.headers as Record<string, string>)['X-API-KEY']).toBe('chave-temporaria');
    expect(pluggy.calls.map((call) => call.path)).toContain('/v2/transactions?accountId=acc1&dateFrom=2026-08-12');
    expect(pluggy.calls.map((call) => call.path)).toContain('/v2/transactions?accountId=acc1&after=cursor-2');

    expect(outcome.snapshot.windowStart).toBe('2026-08-12');
    const [account] = outcome.snapshot.accounts;
    expect(account).toMatchObject({ externalId: 'pluggy:acc1', kind: 'checking', institution: 'MeuPluggy', bankBalanceCents: 10050 });
    expect(account!.transactions.map((item) => [item.externalId, item.direction, item.amountCents])).toEqual([
      ['pluggy:tx1', 'out', 1025],
      ['pluggy:tx2', 'in', 5000],
    ]);
    expect(outcome.snapshot.warnings).toEqual([]);
  });

  it('cartão: parcela no mês dela e mês da fatura pelo ciclo informado', async () => {
    const pluggy = fakePluggy({
      '/accounts': () => json({ results: [{ id: 'card', type: 'CREDIT', name: 'Cartão', balance: 300, creditData: { balanceCloseDate: '2026-12-03', balanceDueDate: '2026-12-10' } }] }),
      '/v2/transactions': () => json({ results: [
        { id: 'p1', description: 'Loja', amount: 100, date: '2026-11-08T12:00:00.000Z', status: 'PENDING', creditCardMetadata: { installmentNumber: 1, totalInstallments: 2 } },
        { id: 'p2', description: 'Loja', amount: 100, date: '2026-11-08T12:00:00.000Z', status: 'PENDING', creditCardMetadata: { installmentNumber: 2, totalInstallments: 2 } },
      ], next: null }),
    });
    const outcome = await syncOpenFinance(settings, '2026-11-10', { fetchImpl: pluggy.fetchImpl });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot.today).toBe('2026-11-10');
    expect(outcome.snapshot.accounts[0]!.transactions.map((item) => [item.description, item.date, item.billMonth])).toEqual([
      ['Loja (1/2)', '2026-11-08', '2026-12'],
      ['Loja (2/2)', '2026-12-08', '2027-01'],
    ]);
  });

  it('sem consentimento ou com configuração inválida, não chama a rede', async () => {
    const pluggy = fakePluggy();
    expect(await syncOpenFinance({ ...settings, consentedAt: undefined }, '2026-11-10', { fetchImpl: pluggy.fetchImpl })).toEqual({ ok: false, error: 'not_configured' });
    expect(await syncOpenFinance({ ...settings, itemIds: [] }, '2026-11-10', { fetchImpl: pluggy.fetchImpl })).toEqual({ ok: false, error: 'not_configured' });
    expect(pluggy.calls).toHaveLength(0);
  });

  it('credencial recusada vira erro conhecido', async () => {
    const pluggy = fakePluggy({ '/auth': () => json({ message: 'unauthorized' }, 401) });
    expect(await syncOpenFinance(settings, '2026-11-10', { fetchImpl: pluggy.fetchImpl })).toEqual({ ok: false, error: 'auth' });
  });

  it('Item ID inexistente aponta qual foi', async () => {
    const pluggy = fakePluggy({ [`/items/${ITEM}`]: () => json({ message: 'not found' }, 404) });
    expect(await syncOpenFinance(settings, '2026-11-10', { fetchImpl: pluggy.fetchImpl })).toEqual({ ok: false, error: 'not_found', itemId: ITEM });
  });

  it('empréstimos indisponíveis viram aviso, não erro', async () => {
    const pluggy = fakePluggy({ '/loans': () => json({ message: 'forbidden' }, 403) });
    const outcome = await syncOpenFinance(settings, '2026-11-10', { fetchImpl: pluggy.fetchImpl });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.snapshot.warnings).toEqual(['Empréstimos de MeuPluggy não vieram por esta conexão.']);
  });

  it('formato inesperado, limite de pedidos, servidor fora e falta de rede', async () => {
    const run = (overrides: Record<string, Route>) => syncOpenFinance(settings, '2026-11-10', { fetchImpl: fakePluggy(overrides).fetchImpl });
    expect(await run({ '/accounts': () => json({ contas: [] }) })).toEqual({ ok: false, error: 'invalid_response' });
    expect(await run({ '/auth': () => json({}) })).toEqual({ ok: false, error: 'invalid_response' });
    expect(await run({ '/accounts': () => json({}, 429) })).toEqual({ ok: false, error: 'rate_limited' });
    expect(await run({ '/accounts': () => json({}, 503) })).toEqual({ ok: false, error: 'server' });
    expect(await run({ '/auth': () => Promise.reject(new TypeError('Network request failed')) })).toEqual({ ok: false, error: 'network' });
  });

  it('demora demais vira timeout', async () => {
    const pluggy = fakePluggy({
      '/auth': (_url, init) =>
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    });
    expect(await syncOpenFinance(settings, '2026-11-10', { fetchImpl: pluggy.fetchImpl, timeoutMs: 20 })).toEqual({ ok: false, error: 'timeout' });
  });

  it('registro com formato estranho fica de fora com aviso', async () => {
    const pluggy = fakePluggy({
      '/v2/transactions': () => json({ results: [{ id: 'ok', description: 'X', amount: -1, type: 'DEBIT', date: '2026-11-01T12:00:00.000Z' }, { id: 'ruim', amount: 'abc' }], next: null }),
    });
    const outcome = await syncOpenFinance(settings, '2026-11-10', { fetchImpl: pluggy.fetchImpl });
    expect(outcome.ok && outcome.snapshot.accounts[0]!.transactions).toHaveLength(1);
    expect(outcome.ok && outcome.snapshot.warnings).toEqual(['1 registro de MeuPluggy ficou de fora por formato inesperado.']);
  });
});
