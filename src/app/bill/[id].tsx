import { useLocalSearchParams, useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { BillForm } from '@/features/finance/BillForm';
import { useFinance } from '@/features/finance/FinanceContext';
import { confirmAction } from '@/utils/confirm';

export default function EditBillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bills, deleteBill } = useFinance();
  const router = useRouter();
  const bill = bills.find((item) => item.id === id);

  if (!bill) {
    return (
      <Screen style={{ justifyContent: 'center' }}>
        <EmptyState icon="repeat-outline" title="Conta prevista não encontrada" description="Ela pode ter sido excluída deste dispositivo." />
      </Screen>
    );
  }

  return (
    <BillForm
      bill={bill}
      onDelete={() => confirmAction('Excluir conta prevista?', 'Ela sai de Recorrentes. Suas transações não mudam.', 'Excluir', () => {
        deleteBill(bill.id);
        router.back();
      })}
    />
  );
}
