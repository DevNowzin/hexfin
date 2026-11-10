import { describe, expect, it } from 'vitest';
import { getAccountBalance, getMonthSummary, getTotalBalance } from '@/features/finance/selectors';
import type { FinanceData, Transaction } from '@/features/finance/types';
import { describeImport, importedStatus, mergeOpenFinance } from './merge';
import type { OpenFinanceSnapshot, SnapshotAccount, SnapshotTransaction } from './types';

const NOW = '2026-11-10T12:00:00.000Z';
const ITEM = 'item-1';

function ids() {
  let next = 0;
  return (prefix: string) => `${prefix}_${++next}`;
}

function empty(): FinanceData {
  return { accounts: [], transactions: [], profile: { name: '', hideBalances: false, theme: 'system' } };
}

function tx(id: string, overrides: Partial<SnapshotTransaction> = {}): SnapshotTransaction {
  return {
    externalId: `pluggy:${id}`,
    description: 'Mercado',
    amountCents: 1000,
    direction: 'out',
    date: '2026-11-05',
    status: 'completed',
    billPayment: false,
    cardPayment: false,
    ...overrides,
  };
}

function account(id: string, kind: SnapshotAccount['kind'], bankBalanceCents: number, transactions: SnapshotTransaction[]): SnapshotAccount {
  return { externalId: `pluggy:${id}`, itemId: ITEM, kind, name: `Conta ${id}`, institution: 'Banco X', bankBalanceCents, transactions };
}

function snapshot(accounts: SnapshotAccount[], extra: Partial<OpenFinanceSnapshot> = {}): OpenFinanceSnapshot {
  return { windowStart: '2026-08-12', today: '2026-11-10', accounts, loans: [], warnings: [], ...extra };
}

function byExternal(data: FinanceData, externalId: string): Transaction {
  const found = data.transactions.find((item) => item.externalId === externalId);
  if (!found) throw new Error(`sem ${externalId}`);
  return found;
}

describe('mergeOpenFinance', () => {
  it('cria a conta com o saldo igual ao do banco', () => {
    const snap = snapshot([account('c1', 'checking', 500000, [tx('t1', { amountCents: 2000 }), tx('t2', { direction: 'in', amountCents: 300000, description: 'Salário' })])]);
    const { data, report } = mergeOpenFinance(empty(), snap, NOW, ids());
    const checking = data.accounts[0]!;
    expect(checking).toMatchObject({ type: 'checking', externalId: 'pluggy:c1', name: 'Conta c1' });
    expect(getAccountBalance(checking, data.transactions)).toBe(500000);
    expect(checking.openingBalanceCents).toBe(500000 - 300000 + 2000);
    expect(report).toEqual({ accountsAdded: 1, accountsUpdated: 0, transactionsAdded: 2, transactionsUpdated: 0, transactionsRemoved: 0 });
    expect(byExternal(data, 'pluggy:t2')).toMatchObject({ type: 'income', categoryId: 'salary', status: 'completed' });
  });

  it('pendente não mexe no saldo ancorado', () => {
    const snap = snapshot([account('c1', 'checking', 10000, [tx('t1', { status: 'pending', amountCents: 5000 })])]);
    const { data } = mergeOpenFinance(empty(), snap, NOW, ids());
    expect(getAccountBalance(data.accounts[0]!, data.transactions)).toBe(10000);
  });

  it('cartão fica negativo, fora do saldo total, e a fatura paga vira transferência sem contar como gasto', () => {
    const snap = snapshot([
      account('c1', 'checking', 400000, [tx('pay', { description: 'Pagamento de fatura', amountCents: 120000, billPayment: true, date: '2026-11-08' })]),
      account('k1', 'credit', 35000, [
        tx('buy', { description: 'Restaurante', amountCents: 35000, date: '2026-11-06' }),
        tx('cardpay', { direction: 'in', amountCents: 120000, cardPayment: true, date: '2026-11-08' }),
      ]),
    ]);
    const { data } = mergeOpenFinance(empty(), snap, NOW, ids());
    const card = data.accounts.find((item) => item.type === 'credit')!;
    const checking = data.accounts.find((item) => item.type === 'checking')!;
    const payment = byExternal(data, 'pluggy:pay');

    expect(payment).toMatchObject({ type: 'expense', transferAccountId: card.id, billPayment: true });
    expect(data.transactions.some((item) => item.externalId === 'pluggy:cardpay')).toBe(false);
    expect(getAccountBalance(card, data.transactions)).toBe(-35000);
    expect(getAccountBalance(checking, data.transactions)).toBe(400000);
    expect(getTotalBalance(data.accounts, data.transactions)).toBe(400000);
    expect(getMonthSummary(data.transactions, '2026-11').expenseCents).toBe(35000);
  });

  it('sem um único cartão no mesmo banco, a fatura conta como gasto', () => {
    const snap = snapshot([account('c1', 'checking', 1000, [tx('pay', { billPayment: true, amountCents: 5000 })])]);
    const { data } = mergeOpenFinance(empty(), snap, NOW, ids());
    const payment = byExternal(data, 'pluggy:pay');
    expect(payment.transferAccountId).toBeUndefined();
    expect(payment.billPayment).toBeUndefined();
    expect(getMonthSummary(data.transactions, '2026-11').expenseCents).toBe(5000);
  });

  it('empréstimo vira conta negativa fora do saldo total', () => {
    const snap = snapshot([account('c1', 'checking', 1000, [])], {
      loans: [{ externalId: 'pluggy-loan:l1', itemId: ITEM, name: 'Crédito pessoal', institution: 'Banco X', outstandingCents: 845030 }],
    });
    const { data } = mergeOpenFinance(empty(), snap, NOW, ids());
    const loan = data.accounts.find((item) => item.type === 'loan')!;
    expect(getAccountBalance(loan, data.transactions)).toBe(-845030);
    expect(getTotalBalance(data.accounts, data.transactions)).toBe(1000);
  });

  it('sincronizar de novo não duplica e mantém a categoria, as notas e o nome escolhidos', () => {
    const first = mergeOpenFinance(empty(), snapshot([account('c1', 'checking', 1000, [tx('t1')])]), NOW, ids()).data;
    const edited: FinanceData = {
      ...first,
      accounts: first.accounts.map((item) => ({ ...item, name: 'Minha conta', color: '#000000' })),
      transactions: first.transactions.map((item) => ({ ...item, categoryId: 'leisure', notes: 'jantar' })),
    };
    const { data, report } = mergeOpenFinance(edited, snapshot([account('c1', 'checking', 2000, [tx('t1')])]), NOW, ids());
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0]).toMatchObject({ name: 'Minha conta', color: '#000000' });
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({ id: first.transactions[0]!.id, categoryId: 'leisure', notes: 'jantar' });
    expect(getAccountBalance(data.accounts[0]!, data.transactions)).toBe(2000);
    expect(report).toMatchObject({ accountsAdded: 0, accountsUpdated: 1, transactionsAdded: 0, transactionsUpdated: 0, transactionsRemoved: 0 });
  });

  it('atualiza o que o banco mudou e remove o que sumiu da janela', () => {
    const first = mergeOpenFinance(empty(), snapshot([account('c1', 'checking', 1000, [tx('t1'), tx('t2'), tx('old', { date: '2026-07-01' })])]), NOW, ids()).data;
    const { data, report } = mergeOpenFinance(first, snapshot([account('c1', 'checking', 1000, [tx('t1', { amountCents: 1500 })])]), NOW, ids());
    expect(data.transactions.map((item) => item.externalId).sort()).toEqual(['pluggy:old', 'pluggy:t1']);
    expect(byExternal(data, 'pluggy:t1').amountCents).toBe(1500);
    expect(report).toMatchObject({ transactionsUpdated: 1, transactionsRemoved: 1, transactionsAdded: 0 });
  });

  it('lançamentos manuais e contas de outros bancos não são tocados', () => {
    const manual: Transaction = {
      id: 'manual', description: 'Feira', amountCents: 3000, type: 'expense', date: '2026-11-05',
      categoryId: 'food', accountId: 'acc-manual', status: 'completed', createdAt: NOW,
    };
    const start: FinanceData = {
      ...empty(),
      accounts: [{ id: 'acc-manual', name: 'Carteira', institution: 'Carteira', type: 'cash', color: '#4ADE80', openingBalanceCents: 10000 }],
      transactions: [manual],
    };
    const { data } = mergeOpenFinance(start, snapshot([account('c1', 'checking', 1000, [])]), NOW, ids());
    expect(data.transactions).toContainEqual(manual);
    expect(data.accounts[0]).toEqual(start.accounts[0]);
  });
});

describe('mergeOpenFinance: datas', () => {
  it('compra de cartão guarda o mês da fatura e parcela futura não mexe no saldo ancorado', () => {
    const snap = snapshot([
      account('k1', 'credit', 30000, [
        tx('buy', { amountCents: 10000, date: '2026-11-08', billMonth: '2026-12' }),
        tx('next', { amountCents: 10000, date: '2027-01-08', status: 'pending', billMonth: '2027-02' }),
      ]),
    ]);
    const { data } = mergeOpenFinance(empty(), snap, NOW, ids());
    const card = data.accounts[0]!;
    expect(byExternal(data, 'pluggy:buy').billMonth).toBe('2026-12');
    expect(getAccountBalance(card, data.transactions, '2026-11-10')).toBe(-30000);
    expect(getMonthSummary(data.transactions, '2026-11', '2026-11-10').expenseCents).toBe(0);
    expect(getMonthSummary(data.transactions, '2026-12', '2026-11-10').expenseCents).toBe(10000);
  });

  it('mudar o mês da fatura conta como atualização', () => {
    const first = mergeOpenFinance(empty(), snapshot([account('k1', 'credit', 0, [tx('buy', { billMonth: '2026-12' })])]), NOW, ids()).data;
    const { report } = mergeOpenFinance(first, snapshot([account('k1', 'credit', 0, [tx('buy', { billMonth: '2027-01' })])]), NOW, ids());
    expect(report.transactionsUpdated).toBe(1);
  });
});

describe('describeImport', () => {
  it('resume sem valores em reais', () => {
    expect(describeImport({ accountsAdded: 2, accountsUpdated: 0, transactionsAdded: 1, transactionsUpdated: 3, transactionsRemoved: 0 }))
      .toBe('2 contas novas · 1 transação nova · 3 atualizadas');
    expect(describeImport({ accountsAdded: 0, accountsUpdated: 2, transactionsAdded: 0, transactionsUpdated: 0, transactionsRemoved: 0 }))
      .toBe('Nada novo desde a última vez');
  });
});

describe('importedStatus', () => {
  const today = '2026-11-10';

  it('pagamento da conta que o banco ainda marca como pendente conta como feito', () => {
    expect(importedStatus(tx('a', { status: 'pending', date: '2026-11-05' }), 'checking', today)).toBe('completed');
    expect(importedStatus(tx('b', { status: 'pending', date: today }), 'savings', today)).toBe('completed');
  });

  it('agendamento na conta (data futura) continua pendente', () => {
    expect(importedStatus(tx('a', { status: 'pending', date: '2026-11-20' }), 'checking', today)).toBe('pending');
  });

  it('cartão segue o status do banco', () => {
    expect(importedStatus(tx('a', { status: 'pending', date: '2026-11-05' }), 'credit', today)).toBe('pending');
  });

  it('na importação, o Pix pendente entra nas saídas do mês e o saldo segue o do banco', () => {
    const snap = snapshot([account('c1', 'checking', 9000, [tx('pix', { status: 'pending', amountCents: 1000 })])]);
    const { data } = mergeOpenFinance(empty(), snap, NOW, ids());
    expect(byExternal(data, 'pluggy:pix').status).toBe('completed');
    expect(getMonthSummary(data.transactions, '2026-11', today)).toMatchObject({ expenseCents: 1000, pendingCents: 0 });
    expect(getTotalBalance(data.accounts, data.transactions, today)).toBe(9000);
  });
});

describe('ciclo da fatura na conta do cartão', () => {
  it('guarda o fechamento e o vencimento que o banco informou e atualiza na próxima sincronização', () => {
    const card = (closeDate: string, dueDate: string) => ({ ...account('k1', 'credit', 50000, []), billCycle: { closeDate, dueDate } });
    const first = mergeOpenFinance(empty(), snapshot([card('2026-11-28', '2026-12-05')]), NOW, ids()).data;
    expect(first.accounts[0]!.billCycle).toEqual({ closeDate: '2026-11-28', dueDate: '2026-12-05' });
    const next = mergeOpenFinance(first, snapshot([card('2026-12-29', '2027-01-05')]), NOW, ids()).data;
    expect(next.accounts[0]!.billCycle).toEqual({ closeDate: '2026-12-29', dueDate: '2027-01-05' });
  });
});
