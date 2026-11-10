import { describe, expect, it } from 'vitest';
import { filterByScope, getAccountStatement, getCardBill, hasCardAccounts, scopeOf } from './scope';
import { filterActivities } from './selectors';
import type { Account, Transaction } from './types';

const TODAY = '2026-11-10';

function account(id: string, type: Account['type']): Account {
  return { id, name: id, institution: id, type, color: '#000', openingBalanceCents: 0 };
}

const accounts = [account('bank', 'checking'), account('card', 'credit')];

let next = 0;
function tx(accountId: string, date: string, amountCents: number, patch: Partial<Transaction> = {}): Transaction {
  next += 1;
  return {
    id: `t${next}`,
    description: `Item ${next}`,
    amountCents,
    type: 'expense',
    date,
    categoryId: 'other',
    accountId,
    status: 'completed',
    createdAt: `${date}T12:00:00.000Z`,
    ...patch,
  };
}

describe('scopeOf e filterByScope', () => {
  it('cartão é a conta do tipo credit; o resto, e conta sumida, é Conta', () => {
    expect(scopeOf('card', accounts)).toBe('card');
    expect(scopeOf('bank', accounts)).toBe('account');
    expect(scopeOf('removida', accounts)).toBe('account');
    expect(scopeOf(undefined, accounts)).toBe('account');
    expect(hasCardAccounts(accounts)).toBe(true);
    expect(hasCardAccounts([account('bank', 'checking')])).toBe(false);
  });

  it('separa itens pelo lado', () => {
    const items = [{ accountId: 'bank' }, { accountId: 'card' }, {}];
    expect(filterByScope(items, accounts, 'card')).toEqual([{ accountId: 'card' }]);
    expect(filterByScope(items, accounts, 'account')).toHaveLength(2);
  });
});

describe('getAccountStatement', () => {
  it('bate com o extrato: pagamento da fatura sai, compras do cartão ficam de fora', () => {
    const summary = getAccountStatement(
      [
        tx('bank', '2026-11-05', 500000, { type: 'income' }),
        tx('bank', '2026-11-06', 12000),
        tx('bank', '2026-11-08', 80000, { billPayment: true, transferAccountId: 'card' }),
        tx('card', '2026-11-07', 9990, { billMonth: '2026-11' }),
        tx('bank', '2026-11-25', 150000),
      ],
      accounts,
      '2026-11',
      TODAY,
    );
    expect(summary).toEqual({ incomeCents: 500000, expenseCents: 92000, balanceCents: 408000, pendingCents: 150000 });
  });
});

describe('getCardBill', () => {
  it('soma a fatura do mês pelo billMonth, desconta estornos e separa o que ainda vai entrar', () => {
    const bill = getCardBill(
      [
        tx('card', '2026-10-28', 10000, { billMonth: '2026-11' }),
        tx('card', '2026-11-12', 5000, { billMonth: '2026-11' }),
        tx('card', '2026-11-03', 2000, { type: 'income', billMonth: '2026-11' }),
        tx('card', '2026-11-08', 7000, { billMonth: '2026-12' }),
        tx('bank', '2026-11-08', 80000, { billPayment: true, transferAccountId: 'card' }),
      ],
      accounts,
      '2026-11',
      TODAY,
    );
    expect(bill).toEqual({ totalCents: 13000, purchasesCents: 15000, creditsCents: 2000, upcomingCents: 5000, count: 3 });
  });
});

describe('filterActivities com lado', () => {
  it('mostra só a conta ou só o cartão', () => {
    const list = [
      tx('bank', '2026-11-06', 12000),
      tx('bank', '2026-11-08', 80000, { billPayment: true, transferAccountId: 'card' }),
      tx('card', '2026-10-30', 9990, { billMonth: '2026-11' }),
    ];
    const base = { monthKey: '2026-11', filter: 'all' as const, today: TODAY, accounts };
    expect(filterActivities(list, { ...base, scope: 'account' }).map((item) => item.accountId)).toEqual(['bank', 'bank']);
    expect(filterActivities(list, { ...base, scope: 'card' }).map((item) => item.amountCents)).toEqual([9990]);
    expect(filterActivities(list, base)).toHaveLength(3);
  });
});
