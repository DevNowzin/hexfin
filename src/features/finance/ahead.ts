// O que ainda vai entrar e sair de hoje até o fim do mês (função pura, testada). É o resumo do Início.
import { billStatusFor } from '@/features/openfinance/normalize';
import { isBillMonthPaid, nextBillOccurrence, overdueBills } from './bills';
import { getCardBill, isCardAccount, scopeOf } from './scope';
import type { Account, FinanceData, Transaction } from './types';

export interface AheadItem {
  id: string;
  description: string;
  date: string;
  amountCents: number;
  kind: 'transaction' | 'bill' | 'card';
  /** Conta que venceu sem confirmação de pagamento. */
  overdue?: boolean;
}

export interface MonthAhead {
  /** Último dia do mês (`YYYY-MM-DD`). */
  until: string;
  receivable: AheadItem[];
  payable: AheadItem[];
  receivableCents: number;
  payableCents: number;
}

function lastDayOf(today: string): string {
  const [year = 1970, month = 1] = today.split('-').map(Number);
  return `${today.slice(0, 7)}-${String(new Date(year, month, 0, 12).getDate()).padStart(2, '0')}`;
}

/** Ainda não aconteceu: pendente ou com data depois de hoje. */
function stillAhead(transaction: Transaction, today: string): boolean {
  return transaction.status === 'pending' || transaction.date > today;
}

/** Faturas de cartão que vencem de hoje até o fim do mês e ainda não foram pagas. */
function cardBillsAhead(data: FinanceData, today: string, until: string): AheadItem[] {
  const monthKey = today.slice(0, 7);
  return data.accounts.flatMap((card: Account) => {
    if (!isCardAccount(card) || !card.billCycle) return [];
    const { closeDate, dueDate } = billStatusFor(monthKey, card.billCycle, today);
    if (dueDate < today || dueDate > until) return [];
    const paid = data.transactions.some(
      (transaction) => transaction.billPayment && transaction.transferAccountId === card.id && transaction.date >= closeDate && transaction.date <= today,
    );
    if (paid) return [];
    const bill = getCardBill(data.transactions.filter((transaction) => transaction.accountId === card.id), [card], monthKey, today);
    return bill.totalCents > 0 ? [{ id: `card:${card.id}`, description: `Fatura ${card.name}`, date: dueDate, amountCents: bill.totalCents, kind: 'card' as const }] : [];
  });
}

export function getMonthAhead(data: FinanceData, today: string): MonthAhead {
  const until = lastDayOf(today);
  const receivable: AheadItem[] = [];
  const payable: AheadItem[] = [];

  for (const transaction of data.transactions) {
    // Cartão entra pela fatura; transferência e pagamento de fatura só movem dinheiro entre contas.
    if (scopeOf(transaction.accountId, data.accounts) !== 'account' || transaction.transferAccountId || transaction.billPayment) continue;
    if (transaction.date > until || transaction.date.slice(0, 7) !== today.slice(0, 7) || !stillAhead(transaction, today)) continue;
    const item: AheadItem = { id: transaction.id, description: transaction.description, date: transaction.date, amountCents: transaction.amountCents, kind: 'transaction' };
    (transaction.type === 'income' ? receivable : payable).push(item);
  }

  for (const bill of data.bills ?? []) {
    const occurrence = nextBillOccurrence(bill, today);
    if (!occurrence || occurrence.date > until || isBillMonthPaid(bill, occurrence.date.slice(0, 7))) continue;
    payable.push({ id: `bill:${bill.id}`, description: bill.description, date: occurrence.date, amountCents: bill.amountCents, kind: 'bill' });
  }
  // Vencer não quita: o que venceu sem "Já paguei" segue a pagar, como atrasado.
  for (const { bill, monthKey, date } of overdueBills(data.bills ?? [], today)) {
    payable.push({ id: `bill:${bill.id}:${monthKey}`, description: bill.description, date, amountCents: bill.amountCents, kind: 'bill', overdue: true });
  }

  payable.push(...cardBillsAhead(data, today, until));

  const byDate = (a: AheadItem, b: AheadItem) => a.date.localeCompare(b.date);
  const total = (items: AheadItem[]) => items.reduce((sum, item) => sum + item.amountCents, 0);
  receivable.sort(byDate);
  payable.sort(byDate);
  return { until, receivable, payable, receivableCents: total(receivable), payableCents: total(payable) };
}
