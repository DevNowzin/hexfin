import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFinance } from '@/features/finance/FinanceContext';
import { getCategory } from '@/features/finance/categories';
import type { Transaction } from '@/features/finance/types';
import { useAppTheme } from '@/theme/AppTheme';
import { formatTransactionDate, toDateInput } from '@/utils/format';
import { AmountText } from './AmountText';
import { CategoryIcon } from './CategoryIcon';

interface TransactionItemProps {
  transaction: Transaction;
  showDate?: boolean;
  bordered?: boolean;
  /** Esconde a etiqueta Futura/Pendente (ex.: numa lista que já é só de futuros). */
  hideTag?: boolean;
}

export function TransactionItem({ transaction, showDate = false, bordered = false, hideTag = false }: TransactionItemProps) {
  const { accounts } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const category = getCategory(transaction.categoryId);
  const account = accounts.find((item) => item.id === transaction.accountId);
  const signedAmount = transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents;
  // Data futura (agendado, parcela) ainda não aconteceu, mesmo que esteja como concluída.
  const tag = hideTag ? null : transaction.date > toDateInput() ? 'Futura' : transaction.status === 'pending' ? 'Pendente' : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir transação ${transaction.description}`}
      onPress={() => router.push(`/transaction/${transaction.id}`)}
      style={({ pressed }) => [
        styles.container,
        { borderBottomColor: colors.border, borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0 },
        { opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <CategoryIcon category={category} />
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.description, { color: colors.text, fontFamily: fonts.medium }]}>
            {transaction.description}
          </Text>
          {tag ? (
            <View style={[styles.pending, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.pendingText, { color: colors.warning, fontFamily: fonts.medium }]}>{tag}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          {showDate ? `${formatTransactionDate(transaction.date)} · ` : ''}{category.name}{account ? ` · ${account.institution}` : ''}
        </Text>
      </View>
      <AmountText
        cents={signedAmount}
        showSign
        color={transaction.type === 'income' ? colors.income : colors.text}
        style={styles.amount}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  content: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  description: { fontSize: 15, flexShrink: 1 },
  subtitle: { fontSize: 12, marginTop: 5 },
  amount: { fontSize: 14, marginLeft: 4 },
  pending: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  pendingText: { fontSize: 8, textTransform: 'uppercase' },
});
