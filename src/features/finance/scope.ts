// Separação Conta | Cartão (funções puras, testadas).
// Conta = o extrato do banco (inclui o pagamento da fatura). Cartão = a fatura (compras no mês da fatura).
import { toDateInput } from '@/utils/format';
import type { Account, MonthSummary, Transaction } from './types';

export type MoneyScope = 'account' | 'card';

export function isCardAccount(account: Account | undefined): boolean {
  return account?.type === 'credit';
}

export function hasCardAccounts(accounts: Account[]): boolean {
  return accounts.some(isCardAccount);
}

/** Sem conta ou conta que não existe mais conta do lado Conta. */
export function scopeOf(accountId: string | undefined, accounts: Account[]): MoneyScope {
  return isCardAccount(accounts.find((account) => account.id === accountId)) ? 'card' : 'account';
}

export function filterByScope<T extends { accountId?: string }>(items: T[], accounts: Account[], scope: MoneyScope): T[] {
  return items.filter((item) => scopeOf(item.accountId, accounts) === scope);
}

function monthOf(transaction: Transaction): string {
  return transaction.billMonth ?? transaction.date.slice(0, 7);
}

function effective(transaction: Transaction, today: string): boolean {
  return transaction.status === 'completed' && transaction.date <= today;
}

/**
 * Resumo do extrato das contas (sem cartões) no mês, como o banco mostra: o pagamento da fatura
 * entra nas saídas, porque o dinheiro saiu da conta. Pendentes e futuros vão para `pendingCents`.
 */
export function getAccountStatement(transactions: Transaction[], accounts: Account[], monthKey: string, today = toDateInput()): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let pendingCents = 0;
  for (const transaction of transactions) {
    if (monthOf(transaction) !== monthKey || scopeOf(transaction.accountId, accounts) !== 'account') continue;
    if (!effective(transaction, today)) {
      pendingCents += transaction.type === 'expense' ? transaction.amountCents : 0;
      continue;
    }
    if (transaction.type === 'income') incomeCents += transaction.amountCents;
    else expenseCents += transaction.amountCents;
  }
  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, pendingCents };
}

export interface CardBill {
  /** Compras e parcelas da fatura, menos estornos. */
  totalCents: number;
  purchasesCents: number;
  /** Estornos e créditos lançados no cartão (o pagamento da fatura não vem para cá). */
  creditsCents: number;
  /** Parte das compras com data depois de hoje (parcelas que ainda vão entrar). */
  upcomingCents: number;
  count: number;
}

/** Fatura dos cartões no mês: tudo o que cai nela (`billMonth`), inclusive parcelas com data futura. */
export function getCardBill(transactions: Transaction[], accounts: Account[], monthKey: string, today = toDateInput()): CardBill {
  let purchasesCents = 0;
  let creditsCents = 0;
  let upcomingCents = 0;
  let count = 0;
  for (const transaction of transactions) {
    if (monthOf(transaction) !== monthKey || scopeOf(transaction.accountId, accounts) !== 'card' || transaction.billPayment) continue;
    count += 1;
    if (transaction.type === 'income') {
      creditsCents += transaction.amountCents;
      continue;
    }
    purchasesCents += transaction.amountCents;
    if (transaction.date > today) upcomingCents += transaction.amountCents;
  }
  return { totalCents: purchasesCents - creditsCents, purchasesCents, creditsCents, upcomingCents, count };
}
