import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { AccountForm } from '@/features/finance/AccountForm';
import { useFinance } from '@/features/finance/FinanceContext';
import { confirmAction } from '@/utils/confirm';

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, transactions, deleteAccount } = useFinance();
  const router = useRouter();
  const account = accounts.find((item) => item.id === id);

  if (!account) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <EmptyState icon="wallet-outline" title="Conta não encontrada" description="Ela pode ter sido excluída deste dispositivo." />
      </Screen>
    );
  }

  const canDelete = !transactions.some((transaction) => transaction.accountId === account.id);
  return (
    <AccountForm
      account={account}
      canDelete={canDelete}
      onDelete={() => confirmAction('Excluir conta?', 'A conta será removida permanentemente deste dispositivo.', 'Excluir', () => {
        deleteAccount(account.id);
        router.dismissTo('/accounts');
      })}
    />
  );
}
