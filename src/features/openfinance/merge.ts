// Junta um retrato do Open Finance aos dados locais (função pura, testada).
//
// Regras:
// - Cada conta do banco vira (ou atualiza) uma conta do app pelo `externalId`; nome e cor
//   escolhidos pelo usuário são mantidos.
// - Transações importadas da janela buscada são substituídas pelas novas. Categoria, notas e
//   recorrência que o usuário mudou são mantidas pelo `externalId`. Lançamentos manuais e
//   importados de antes da janela não são tocados.
// - Pagamento de fatura na conta corrente vira transferência para o cartão do mesmo banco
//   (quando há exatamente um) e não conta como gasto; o pagamento do lado do cartão é ignorado.
// - O saldo de cada conta importada fica igual ao do banco: o saldo inicial é ajustado.
//   Cartão e empréstimo ficam negativos (dívida).
import { localCategorize } from '@/features/ai/categorize';
import { getAccountBalance } from '@/features/finance/selectors';
import type { Account, AccountType, FinanceData, Transaction } from '@/features/finance/types';
import { cardBillMonth } from './normalize';
import type { BillCycle, ImportReport, OpenFinanceSnapshot, SnapshotTransaction } from './types';

const IMPORTED_COLORS: Record<AccountType, string> = {
  checking: '#8B7CFF',
  savings: '#34D399',
  credit: '#EC4899',
  loan: '#F97316',
  investment: '#38BDF8',
  cash: '#4ADE80',
};

interface Target {
  externalId: string;
  type: AccountType;
  name: string;
  institution: string;
  billCycle?: BillCycle;
  logoUrl?: string;
}

export type IdFactory = (prefix: string) => string;

function upsertAccount(accounts: Account[], target: Target, createId: IdFactory, report: ImportReport): Account {
  const index = accounts.findIndex((account) => account.externalId === target.externalId);
  const existing = accounts[index];
  if (existing) {
    // Logo do conector só se a pessoa não renomeou a instituição.
    const keepsInstitution = existing.institution === target.institution;
    const updated = {
      ...existing,
      type: target.type,
      ...(target.billCycle ? { billCycle: target.billCycle } : {}),
      ...(target.logoUrl && keepsInstitution ? { logoUrl: target.logoUrl, logoFor: target.institution } : {}),
    };
    accounts[index] = updated;
    report.accountsUpdated += 1;
    return updated;
  }
  const created: Account = {
    id: createId('account'),
    name: target.name,
    institution: target.institution,
    type: target.type,
    color: IMPORTED_COLORS[target.type],
    openingBalanceCents: 0,
    externalId: target.externalId,
    ...(target.billCycle ? { billCycle: target.billCycle } : {}),
    ...(target.logoUrl ? { logoUrl: target.logoUrl, logoFor: target.institution } : {}),
  };
  accounts.push(created);
  report.accountsAdded += 1;
  return created;
}

function sameContent(a: Transaction, b: Transaction): boolean {
  return (
    a.description === b.description &&
    a.amountCents === b.amountCents &&
    a.type === b.type &&
    a.date === b.date &&
    a.status === b.status &&
    a.accountId === b.accountId &&
    a.transferAccountId === b.transferAccountId &&
    a.billMonth === b.billMonth &&
    Boolean(a.billPayment) === Boolean(b.billPayment)
  );
}

/**
 * O Pluggy marca como `PENDING` lançamentos da conta que o banco ainda não "fechou", mesmo com o
 * dinheiro já fora da conta. Na conta, com data até hoje, conta como feito. Cartão e datas futuras
 * (agendamentos) seguem o status do banco.
 */
export function importedStatus(item: SnapshotTransaction, kind: AccountType, today: string): Transaction['status'] {
  if (item.status === 'pending' && kind !== 'credit' && item.date <= today) return 'completed';
  return item.status;
}

function buildTransaction(
  source: SnapshotTransaction,
  accountId: string,
  cardAccountId: string | undefined,
  previous: Transaction | undefined,
  createId: IdFactory,
  now: string,
): Transaction {
  const type = source.direction === 'in' ? 'income' : 'expense';
  const billPayment = source.billPayment && cardAccountId !== undefined;
  const keepCategory = previous && previous.type === type;
  const categoryId = keepCategory
    ? previous.categoryId
    : billPayment
      ? 'other'
      : (localCategorize(source.description, type)?.categoryId ?? 'other');
  const transaction: Transaction = {
    id: previous?.id ?? createId('tx'),
    description: source.description,
    amountCents: source.amountCents,
    type,
    date: source.date,
    categoryId,
    accountId,
    status: source.status,
    createdAt: previous?.createdAt ?? now,
    externalId: source.externalId,
    ...(source.installment ? { installment: source.installment } : {}),
  };
  if (billPayment) {
    transaction.transferAccountId = cardAccountId;
    transaction.billPayment = true;
  }
  if (source.billMonth) transaction.billMonth = source.billMonth;
  if (previous?.notes) transaction.notes = previous.notes;
  if (previous?.recurrence) transaction.recurrence = previous.recurrence;
  return transaction;
}

export function mergeOpenFinance(
  data: FinanceData,
  snapshot: OpenFinanceSnapshot,
  now: string,
  createId: IdFactory,
): { data: FinanceData; report: ImportReport } {
  const report: ImportReport = { accountsAdded: 0, accountsUpdated: 0, transactionsAdded: 0, transactionsUpdated: 0, transactionsRemoved: 0 };
  const accounts = [...data.accounts];

  const synced = snapshot.accounts.map((source) => ({
    source,
    account: upsertAccount(
      accounts,
      {
        externalId: source.externalId,
        type: source.kind,
        name: source.name,
        institution: source.institution,
        billCycle: source.billCycle,
        logoUrl: source.logoUrl,
      },
      createId,
      report,
    ),
  }));
  const loans = snapshot.loans.map((loan) => ({
    balanceCents: -loan.outstandingCents,
    account: upsertAccount(
      accounts,
      { externalId: loan.externalId, type: 'loan', name: loan.name, institution: loan.institution, logoUrl: loan.logoUrl },
      createId,
      report,
    ),
  }));

  const cardsByItem = new Map<string, string[]>();
  for (const { source, account } of synced) {
    if (source.kind !== 'credit') continue;
    cardsByItem.set(source.itemId, [...(cardsByItem.get(source.itemId) ?? []), account.id]);
  }

  const previousByExternalId = new Map(
    data.transactions.filter((transaction) => transaction.externalId).map((transaction) => [transaction.externalId!, transaction]),
  );
  const fresh: Transaction[] = [];
  for (const { source, account } of synced) {
    const cards = cardsByItem.get(source.itemId) ?? [];
    const cardAccountId = source.kind !== 'credit' && cards.length === 1 ? cards[0] : undefined;
    // Banco sem fechamento e vencimento: vale o ciclo que a pessoa informou no cartão.
    const fallbackCycle = source.kind === 'credit' && !source.billCycle ? account.billCycle : undefined;
    for (const raw of source.transactions) {
      const item = fallbackCycle ? { ...raw, billMonth: cardBillMonth(raw, fallbackCycle) } : raw;
      if (source.kind === 'credit' && item.cardPayment) continue;
      const previous = previousByExternalId.get(item.externalId);
      const status = importedStatus(item, source.kind, snapshot.today);
      const transaction = buildTransaction({ ...item, status }, account.id, cardAccountId, previous, createId, now);
      if (!previous) report.transactionsAdded += 1;
      else if (!sameContent(previous, transaction)) report.transactionsUpdated += 1;
      fresh.push(transaction);
    }
  }

  const freshIds = new Set(fresh.map((transaction) => transaction.externalId));
  const syncedIds = new Set(synced.map(({ account }) => account.id));
  const kept = data.transactions.filter((transaction) => {
    if (!transaction.externalId) return true;
    if (freshIds.has(transaction.externalId)) return false;
    const replaced = syncedIds.has(transaction.accountId) && transaction.date >= snapshot.windowStart;
    if (replaced) report.transactionsRemoved += 1;
    return !replaced;
  });
  const transactions = [...fresh, ...kept];

  const targets = new Map<string, number>([
    ...synced.map(({ source, account }) => [account.id, source.kind === 'credit' ? -source.bankBalanceCents : source.bankBalanceCents] as const),
    ...loans.map(({ account, balanceCents }) => [account.id, balanceCents] as const),
  ]);
  const logos = snapshot.bankLogos ?? {};
  const anchored = accounts.map((current) => {
    const bankLogo = current.externalId ? logos[current.institution] : undefined;
    const account = bankLogo ? { ...current, logoUrl: bankLogo, logoFor: current.institution } : current;
    const target = targets.get(account.id);
    if (target === undefined) return account;
    const movement = getAccountBalance({ ...account, openingBalanceCents: 0 }, transactions, snapshot.today);
    return { ...account, openingBalanceCents: target - movement };
  });

  return { data: { ...data, accounts: anchored, transactions }, report };
}

/** Guarda o ciclo da fatura no cartão e recoloca cada compra dele na fatura certa. */
export function applyCardCycle(data: FinanceData, accountId: string, cycle: BillCycle): FinanceData {
  return {
    ...data,
    accounts: data.accounts.map((account) => (account.id === accountId ? { ...account, billCycle: cycle } : account)),
    transactions: data.transactions.map((transaction) =>
      transaction.accountId === accountId && !transaction.billPayment ? { ...transaction, billMonth: cardBillMonth(transaction, cycle) } : transaction,
    ),
  };
}

function countLabel(count: number, one: string, many: string): string | null {
  return count > 0 ? `${count} ${count === 1 ? one : many}` : null;
}

/** Resumo curto da importação para a tela (sem valores em reais). */
export function describeImport(report: ImportReport): string {
  const parts = [
    countLabel(report.accountsAdded, 'conta nova', 'contas novas'),
    countLabel(report.transactionsAdded, 'transação nova', 'transações novas'),
    countLabel(report.transactionsUpdated, 'atualizada', 'atualizadas'),
    countLabel(report.transactionsRemoved, 'removida pelo banco', 'removidas pelo banco'),
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' · ') : 'Nada novo desde a última vez';
}
