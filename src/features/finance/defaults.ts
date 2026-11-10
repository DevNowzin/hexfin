// Estado inicial real (vazio) e limpeza dos antigos dados de demonstração.
// O app nunca mostra valores inventados: tudo o que aparece foi cadastrado pelo usuário.
import { createSeedData } from './seed';
import type { Account, FinanceData } from './types';

export function createEmptyData(): FinanceData {
  return {
    accounts: [],
    transactions: [],
    profile: { name: '', hideBalances: false, theme: 'system' },
  };
}

function isUntouchedDemoAccount(account: Account, demo: Account): boolean {
  return (
    account.name === demo.name &&
    account.institution === demo.institution &&
    account.type === demo.type &&
    account.openingBalanceCents === demo.openingBalanceCents
  );
}

/**
 * Versões antigas começavam com dados de demonstração. Remove as transações de
 * exemplo (ids fixos) e as contas de exemplo que o usuário não alterou e que não
 * têm mais nenhuma transação. Registros criados pelo usuário nunca são tocados.
 */
export function removeDemoData(data: FinanceData): FinanceData {
  const demo = createSeedData();
  const demoTransactionIds = new Set(demo.transactions.map((transaction) => transaction.id));
  const transactions = data.transactions.filter((transaction) => !demoTransactionIds.has(transaction.id));
  const usedAccountIds = new Set(
    transactions.flatMap((transaction) => [transaction.accountId, transaction.transferAccountId].filter(Boolean) as string[]),
  );
  const accounts = data.accounts.filter((account) => {
    const demoAccount = demo.accounts.find((candidate) => candidate.id === account.id);
    if (!demoAccount || usedAccountIds.has(account.id)) return true;
    return !isUntouchedDemoAccount(account, demoAccount);
  });
  if (accounts.length === data.accounts.length && transactions.length === data.transactions.length) return data;
  return { ...data, accounts, transactions };
}
