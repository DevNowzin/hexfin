import { describe, expect, it } from 'vitest';
import { defaultWorkSettings } from '@/features/work/payroll';
import { getMonthAhead } from './ahead';
import type { Account, FinanceData, PlannedBill, Transaction } from './types';

const TODAY = '2026-11-10';

const checking: Account = { id: 'c', name: 'Conta', institution: 'Banco', type: 'checking', color: '#000', openingBalanceCents: 0 };
const card: Account = {
  id: 'k', name: 'Nubank', institution: 'Nu', type: 'credit', color: '#000', openingBalanceCents: 0,
  billCycle: { closeDate: '2026-11-28', dueDate: '2026-12-05' },
};

function tx(id: string, overrides: Partial<Transaction>): Transaction {
  return {
    id, description: id, amountCents: 1000, type: 'expense', date: '2026-11-20', categoryId: 'other',
    accountId: 'c', status: 'completed', createdAt: '2026-11-01T00:00:00Z', ...overrides,
  };
}

function bill(id: string, dueDay: number, overrides: Partial<PlannedBill> = {}): PlannedBill {
  return { id, description: id, amountCents: 5000, dueDay, categoryId: 'other', kind: 'fixed', startMonth: '2026-11', createdAt: '2026-01-01T00:00:00Z', ...overrides };
}

function data(transactions: Transaction[], bills: PlannedBill[] = [], accounts: Account[] = [checking]): FinanceData {
  return { accounts, transactions, bills, profile: { name: '', hideBalances: false, theme: 'system' } };
}

describe('getMonthAhead', () => {
  it('só o que ainda vai acontecer até o fim do mês: futuros e pendentes', () => {
    const ahead = getMonthAhead(data([
      tx('passou', { date: '2026-11-05' }),
      tx('hoje-feito', { date: TODAY }),
      tx('hoje-pendente', { date: TODAY, status: 'pending', amountCents: 300 }),
      tx('futuro', { date: '2026-11-25', amountCents: 2000 }),
      tx('mes-que-vem', { date: '2026-12-02' }),
      tx('salario', { type: 'income', date: '2026-11-30', amountCents: 300000 }),
    ]), TODAY);
    expect(ahead.until).toBe('2026-11-30');
    expect(ahead.payable.map((item) => item.id)).toEqual(['hoje-pendente', 'futuro']);
    expect(ahead.payableCents).toBe(2300);
    expect(ahead.receivableCents).toBe(300000);
  });

  it('transferência, pagamento de fatura e compra no cartão não entram (a fatura entra inteira)', () => {
    const ahead = getMonthAhead(data([
      tx('aporte', { transferAccountId: 'outra' }),
      tx('paga-fatura', { billPayment: true, transferAccountId: 'k' }),
      tx('compra-cartao', { accountId: 'k' }),
    ], [], [checking, card]), TODAY);
    expect(ahead.payable).toEqual([]);
  });

  it('conta fixa e parcela de empréstimo que ainda vencem no mês', () => {
    const ahead = getMonthAhead(data([], [
      bill('luz', 15),
      bill('aluguel', 5, { paidMonths: ['2026-11'] }),
      bill('emprestimo', 28, { kind: 'loan', installments: 24 }),
      bill('acabou', 20, { kind: 'loan', installments: 2, startMonth: '2026-01' }),
    ]), TODAY);
    expect(ahead.payable.map((item) => [item.id, item.date])).toEqual([
      ['bill:luz', '2026-11-15'],
      ['bill:emprestimo', '2026-11-28'],
    ]);
  });

  it('fatura do cartão que vence no mês e ainda não foi paga', () => {
    const purchases = [tx('mercado', { accountId: 'k', date: '2026-10-20', billMonth: '2026-11', amountCents: 45996 })];
    // Fatura de nov vence 05/11: em 03/11 ainda está a pagar.
    const before = getMonthAhead(data(purchases, [], [checking, card]), '2026-11-03');
    expect(before.payable).toMatchObject([{ id: 'card:k:2026-11', description: 'Fatura Nubank', date: '2026-11-05', amountCents: 45996, kind: 'card' }]);
    // Paga no dia 04: some.
    const paid = getMonthAhead(data([...purchases, tx('pagou', { date: '2026-11-04', billPayment: true, transferAccountId: 'k' })], [], [checking, card]), '2026-11-04');
    expect(paid.payable).toEqual([]);
    // Depois do vencimento, sem compras na fatura seguinte, não há fatura a pagar.
    expect(getMonthAhead(data(purchases, [], [checking, card]), TODAY).payable).toEqual([]);
  });

  it('a próxima fatura entra mesmo vencendo no mês seguinte (fatura aberta de dezembro)', () => {
    const purchases = [
      tx('paga', { accountId: 'k', date: '2026-10-20', billMonth: '2026-11', amountCents: 45996 }),
      tx('padaria', { accountId: 'k', date: '2026-11-03', billMonth: '2026-12', amountCents: 2500 }),
      tx('parcela-futura', { accountId: 'k', date: '2026-12-03', billMonth: '2026-12', amountCents: 1000 }),
    ];
    const ahead = getMonthAhead(data(purchases, [], [checking, card]), TODAY);
    expect(ahead.payable).toMatchObject([{ id: 'card:k:2026-12', description: 'Fatura Nubank', date: '2026-12-07', amountCents: 3500, kind: 'card' }]);
  });
});

describe('contas vencidas no A pagar', () => {
  it('vencida sem confirmação segue a pagar como atrasada; paga antes do vencimento sai', () => {
    const luz = bill('luz', 5, { startMonth: '2026-11' });
    const net = bill('net', 20, { startMonth: '2026-11', paidMonths: ['2026-11'] });
    const ahead = getMonthAhead(data([], [luz, net]), TODAY);
    expect(ahead.payable).toMatchObject([{ id: 'bill:luz:2026-11', description: 'luz', date: '2026-11-05', amountCents: 5000, kind: 'bill', overdue: true, ref: { type: 'bill', billId: 'luz', monthKey: '2026-11' } }]);
    const confirmed = getMonthAhead(data([], [{ ...luz, paidMonths: ['2026-11'] }]), TODAY);
    expect(confirmed.payable).toEqual([]);
  });
});

describe('salário previsto no A receber', () => {
  it('as quinzenas que ainda vão cair entram como previstas; recebida antes sai', () => {
    const work = { ...defaultWorkSettings(TODAY), hourlyRateCents: 1000 };
    const ahead = getMonthAhead({ ...data([]), work }, TODAY);
    expect(ahead.receivable.map((item) => [item.description, item.date, item.amountCents])).toEqual([
      ['Salário · 1ª quinzena', '2026-11-14', 96000],
      ['Salário · 2ª quinzena', '2026-11-28', 160000],
    ]);
    const early = getMonthAhead({ ...data([]), work: { ...work, receivedEarly: ['2026-11:1'] } }, TODAY);
    expect(early.receivableCents).toBe(160000);
  });
});
