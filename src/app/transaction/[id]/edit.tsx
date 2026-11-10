import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { useFinance } from '@/features/finance/FinanceContext';
import { TransactionForm } from '@/features/finance/TransactionForm';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions } = useFinance();
  const transaction = transactions.find((item) => item.id === id);

  if (!transaction) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <EmptyState icon="document-outline" title="Transação não encontrada" description="Ela pode ter sido excluída deste dispositivo." />
      </Screen>
    );
  }
  return <TransactionForm transaction={transaction} />;
}
