import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CategoryIcon } from '@/components/CategoryIcon';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getCategory } from '@/features/finance/categories';
import { useFinance } from '@/features/finance/FinanceContext';
import { useAppTheme } from '@/theme/AppTheme';
import { confirmAction } from '@/utils/confirm';
import { formatLongDate, formatMonth, toDateInput } from '@/utils/format';

const recurrenceLabels = { weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' } as const;

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { transactions, accounts, deleteTransaction } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const transaction = transactions.find((item) => item.id === id);

  if (!transaction) {
    return (
      <Screen>
        <ScreenHeader title="Transação" showBack />
        <EmptyState icon="document-outline" title="Transação não encontrada" description="Ela pode ter sido excluída deste dispositivo." />
      </Screen>
    );
  }

  const category = getCategory(transaction.categoryId);
  const account = accounts.find((item) => item.id === transaction.accountId);
  const transferAccount = accounts.find((item) => item.id === transaction.transferAccountId);
  const signedAmount = transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents;
  const rows = [
    { icon: 'calendar-outline', label: 'Data', value: formatLongDate(transaction.date) },
    { icon: 'wallet-outline', label: 'Conta', value: account ? `${account.institution} · ${account.name}` : 'Conta removida' },
    ...(transferAccount
      ? [{ icon: 'swap-horizontal-outline', label: transaction.billPayment ? 'Fatura paga' : 'Destino do aporte', value: `${transferAccount.institution} · ${transferAccount.name}` }]
      : []),
    ...(transaction.billMonth ? [{ icon: 'card-outline', label: 'Fatura', value: formatMonth(transaction.billMonth) }] : []),
    { icon: 'checkmark-circle-outline', label: 'Situação', value: transaction.date > toDateInput() ? 'Futura' : transaction.status === 'completed' ? 'Concluída' : 'Pendente' },
    ...(transaction.externalId ? [{ icon: 'git-network-outline', label: 'Origem', value: 'Open Finance' }] : []),
    ...(transaction.recurrence ? [{ icon: 'refresh-outline', label: 'Recorrência', value: recurrenceLabels[transaction.recurrence] }] : []),
  ];

  function remove() {
    confirmAction('Excluir transação?', 'Esta ação não pode ser desfeita.', 'Excluir', () => {
      deleteTransaction(transaction!.id);
      router.dismissTo('/transactions');
    });
  }

  return (
    <Screen>
      <ScreenHeader title="Detalhes" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <CategoryIcon category={category} size={64} />
          <Text style={[styles.description, { color: colors.text, fontFamily: fonts.semiBold }]}>{transaction.description}</Text>
          <Text style={[styles.category, { color: colors.textMuted, fontFamily: fonts.regular }]}>{category.name}</Text>
          <AmountText
            cents={signedAmount}
            showSign
            color={transaction.type === 'income' ? colors.income : colors.text}
            style={styles.amount}
          />
          {transaction.status === 'pending' ? (
            <View style={[styles.pendingBadge, { backgroundColor: `${colors.warning}18` }]}>
              <Ionicons name="time-outline" size={14} color={colors.warning} />
              <Text style={[styles.pendingText, { color: colors.warning, fontFamily: fonts.medium }]}>Pagamento pendente</Text>
            </View>
          ) : null}
        </Card>

        <Card style={styles.detailsCard}>
          {rows.map((row, index) => (
            <View key={row.label} style={[styles.detailRow, { borderBottomColor: colors.border, borderBottomWidth: index < rows.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
              <Ionicons name={row.icon as never} size={19} color={colors.textMuted} />
              <Text style={[styles.detailLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>{row.label}</Text>
              <Text style={[styles.detailValue, { color: colors.text, fontFamily: fonts.medium }]}>{row.value}</Text>
            </View>
          ))}
        </Card>

        {transaction.notes ? (
          <Card style={styles.notesCard}>
            <Text style={[styles.notesLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>OBSERVAÇÕES</Text>
            <Text style={[styles.notes, { color: colors.text, fontFamily: fonts.regular }]}>{transaction.notes}</Text>
          </Card>
        ) : null}

        <Button label={transaction.externalId ? 'Mudar categoria ou notas' : 'Editar transação'} icon="create-outline" onPress={() => router.push(`/transaction/${transaction.id}/edit`)} style={styles.editButton} />
        {transaction.externalId ? (
          <Text style={[styles.importedHint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            Veio do banco: se ela sumir de lá, some daqui na próxima sincronização.
          </Text>
        ) : (
          <Button label="Excluir transação" icon="trash-outline" variant="ghost" onPress={remove} style={styles.deleteButton} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: { alignItems: 'center', paddingVertical: 28 },
  description: { fontSize: 20, textAlign: 'center', marginTop: 18 },
  category: { fontSize: 13, marginTop: 5 },
  amount: { fontSize: 32, letterSpacing: -1, marginTop: 18 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginTop: 14 },
  pendingText: { fontSize: 11 },
  importedHint: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14 },
  detailsCard: { marginTop: 14, paddingTop: 6, paddingBottom: 6 },
  detailRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  detailLabel: { fontSize: 12, flex: 1 },
  detailValue: { fontSize: 12, maxWidth: '58%', textAlign: 'right', lineHeight: 18 },
  notesCard: { marginTop: 14 },
  notesLabel: { fontSize: 10, letterSpacing: 0.7 },
  notes: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  editButton: { marginTop: 20 },
  deleteButton: { marginTop: 10 },
});
