import { useLocalSearchParams } from 'expo-router';
import { TransactionForm } from '@/features/finance/TransactionForm';
import type { TransactionType } from '@/features/finance/types';

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ type?: TransactionType }>();
  return <TransactionForm defaultType={params.type === 'income' ? 'income' : 'expense'} />;
}
