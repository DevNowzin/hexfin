// Contas fixas e empréstimos cadastrados à mão (funções puras, testadas). Só preveem vencimentos:
// não criam transações nem mexem em saldo.
import type { PlannedBill, PlannedBillDraft } from './types';

export const MAX_LOAN_INSTALLMENTS = 480;

function monthIndex(monthKey: string): number {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  return year * 12 + month - 1;
}

function monthKeyOf(index: number): string {
  const year = Math.floor(index / 12);
  return `${year}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Vencimento no mês; dia 31 em mês curto vira o último dia. */
export function dueDateIn(monthKey: string, dueDay: number): string {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  const lastDay = new Date(year, month, 0, 12).getDate();
  return `${monthKey}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`;
}

/** Mês do primeiro vencimento a partir de hoje: este mês se o dia ainda não passou, senão o próximo. */
export function firstDueMonth(dueDay: number, today: string): string {
  const current = today.slice(0, 7);
  return dueDateIn(current, dueDay) >= today ? current : monthKeyOf(monthIndex(current) + 1);
}

export interface BillOccurrence {
  date: string;
  /** Empréstimo: parcelas que faltam contando esta. */
  remaining?: number;
}

/** Próximo vencimento a partir de hoje, ou `null` se o empréstimo já terminou. */
export function nextBillOccurrence(bill: PlannedBill, today: string): BillOccurrence | null {
  const start = monthIndex(bill.startMonth);
  const fromToday = monthIndex(firstDueMonth(bill.dueDay, today));
  const index = Math.max(start, fromToday);
  const date = dueDateIn(monthKeyOf(index), bill.dueDay);
  if (bill.kind !== 'loan') return { date };
  const remaining = (bill.installments ?? 0) - (index - start);
  return remaining > 0 ? { date, remaining } : null;
}

/** Ao editar "parcelas que faltam", recalcula o total contado desde `startMonth`. */
export function installmentsFor(startMonth: string, dueDay: number, remaining: number, today: string): number {
  const elapsed = Math.max(0, monthIndex(firstDueMonth(dueDay, today)) - monthIndex(startMonth));
  return elapsed + remaining;
}

/** Valida o rascunho; devolve a mensagem de erro ou `null`. */
export function validateBillDraft(draft: PlannedBillDraft): string | null {
  if (!draft.description.trim()) return 'Dê um nome para a conta.';
  if (!Number.isInteger(draft.amountCents) || draft.amountCents <= 0) return 'Informe um valor maior que zero.';
  if (!Number.isInteger(draft.dueDay) || draft.dueDay < 1 || draft.dueDay > 31) return 'O dia do vencimento vai de 1 a 31.';
  if (draft.kind === 'loan') {
    const installments = draft.installments ?? 0;
    if (!Number.isInteger(installments) || installments < 1 || installments > MAX_LOAN_INSTALLMENTS) {
      return `Informe quantas parcelas faltam (1 a ${MAX_LOAN_INSTALLMENTS}).`;
    }
  }
  return null;
}

function monthList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}$/.test(item));
}

/** Dados antigos ou corrompidos: fica só o que tem a forma de uma conta prevista (e meses válidos). */
export function sanitizeBills(value: unknown): PlannedBill[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isBillShape).map((bill) => {
    const { paidMonths, unpaidMonths, ...rest } = bill;
    const paid = monthList(paidMonths);
    const unpaid = monthList(unpaidMonths);
    return { ...rest, ...(paid ? { paidMonths: paid } : {}), ...(unpaid ? { unpaidMonths: unpaid } : {}) };
  });
}

function isBillShape(item: unknown): item is PlannedBill {
  if (!item || typeof item !== 'object') return false;
  const bill = item as Partial<PlannedBill>;
  return (
    typeof bill.id === 'string' &&
    typeof bill.description === 'string' &&
    Number.isInteger(bill.amountCents) &&
    Number.isInteger(bill.dueDay) &&
    typeof bill.categoryId === 'string' &&
    (bill.kind === 'fixed' || bill.kind === 'loan') &&
    typeof bill.startMonth === 'string' &&
    /^\d{4}-\d{2}$/.test(bill.startMonth)
  );
}

/** Vencimentos entre dois dias (inclusive), a partir de `startMonth` e dentro das parcelas do empréstimo. */
export function billDueDatesBetween(bill: PlannedBill, from: string, to: string): Array<{ monthKey: string; date: string }> {
  const start = monthIndex(bill.startMonth);
  const result: Array<{ monthKey: string; date: string }> = [];
  for (let index = Math.max(start, monthIndex(from.slice(0, 7))); index <= monthIndex(to.slice(0, 7)); index += 1) {
    if (bill.kind === 'loan' && index - start >= (bill.installments ?? 0)) break;
    const monthKey = monthKeyOf(index);
    const date = dueDateIn(monthKey, bill.dueDay);
    if (date >= from && date <= to) result.push({ monthKey, date });
  }
  return result;
}

export function isBillMonthPaid(bill: PlannedBill, monthKey: string): boolean {
  return bill.paidMonths?.includes(monthKey) ?? false;
}

export interface OverdueBill {
  bill: PlannedBill;
  monthKey: string;
  date: string;
  /** O usuário já respondeu "Ainda não": segue atrasada até confirmar. */
  acknowledged: boolean;
}

/** Quantos meses para trás o app ainda pergunta se uma conta foi paga. */
export const OVERDUE_LOOKBACK_MONTHS = 2;

/** Contas que já venceram (antes de hoje) e ainda não foram confirmadas como pagas, da mais antiga à mais nova. */
export function overdueBills(bills: PlannedBill[], today: string): OverdueBill[] {
  const from = `${monthKeyOf(monthIndex(today.slice(0, 7)) - OVERDUE_LOOKBACK_MONTHS)}-01`;
  const yesterday = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) - 1, 12);
  const to = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  return bills
    .flatMap((bill) =>
      billDueDatesBetween(bill, from, to)
        .filter(({ monthKey }) => !isBillMonthPaid(bill, monthKey))
        .map(({ monthKey, date }) => ({ bill, monthKey, date, acknowledged: bill.unpaidMonths?.includes(monthKey) ?? false })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** "Já paguei" ou "Ainda não" para o vencimento de um mês. */
export function setBillMonthPaid(bill: PlannedBill, monthKey: string, paid: boolean): PlannedBill {
  const without = (list: string[] | undefined) => (list ?? []).filter((item) => item !== monthKey);
  const paidMonths = paid ? [...without(bill.paidMonths), monthKey].sort() : without(bill.paidMonths);
  const unpaidMonths = paid ? without(bill.unpaidMonths) : [...without(bill.unpaidMonths), monthKey].sort();
  return { ...bill, paidMonths, unpaidMonths };
}
