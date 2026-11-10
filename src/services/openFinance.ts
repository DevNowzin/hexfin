// Único ponto de acesso ao Pluggy (Open Finance pelo MeuPluggy). Só leitura: busca contas,
// transações e empréstimos; nunca cria, paga ou altera nada no banco.
// O Client Secret fica no SecureStore do aparelho (escolha do usuário em 10/11).
import {
  addDays,
  finalizeCardTransactions,
  normalizeAccount,
  normalizeLoan,
  normalizeTransaction,
  resultsOf,
  validateOpenFinanceSettings,
} from '@/features/openfinance/normalize';
import type { OpenFinanceSettings, OpenFinanceSnapshot, SnapshotAccount, SnapshotLoan } from '@/features/openfinance/types';

export const PLUGGY_API_URL = 'https://api.pluggy.ai';
export const OPEN_FINANCE_TIMEOUT_MS = 20000;
export const SYNC_WINDOW_DAYS = 90;
/** Limite de páginas de transações por conta (500 por página). */
const MAX_TRANSACTION_PAGES = 20;

export type OpenFinanceErrorCode =
  | 'not_configured'
  | 'auth'
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'invalid_response'
  | 'server';

export const OPEN_FINANCE_ERROR_MESSAGES: Record<OpenFinanceErrorCode, string> = {
  not_configured: 'Preencha o Client ID, o Client Secret e os Item IDs e autorize a busca.',
  auth: 'O Pluggy recusou o Client ID ou o Client Secret.',
  not_found: 'Um dos Item IDs não existe nesta aplicação do Pluggy.',
  rate_limited: 'Muitos pedidos ao Pluggy. Espere um minuto e tente de novo.',
  network: 'Sem conexão com o Pluggy.',
  timeout: 'O Pluggy demorou para responder. Tente de novo.',
  cancelled: 'Sincronização cancelada.',
  invalid_response: 'O Pluggy respondeu num formato inesperado.',
  server: 'O Pluggy está indisponível agora. Tente mais tarde.',
};

export class OpenFinanceError extends Error {
  readonly code: OpenFinanceErrorCode;

  constructor(code: OpenFinanceErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'OpenFinanceError';
    this.code = code;
  }
}

export interface OpenFinanceDeps {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  baseUrl?: string;
}

export type SyncOutcome =
  | { ok: true; snapshot: OpenFinanceSnapshot }
  | { ok: false; error: OpenFinanceErrorCode; itemId?: string };

function statusToCode(status: number): OpenFinanceErrorCode {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'invalid_response';
}

async function call(path: string, options: { apiKey?: string; body?: unknown }, deps: OpenFinanceDeps): Promise<unknown> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs ?? OPEN_FINANCE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  deps.signal?.addEventListener('abort', onAbort);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.apiKey) headers['X-API-KEY'] = options.apiKey;
    let response: Response;
    try {
      response = await fetchImpl(`${deps.baseUrl ?? PLUGGY_API_URL}${path}`, {
        method: options.body === undefined ? 'GET' : 'POST',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) throw new OpenFinanceError('timeout');
      if (deps.signal?.aborted) throw new OpenFinanceError('cancelled');
      throw new OpenFinanceError('network');
    }
    if (!response.ok) throw new OpenFinanceError(statusToCode(response.status), `HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new OpenFinanceError('invalid_response', 'JSON inválido');
    }
  } finally {
    clearTimeout(timer);
    deps.signal?.removeEventListener('abort', onAbort);
  }
}

async function authenticate(clientId: string, clientSecret: string, deps: OpenFinanceDeps): Promise<string> {
  const value = await call('/auth', { body: { clientId: clientId.trim(), clientSecret: clientSecret.trim() } }, deps);
  const apiKey = value && typeof value === 'object' ? (value as { apiKey?: unknown }).apiKey : undefined;
  if (typeof apiKey !== 'string' || !apiKey) throw new OpenFinanceError('invalid_response', 'Sem apiKey');
  return apiKey;
}

async function fetchInstitution(apiKey: string, itemId: string, deps: OpenFinanceDeps): Promise<string> {
  const item = await call(`/items/${encodeURIComponent(itemId)}`, { apiKey }, deps);
  const connector = item && typeof item === 'object' ? (item as { connector?: { name?: unknown } }).connector : undefined;
  return typeof connector?.name === 'string' ? connector.name : 'Open Finance';
}

async function fetchList(path: string, apiKey: string, deps: OpenFinanceDeps): Promise<unknown[]> {
  const results = resultsOf(await call(path, { apiKey }, deps));
  if (!results) throw new OpenFinanceError('invalid_response', `Lista inválida em ${path.split('?')[0]}`);
  return results;
}

/** Transações v2, paginadas por cursor: `next` já vem pronto como query string. */
async function fetchTransactions(apiKey: string, accountId: string, dateFrom: string, deps: OpenFinanceDeps): Promise<unknown[]> {
  const all: unknown[] = [];
  let query: string | null = `?accountId=${encodeURIComponent(accountId)}&dateFrom=${dateFrom}`;
  for (let page = 0; query && page < MAX_TRANSACTION_PAGES; page += 1) {
    const value = await call(`/v2/transactions${query}`, { apiKey }, deps);
    const results = resultsOf(value);
    if (!results) throw new OpenFinanceError('invalid_response', 'Lista de transações inválida');
    all.push(...results);
    const next = (value as { next?: unknown }).next;
    query = typeof next === 'string' && next.startsWith('?') ? next : null;
  }
  return all;
}

async function syncItem(apiKey: string, itemId: string, windowStart: string, deps: OpenFinanceDeps, warnings: string[]) {
  const institution = await fetchInstitution(apiKey, itemId, deps);
  const accounts: SnapshotAccount[] = [];
  let skipped = 0;
  for (const raw of await fetchList(`/accounts?itemId=${encodeURIComponent(itemId)}`, apiKey, deps)) {
    const account = normalizeAccount(raw, itemId, institution);
    if (!account) {
      skipped += 1;
      continue;
    }
    const rawTransactions = await fetchTransactions(apiKey, account.externalId.replace('pluggy:', ''), windowStart, deps);
    const transactions = rawTransactions.map((item) => normalizeTransaction(item, account.kind));
    skipped += transactions.filter((item) => item === null).length;
    const valid = transactions.filter((item) => item !== null);
    accounts.push({ ...account, transactions: account.kind === 'credit' ? finalizeCardTransactions(valid, account.billCycle) : valid });
  }

  // Empréstimos nem sempre vêm pelo MeuPluggy: se a API recusar, segue sem eles.
  let loans: SnapshotLoan[] = [];
  try {
    const rawLoans = await fetchList(`/loans?itemId=${encodeURIComponent(itemId)}`, apiKey, deps);
    loans = rawLoans.map((raw) => normalizeLoan(raw, itemId, institution)).filter((loan) => loan !== null);
  } catch (error) {
    const code = error instanceof OpenFinanceError ? error.code : 'server';
    if (code === 'cancelled') throw error;
    warnings.push(`Empréstimos de ${institution} não vieram por esta conexão.`);
  }
  if (skipped > 0) {
    const what = skipped === 1 ? 'registro' : 'registros';
    const verb = skipped === 1 ? 'ficou' : 'ficaram';
    warnings.push(`${skipped} ${what} de ${institution} ${verb} de fora por formato inesperado.`);
  }
  return { accounts, loans };
}

/** Busca tudo de todos os Items. Nunca lança: falhas viram `{ ok: false }`. `today` em `YYYY-MM-DD`. */
export async function syncOpenFinance(
  settings: Pick<OpenFinanceSettings, 'clientId' | 'clientSecret' | 'itemIds' | 'consentedAt'>,
  today: string,
  deps: OpenFinanceDeps = {},
): Promise<SyncOutcome> {
  if (!settings.consentedAt || validateOpenFinanceSettings(settings)) return { ok: false, error: 'not_configured' };
  const windowStart = addDays(today, -SYNC_WINDOW_DAYS);
  const snapshot: OpenFinanceSnapshot = { windowStart, today, accounts: [], loans: [], warnings: [] };
  let currentItem: string | undefined;
  try {
    const apiKey = await authenticate(settings.clientId, settings.clientSecret, deps);
    for (const itemId of settings.itemIds) {
      currentItem = itemId;
      const result = await syncItem(apiKey, itemId, windowStart, deps, snapshot.warnings);
      snapshot.accounts.push(...result.accounts);
      snapshot.loans.push(...result.loans);
    }
    return { ok: true, snapshot };
  } catch (error) {
    const code = error instanceof OpenFinanceError ? error.code : 'server';
    return code === 'not_found' && currentItem ? { ok: false, error: code, itemId: currentItem } : { ok: false, error: code };
  }
}
