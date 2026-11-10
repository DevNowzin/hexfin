// O que ainda vai entrar e sair de hoje até o fim do mês (função pura, testada). É o resumo do Início.
import { billStatusFor } from '@/features/openfinance/normalize';
import { upcomingPayments } from '@/features/work/payroll';
import { isBillMonthPaid, nextBillOccurrence, overdueBills } from './bills';
import { getCardBill, isCardAccount, scopeOf } from './scope';
import type { Account, FinanceData, Transaction } from './types';

export interface AheadItem {
  id: string;
  description: string;
  date: string;
  amountCents: number;
  kind: 'transaction' | 'bill' | 'card' | 'salary';
  /** Conta que venceu sem confirmação de pagamento. */
  overdue?: boolean;
  /** De onde veio: abre ou confirma o item certo na lista do Início. */
  ref: AheadRef;
}

export type AheadRef =
  | { type: 'transaction'; transactionId: string }
  | { type: 'bill'; billId: string; monthKey: string }
  | { type: 'card'; accountId: string; monthKey: string }
  | { type: 'salary'; paymentId: string };

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

function nextMonthKey(monthKey: string): string {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * A próxima fatura de cada cartão que ainda não foi paga (a deste mês, se não venceu; senão a do mês
 * seguinte), mesmo vencendo depois do fim do mês: o dinheiro já está comprometido.
 */
function cardBillsAhead(data: FinanceData, today: string): AheadItem[] {
  const current = today.slice(0, 7);
  return data.accounts.flatMap((card: Account) => {
    if (!isCardAccount(card) || !card.billCycle) return [];
    for (const monthKey of [current, nextMonthKey(current)]) {
      const { closeDate, dueDate } = billStatusFor(monthKey, card.billCycle, today);
      if (dueDate < today) continue;
      const paid = data.transactions.some(
        (transaction) => transaction.billPayment && transaction.transferAccountId === card.id && transaction.date >= closeDate && transaction.date <= today,
      );
      if (paid) continue;
      const bill = getCardBill(data.transactions.filter((transaction) => transaction.accountId === card.id), [card], monthKey, today);
      if (bill.totalCents <= 0) continue;
      return [{ id: `card:${card.id}:${monthKey}`, description: `Fatura ${card.name}`, date: dueDate, amountCents: bill.totalCents, kind: 'card' as const, ref: { type: 'card' as const, accountId: card.id, monthKey } }];
    }
    return [];
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
    const item: AheadItem = { id: transaction.id, description: transaction.description, date: transaction.date, amountCents: transaction.amountCents, kind: 'transaction', ref: { type: 'transaction', transactionId: transaction.id } };
    (transaction.type === 'income' ? receivable : payable).push(item);
  }

  for (const bill of data.bills ?? []) {
    const occurrence = nextBillOccurrence(bill, today);
    if (!occurrence || occurrence.date > until || isBillMonthPaid(bill, occurrence.date.slice(0, 7))) continue;
    payable.push({ id: `bill:${bill.id}`, description: bill.description, date: occurrence.date, amountCents: bill.amountCents, kind: 'bill', ref: { type: 'bill', billId: bill.id, monthKey: occurrence.date.slice(0, 7) } });
  }
  // Vencer não quita: o que venceu sem "Já paguei" segue a pagar, como atrasado.
  for (const { bill, monthKey, date } of overdueBills(data.bills ?? [], today)) {
    payable.push({ id: `bill:${bill.id}:${monthKey}`, description: bill.description, date, amountCents: bill.amountCents, kind: 'bill', overdue: true, ref: { type: 'bill', billId: bill.id, monthKey } });
  }

  payable.push(...cardBillsAhead(data, today));

  // Salário previsto pelas horas: só previsão, fora do saldo até cair de verdade.
  if (data.work) {
    for (const payment of upcomingPayments(data.work, today.slice(0, 7), today)) {
      receivable.push({ id: `salary:${payment.id}`, description: payment.label, date: payment.date, amountCents: payment.amountCents, kind: 'salary', ref: { type: 'salary', paymentId: payment.id } });
    }
  }

  const byDate = (a: AheadItem, b: AheadItem) => a.date.localeCompare(b.date);
  const total = (items: AheadItem[]) => items.reduce((sum, item) => sum + item.amountCents, 0);
  receivable.sort(byDate);
  payable.sort(byDate);
  return { until, receivable, payable, receivableCents: total(receivable), payableCents: total(payable) };
}
