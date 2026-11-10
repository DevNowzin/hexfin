// Converte as respostas da API do Pluggy em dados validados (funções puras).
// Valores do Pluggy vêm em reais com casas decimais; aqui viram centavos inteiros.
import { normalizeDescription } from '@/features/ai/categorize';
import { addMonths } from '@/features/finance/recurring';
import { parseLocalDate, toDateInput } from '@/utils/format';
import type { BillCycle, ImportedAccountKind, OpenFinanceSettings, SnapshotAccount, SnapshotLoan, SnapshotTransaction } from './types';

const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
const MAX_NAME_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 120;
const MAX_ABS_CENTS = 100_000_000_000; // R$ 1 bilhão: acima disso a resposta é tratada como inválida.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isUuid(value: string): boolean {
  return UUID.test(value.trim());
}

/** Reais com casas decimais → centavos inteiros. Null para valor ausente, infinito ou absurdo. */
export function toCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return Math.abs(cents) > MAX_ABS_CENTS ? null : cents;
}

/** Data ISO em UTC do Pluggy → `YYYY-MM-DD` no horário de Brasília (UTC−3, sem horário de verão). */
export function pluggyDateToLocal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms - BRASILIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Soma dias a uma data `YYYY-MM-DD` no fuso local. */
export function addDays(date: string, days: number): string {
  const value = parseLocalDate(date);
  value.setDate(value.getDate() + days);
  return toDateInput(value);
}

/** Item IDs colados um por linha, por vírgula ou espaço; sem repetição. */
export function parseItemIds(input: string): string[] {
  return [...new Set(input.split(/[\s,;]+/).map((id) => id.trim()).filter(Boolean))];
}

export function validateOpenFinanceSettings(settings: Pick<OpenFinanceSettings, 'clientId' | 'clientSecret' | 'itemIds'>): string | null {
  if (!isUuid(settings.clientId)) return 'Client ID inválido. Copie o valor do painel do Pluggy.';
  if (settings.clientSecret.trim().length < 8) return 'Informe o Client Secret.';
  if (settings.itemIds.length === 0) return 'Informe pelo menos um Item ID.';
  const invalid = settings.itemIds.find((id) => !isUuid(id));
  if (invalid) return `Item ID inválido: ${invalid.slice(0, 12)}…`;
  return null;
}

function isBrl(raw: Raw): boolean {
  const currency = text(raw.currencyCode);
  return !currency || currency === 'BRL';
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function normalizeAccount(raw: unknown, itemId: string, institution: string): Omit<SnapshotAccount, 'transactions'> | null {
  if (!isRecord(raw) || !text(raw.id) || !isBrl(raw)) return null;
  const balance = toCents(raw.balance);
  if (balance === null) return null;
  let kind: ImportedAccountKind;
  if (raw.type === 'CREDIT') kind = 'credit';
  else if (raw.type === 'BANK') kind = raw.subtype === 'SAVINGS_ACCOUNT' ? 'savings' : 'checking';
  else return null;
  const fallback = kind === 'credit' ? 'Cartão de crédito' : kind === 'savings' ? 'Poupança' : 'Conta corrente';
  const billCycle = kind === 'credit' ? parseBillCycle(raw.creditData) : undefined;
  return {
    externalId: `pluggy:${text(raw.id)}`,
    itemId,
    kind,
    name: clip(text(raw.marketingName) || text(raw.name) || fallback, MAX_NAME_LENGTH),
    institution: clip(institution || 'Open Finance', MAX_NAME_LENGTH),
    bankBalanceCents: balance,
    ...(billCycle ? { billCycle } : {}),
  };
}

/** Fechamento e vencimento da fatura aberta (`creditData.balanceCloseDate` e `balanceDueDate`). */
function parseBillCycle(value: unknown): BillCycle | undefined {
  if (!isRecord(value)) return undefined;
  const closeDate = pluggyDateToLocal(value.balanceCloseDate);
  const dueDate = pluggyDateToLocal(value.balanceDueDate);
  return closeDate && dueDate && dueDate > closeDate ? { closeDate, dueDate } : undefined;
}

function parseInstallment(value: unknown): SnapshotTransaction['installment'] {
  if (!isRecord(value)) return undefined;
  const number = value.installmentNumber;
  const total = value.totalInstallments;
  if (typeof number !== 'number' || typeof total !== 'number' || !Number.isInteger(number) || !Number.isInteger(total)) return undefined;
  if (total < 2 || number < 1 || number > total) return undefined;
  const purchaseDate = pluggyDateToLocal(value.purchaseDate);
  return purchaseDate ? { number, total, purchaseDate } : { number, total };
}

const BILL_PAYMENT_TEXT = /\bfatura\b|pagamento (de )?cartao|pagto cartao|pgto cartao|cartao de credito/;
const CARD_PAYMENT_TEXT = /\bpagamento\b|\bpagto\b|\bpgto\b/;
const BILL_OPERATIONS = new Set(['PAGAMENTO_FATURA']);
const CARD_PAYMENT_OPERATIONS = new Set(['PAGAMENTO_FATURA', 'PAGAMENTO']);

function isCardPaymentCategory(raw: Raw): boolean {
  return /credit card payment/i.test(text(raw.category));
}

/**
 * Sentido do dinheiro:
 * - conta: `type` CREDIT entra, DEBIT sai (o sinal do valor não é confiável);
 * - cartão: valor positivo é compra (sai), negativo é pagamento ou estorno (entra).
 */
export function normalizeTransaction(raw: unknown, kind: ImportedAccountKind): SnapshotTransaction | null {
  if (!isRecord(raw) || !text(raw.id) || !isBrl(raw)) return null;
  const cents = toCents(raw.amount);
  const date = pluggyDateToLocal(raw.date);
  if (cents === null || cents === 0 || !date) return null;

  let direction: SnapshotTransaction['direction'];
  if (kind === 'credit') direction = cents > 0 ? 'out' : 'in';
  else if (raw.type === 'CREDIT') direction = 'in';
  else if (raw.type === 'DEBIT') direction = 'out';
  else direction = cents > 0 ? 'in' : 'out';

  const description = clip(text(raw.description) || text(raw.descriptionRaw) || 'Sem descrição', MAX_DESCRIPTION_LENGTH);
  const normalized = normalizeDescription(description);
  const operation = text(raw.operationType);
  const billPayment =
    kind !== 'credit' &&
    direction === 'out' &&
    (BILL_OPERATIONS.has(operation) || isCardPaymentCategory(raw) || BILL_PAYMENT_TEXT.test(normalized));
  const cardPayment =
    kind === 'credit' &&
    direction === 'in' &&
    (CARD_PAYMENT_OPERATIONS.has(operation) || isCardPaymentCategory(raw) || CARD_PAYMENT_TEXT.test(normalized));

  const installment = kind === 'credit' ? parseInstallment(raw.creditCardMetadata) : undefined;
  return {
    externalId: `pluggy:${text(raw.id)}`,
    description,
    amountCents: Math.abs(cents),
    direction,
    date,
    status: raw.status === 'PENDING' ? 'pending' : 'completed',
    billPayment,
    cardPayment,
    ...(installment ? { installment } : {}),
  };
}

function monthIndex(date: string): number {
  const [year = 1970, month = 1] = date.split('-').map(Number);
  return year * 12 + month - 1;
}

function monthKeyOf(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * Mês da fatura em que uma compra vence. Compra antes do dia de fechamento entra na fatura que fecha
 * naquele mês; no dia do fechamento ou depois, na do mês seguinte. O vencimento vem alguns dias depois
 * do fechamento, às vezes já no outro mês: essa distância vem da fatura aberta que o banco informou.
 */
export function billMonthFor(date: string, cycle: BillCycle): string {
  const closeDay = Number(cycle.closeDate.slice(8, 10));
  const day = Number(date.slice(8, 10));
  const closeMonth = monthIndex(date) + (day < closeDay ? 0 : 1);
  return monthKeyOf(closeMonth + monthIndex(cycle.dueDate) - monthIndex(cycle.closeDate));
}

function installmentGroup(transaction: SnapshotTransaction): string {
  // "LOJA PARC 02/10" e "Loja" são a mesma compra: tira o número da parcela e a palavra "parc(ela)".
  const base = normalizeDescription(transaction.description)
    .replace(/\b\d{1,2} \d{1,2}\b/g, ' ')
    .replace(/\b(parc|parcela|parcelas|parcelado)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base}|${transaction.amountCents}|${transaction.installment?.total ?? 0}`;
}

/**
 * Parcela no mês dela: se o banco manda a parcela 3/10 com a data da compra, ela vai para 2 meses
 * depois da compra. A data da compra vem do banco (`purchaseDate`) ou da parcela 1 da mesma compra.
 * A descrição ganha "(3/10)" quando ainda não tem.
 */
export function placeInstallments(transactions: SnapshotTransaction[]): SnapshotTransaction[] {
  const firstDates = new Map<string, string>();
  for (const transaction of transactions) {
    if (transaction.installment?.number === 1) firstDates.set(installmentGroup(transaction), transaction.date);
  }
  return transactions.map((transaction) => {
    const installment = transaction.installment;
    if (!installment) return transaction;
    const label = `${installment.number}/${installment.total}`;
    const mark = new RegExp(`\\b0?${installment.number}\\s*/\\s*0?${installment.total}\\b`);
    const description = mark.test(transaction.description) ? transaction.description : clip(`${transaction.description} (${label})`, MAX_DESCRIPTION_LENGTH);
    const purchase = installment.purchaseDate ?? firstDates.get(installmentGroup(transaction));
    const sameMonthAsPurchase = purchase !== undefined && purchase.slice(0, 7) === transaction.date.slice(0, 7);
    const date = installment.number > 1 && sameMonthAsPurchase ? addMonths(purchase, installment.number - 1) : transaction.date;
    return { ...transaction, description, date };
  });
}

/** Cartão: parcelas no mês delas e cada compra no mês da fatura (quando o banco informa o ciclo). */
export function finalizeCardTransactions(transactions: SnapshotTransaction[], cycle: BillCycle | undefined): SnapshotTransaction[] {
  const placed = placeInstallments(transactions);
  return cycle ? placed.map((transaction) => ({ ...transaction, billMonth: billMonthFor(transaction.date, cycle) })) : placed;
}

/** Empréstimo: usa `payments.contractOutstandingBalance` (quanto falta para quitar). */
export function normalizeLoan(raw: unknown, itemId: string, institution: string): SnapshotLoan | null {
  if (!isRecord(raw) || !text(raw.id) || !isBrl(raw)) return null;
  const payments = isRecord(raw.payments) ? raw.payments : {};
  const outstanding = toCents(payments.contractOutstandingBalance);
  if (outstanding === null || outstanding < 0) return null;
  return {
    externalId: `pluggy-loan:${text(raw.id)}`,
    itemId,
    name: clip(text(raw.productName) || 'Empréstimo', MAX_NAME_LENGTH),
    institution: clip(institution || 'Open Finance', MAX_NAME_LENGTH),
    outstandingCents: outstanding,
  };
}

/** Lista `results` de uma resposta paginada do Pluggy; null quando o formato não bate. */
export function resultsOf(value: unknown): unknown[] | null {
  return isRecord(value) && Array.isArray(value.results) ? value.results : null;
}
