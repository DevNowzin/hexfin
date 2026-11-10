import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { mergeOpenFinance } from '@/features/openfinance/merge';
import type { ImportReport, OpenFinanceSnapshot } from '@/features/openfinance/types';
import { createId } from '@/utils/id';
import { createEmptyData, removeDemoData } from './defaults';
import { loadFinanceData, saveFinanceData } from './storage';
import type {
  Account,
  AccountDraft,
  FinanceData,
  PlannedBill,
  PlannedBillDraft,
  Profile,
  Transaction,
  TransactionDraft,
} from './types';

interface FinanceContextValue extends FinanceData {
  hydrated: boolean;
  addTransaction: (draft: TransactionDraft) => Transaction;
  updateTransaction: (id: string, draft: TransactionDraft) => void;
  deleteTransaction: (id: string) => void;
  addAccount: (draft: AccountDraft) => Account;
  updateAccount: (id: string, draft: AccountDraft) => void;
  deleteAccount: (id: string) => void;
  /** Contas fixas e empréstimos cadastrados à mão (sempre uma lista, mesmo nos dados antigos). */
  bills: PlannedBill[];
  addBill: (draft: PlannedBillDraft) => PlannedBill;
  updateBill: (id: string, draft: PlannedBillDraft) => void;
  deleteBill: (id: string) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  toggleBalances: () => void;
  clearData: () => void;
  /** Aplica um retrato do Open Finance (regras em `mergeOpenFinance`) e devolve o resumo. */
  importOpenFinance: (snapshot: OpenFinanceSnapshot) => ImportReport;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<FinanceData>(() => createEmptyData());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    loadFinanceData()
      .then((stored) => {
        if (active && stored) setData(removeDemoData(stored));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveFinanceData(data).catch(() => undefined);
  }, [data, hydrated]);

  const addTransaction = useCallback((draft: TransactionDraft) => {
    const transaction: Transaction = {
      ...draft,
      id: createId('tx'),
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({ ...current, transactions: [transaction, ...current.transactions] }));
    return transaction;
  }, []);

  const updateTransaction = useCallback((id: string, draft: TransactionDraft) => {
    setData((current) => ({
      ...current,
      transactions: current.transactions.map((transaction) =>
        transaction.id === id ? { ...transaction, ...draft, id } : transaction,
      ),
    }));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      transactions: current.transactions.filter((transaction) => transaction.id !== id),
    }));
  }, []);

  const addAccount = useCallback((draft: AccountDraft) => {
    const account: Account = { ...draft, id: createId('account') };
    setData((current) => ({ ...current, accounts: [...current.accounts, account] }));
    return account;
  }, []);

  const updateAccount = useCallback((id: string, draft: AccountDraft) => {
    setData((current) => ({
      ...current,
      // Mantém o vínculo com o banco (externalId) ao editar nome ou cor.
      accounts: current.accounts.map((account) => (account.id === id ? { ...account, ...draft, id } : account)),
    }));
  }, []);

  const deleteAccount = useCallback((id: string) => {
    setData((current) => {
      if (current.transactions.some((transaction) => transaction.accountId === id)) return current;
      return { ...current, accounts: current.accounts.filter((account) => account.id !== id) };
    });
  }, []);

  const addBill = useCallback((draft: PlannedBillDraft) => {
    const bill: PlannedBill = { ...draft, id: createId('bill'), createdAt: new Date().toISOString() };
    setData((current) => ({ ...current, bills: [...(current.bills ?? []), bill] }));
    return bill;
  }, []);

  const updateBill = useCallback((id: string, draft: PlannedBillDraft) => {
    setData((current) => ({
      ...current,
      bills: (current.bills ?? []).map((bill) => (bill.id === id ? { ...draft, id, createdAt: bill.createdAt } : bill)),
    }));
  }, []);

  const deleteBill = useCallback((id: string) => {
    setData((current) => ({ ...current, bills: (current.bills ?? []).filter((bill) => bill.id !== id) }));
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setData((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  }, []);

  const toggleBalances = useCallback(() => {
    setData((current) => ({
      ...current,
      profile: { ...current.profile, hideBalances: !current.profile.hideBalances },
    }));
  }, []);

  const clearData = useCallback(() => {
    setData((current) => ({ ...current, accounts: [], transactions: [], bills: [] }));
  }, []);

  const importOpenFinance = useCallback(
    (snapshot: OpenFinanceSnapshot) => {
      const result = mergeOpenFinance(data, snapshot, new Date().toISOString(), createId);
      setData(result.data);
      return result.report;
    },
    [data],
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...data,
      bills: data.bills ?? [],
      hydrated,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addAccount,
      updateAccount,
      deleteAccount,
      addBill,
      updateBill,
      deleteBill,
      updateProfile,
      toggleBalances,
      clearData,
      importOpenFinance,
    }),
    [
      data,
      hydrated,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addAccount,
      updateAccount,
      deleteAccount,
      addBill,
      updateBill,
      deleteBill,
      updateProfile,
      toggleBalances,
      clearData,
      importOpenFinance,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error('useFinance deve ser usado dentro de FinanceProvider');
  return context;
}
