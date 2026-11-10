// Gastos recorrentes e próximos lançamentos (funções puras, testadas).
// Autocontido (não importa `selectors.ts`) para os seletores poderem usá-lo sem ciclo.
import { normalizeDescription } from '@/features/ai/categorize';
import { parseLocalDate, toDateInput } from '@/utils/format';
import { nextBillOccurrence } from './bills';
import type { PlannedBill, Recurrence, Transaction } from './types';

/** Variação aceita entre cobranças da mesma série (±15%). */
export const AMOUNT_TOLERANCE = 0.15;
/** Uma série detectada sozinha some se ficar mais que isso sem cobrança. */
const DETECTED_ACTIVE_DAYS = 45;
/** Mais que isso por mês é gasto do dia a dia (padaria, café), não conta fixa. */
const MAX_PER_MONTH = 2;
const DAY_MS = 86_400_000;
const INSTALLMENT_MARK = /\b\d{1,2}\s*\/\s*\d{1,2}\b/;

export interface RecurringExpense {
  key: string;
  description: string;
  categoryId: string;
  /** Sem conta só em contas previstas cadastradas sem conta. */
  accountId?: string;
  cadence: Recurrence;
  /** Valor típico de cada cobrança (mediana), em centavos. */
  typicalCents: number;
  /** Quanto pesa por mês, em centavos. */
  monthlyCents: number;
  lastDate: string;
  nextDate: string;
  occurrences: number;
  /** `manual`: você marcou a recorrência; `detected`: o app achou a repetição; `planned`: você cadastrou. */
  source: 'manual' | 'detected' | 'planned';
  /** Última cobrança (séries de transações). */
  lastTransactionId?: string;
  /** Conta prevista cadastrada (`source: 'planned'`). */
  billId?: string;
  /** Empréstimo: parcelas que faltam, contando a próxima. */
  remaining?: number;
}

export interface RecurringSummary {
  items: RecurringExpense[];
  monthlyTotalCents: number;
}

function days(date: string): number {
  return Math.round(parseLocalDate(date).getTime() / DAY_MS);
}

/** Soma meses mantendo o dia; dia 31 em mês curto vira o último dia do mês. */
export function addMonths(date: string, months: number): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(day, lastDay));
  return toDateInput(target);
}

function nextDateFor(date: string, cadence: Recurrence): string {
  if (cadence === 'weekly') return toDateInput(new Date(parseLocalDate(date).getTime() + 7 * DAY_MS));
  return addMonths(date, cadence === 'yearly' ? 12 : 1);
}

function monthlyEquivalent(cents: number, cadence: Recurrence): number {
  if (cadence === 'weekly') return Math.round((cents * 52) / 12);
  if (cadence === 'yearly') return Math.round(cents / 12);
  return cents;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

/** Chave da série: descrição sem acento, caixa, números e pontuação ("NETFLIX.COM 8213" = "Netflix com"). */
export function seriesKey(description: string): string {
  return normalizeDescription(description).replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isCandidate(transaction: Transaction, today: string): boolean {
  return (
    transaction.type === 'expense' &&
    transaction.status === 'completed' &&
    transaction.date <= today &&
    !transaction.billPayment &&
    !transaction.transferAccountId
  );
}

function latest(items: Transaction[]): Transaction {
  return items.reduce((best, item) => (item.date > best.date || (item.date === best.date && item.createdAt > best.createdAt) ? item : best));
}

function monthIndex(date: string): number {
  const [year = 1970, month = 1] = date.split('-').map(Number);
  return year * 12 + month - 1;
}

function build(key: string, items: Transaction[], cadence: Recurrence, typicalCents: number, source: RecurringExpense['source']): RecurringExpense {
  const last = latest(items);
  return {
    key,
    description: last.description.trim(),
    categoryId: last.categoryId,
    accountId: last.accountId,
    cadence,
    typicalCents,
    monthlyCents: monthlyEquivalent(typicalCents, cadence),
    lastDate: last.date,
    nextDate: nextDateFor(last.date, cadence),
    occurrences: items.length,
    source,
    lastTransactionId: last.id,
  };
}

/** Série detectada: valor parecido em pelo menos 2 meses seguidos, no máximo 2 por mês e ainda ativa. */
function detectSeries(key: string, items: Transaction[], today: string): RecurringExpense | null {
  const reference = median(items.map((item) => item.amountCents));
  const similar = items.filter((item) => Math.abs(item.amountCents - reference) <= reference * AMOUNT_TOLERANCE);
  const perMonth = new Map<number, number>();
  for (const item of similar) perMonth.set(monthIndex(item.date), (perMonth.get(monthIndex(item.date)) ?? 0) + 1);
  const months = [...perMonth.keys()].sort((a, b) => a - b);
  const consecutive = months.some((month, index) => index > 0 && month - months[index - 1]! === 1);
  if (months.length < 2 || !consecutive || [...perMonth.values()].some((count) => count > MAX_PER_MONTH)) return null;
  const expense = build(key, similar, 'monthly', median(similar.map((item) => item.amountCents)), 'detected');
  return days(today) - days(expense.lastDate) <= DETECTED_ACTIVE_DAYS ? expense : null;
}

function fromBill(bill: PlannedBill, today: string): RecurringExpense | null {
  const next = nextBillOccurrence(bill, today);
  if (!next) return null;
  return {
    key: `planned:${bill.id}`,
    description: bill.description.trim(),
    categoryId: bill.categoryId,
    accountId: bill.accountId,
    cadence: 'monthly',
    typicalCents: bill.amountCents,
    monthlyCents: bill.amountCents,
    lastDate: next.date,
    nextDate: next.date,
    occurrences: 0,
    source: 'planned',
    billId: bill.id,
    ...(next.remaining ? { remaining: next.remaining } : {}),
  };
}

/**
 * Gastos recorrentes: os que você cadastrou (contas fixas e empréstimos), os que você marcou (semanal, mensal ou anual; vale o último valor) e os que se
 * repetem sozinhos. Parcelas, pagamentos de fatura, aportes e lançamentos futuros ficam de fora.
 */
export function detectRecurring(transactions: Transaction[], today = toDateInput(), bills: PlannedBill[] = []): RecurringSummary {
  const manual = new Map<string, Transaction[]>();
  const automatic = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!isCandidate(transaction, today)) continue;
    const key = seriesKey(transaction.description);
    if (!key) continue;
    if (transaction.recurrence) {
      const manualKey = `${key}|${transaction.accountId}`;
      manual.set(manualKey, [...(manual.get(manualKey) ?? []), transaction]);
    } else if (!INSTALLMENT_MARK.test(transaction.description) && key.length >= 3) {
      automatic.set(key, [...(automatic.get(key) ?? []), transaction]);
    }
  }

  const items: RecurringExpense[] = [];
  // O cadastro vence: a mesma despesa marcada ou detectada não conta de novo.
  const plannedKeys = new Set<string>();
  for (const bill of bills) {
    const planned = fromBill(bill, today);
    if (!planned) continue;
    items.push(planned);
    plannedKeys.add(seriesKey(bill.description));
  }
  const manualKeys = new Set<string>();
  for (const [key, series] of manual) {
    if (plannedKeys.has(key.split('|')[0]!)) continue;
    const last = latest(series);
    items.push(build(key, series, last.recurrence!, last.amountCents, 'manual'));
    manualKeys.add(key.split('|')[0]!);
  }
  for (const [key, series] of automatic) {
    if (manualKeys.has(key) || plannedKeys.has(key)) continue;
    const found = detectSeries(key, series, today);
    if (found) items.push(found);
  }

  items.sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.description.localeCompare(b.description));
  return { items, monthlyTotalCents: items.reduce((total, item) => total + item.monthlyCents, 0) };
}

/** Lançamentos com data depois de hoje (agendados, parcelas futuras), do mais próximo ao mais distante. */
export function getUpcoming(transactions: Transaction[], today = toDateInput()): Transaction[] {
  return transactions
    .filter((transaction) => transaction.date > today && !transaction.billPayment)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
