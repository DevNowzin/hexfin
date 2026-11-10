import { describe, expect, it } from 'vitest';
import { createEmptyData, removeDemoData } from './defaults';
import { createSeedData } from './seed';
import type { Transaction } from './types';

const userTransaction: Transaction = {
  id: 'tx_lx1a2b_abc12345',
  description: 'Padaria',
  amountCents: 1250,
  type: 'expense',
  date: '2026-11-09',
  categoryId: 'food',
  accountId: 'account_nubank',
  status: 'completed',
  createdAt: '2026-11-09T12:00:00.000Z',
};

describe('createEmptyData', () => {
  it('começa sem contas, transações nem nome', () => {
    expect(createEmptyData()).toEqual({
      accounts: [],
      transactions: [],
      profile: { name: '', hideBalances: false, theme: 'system' },
    });
  });
});

describe('removeDemoData', () => {
  it('apaga todos os dados de demonstração intocados', () => {
    const cleaned = removeDemoData(createSeedData());
    expect(cleaned.accounts).toEqual([]);
    expect(cleaned.transactions).toEqual([]);
  });

  it('mantém o perfil do usuário', () => {
    const data = { ...createSeedData(), profile: { name: 'Ana', hideBalances: true, theme: 'dark' as const } };
    expect(removeDemoData(data).profile).toEqual(data.profile);
  });

  it('mantém transações do usuário e a conta de exemplo que elas usam', () => {
    const seed = createSeedData();
    const cleaned = removeDemoData({ ...seed, transactions: [...seed.transactions, userTransaction] });
    expect(cleaned.transactions).toEqual([userTransaction]);
    expect(cleaned.accounts.map((account) => account.id)).toEqual(['account_nubank']);
  });

  it('mantém conta de exemplo que o usuário editou', () => {
    const seed = createSeedData();
    const edited = { ...seed.accounts[1]!, openingBalanceCents: 777 };
    const cleaned = removeDemoData({ ...seed, accounts: [seed.accounts[0]!, edited] });
    expect(cleaned.accounts).toEqual([edited]);
  });

  it('não mexe em dados sem demonstração', () => {
    const data = { ...createEmptyData(), transactions: [{ ...userTransaction, accountId: 'account_minha' }] };
    expect(removeDemoData(data)).toBe(data);
  });
});
