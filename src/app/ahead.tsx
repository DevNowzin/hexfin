import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { type AheadItem, getMonthAhead } from '@/features/finance/ahead';
import { useFinance } from '@/features/finance/FinanceContext';
import { useAppTheme } from '@/theme/AppTheme';
import { relativeDayLabel, toDateInput } from '@/utils/format';

const KIND_ICON: Record<AheadItem['kind'], keyof typeof Ionicons.glyphMap> = {
  transaction: 'swap-vertical-outline',
  bill: 'receipt-outline',
  card: 'card-outline',
  salary: 'briefcase-outline',
};

/** Lista do "A receber" ou do "A pagar" do Início, com a ação de cada item. */
export default function AheadScreen() {
  const { side } = useLocalSearchParams<{ side?: string }>();
  const receivable = side === 'receivable';
  const finance = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const today = toDateInput();
  const ahead = getMonthAhead(finance, today);
  const items = receivable ? ahead.receivable : ahead.payable;
  const total = receivable ? ahead.receivableCents : ahead.payableCents;

  function tag(item: AheadItem): string {
    if (item.overdue) return 'Atrasada';
    if (item.kind === 'salary') return 'Previsto';
    if (item.kind === 'card') return 'Fatura do cartão';
    if (item.kind === 'bill') return 'Conta fixa';
    return 'Lançamento';
  }

  function action(item: AheadItem): { label: string; onPress: () => void } | null {
    const ref = item.ref;
    if (ref.type === 'bill') return { label: 'Já paguei', onPress: () => finance.setBillPaid(ref.billId, ref.monthKey, true) };
    if (ref.type === 'salary' && finance.work) {
      const work = finance.work;
      return { label: 'Recebi', onPress: () => finance.saveWork({ ...work, receivedEarly: [...work.receivedEarly, ref.paymentId] }) };
    }
    if (ref.type === 'card') return { label: 'Ver fatura', onPress: () => router.push('/transactions') };
    if (ref.type === 'transaction') return { label: 'Abrir', onPress: () => router.push(`/transaction/${ref.transactionId}`) };
    return null;
  }

  return (
    <Screen>
      <ScreenHeader title={receivable ? 'A receber' : 'A pagar'} subtitle={receivable ? 'Até o fim do mês' : 'Até o fim do mês e a próxima fatura'} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.totalCard}>
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.regular }]}>Total</Text>
          <AmountText cents={total} color={receivable ? colors.income : colors.expense} style={styles.total} />
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            {receivable ? 'Previsões não entram no saldo até o dinheiro cair.' : 'Nada aqui é dado como pago sem você confirmar.'}
          </Text>
        </Card>
        {items.length === 0 ? (
          <EmptyState icon={receivable ? 'arrow-down-circle-outline' : 'checkmark-done-outline'} title="Nada previsto" description={receivable ? 'Nenhum recebimento até o fim do mês.' : 'Nenhuma conta ou fatura a pagar.'} />
        ) : (
          items.map((item) => {
            const next = action(item);
            return (
              <Card key={item.id} style={styles.item}>
                <View style={[styles.icon, { backgroundColor: `${item.overdue ? colors.expense : colors.primary}22` }]}>
                  <Ionicons name={KIND_ICON[item.kind]} size={18} color={item.overdue ? colors.expense : colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.text, fontFamily: fonts.medium }]}>{item.description}</Text>
                  <Text style={[styles.meta, { color: item.overdue ? colors.expense : colors.textMuted, fontFamily: fonts.regular }]}>
                    {tag(item)} · {relativeDayLabel(item.date)}
                  </Text>
                </View>
                <View style={styles.right}>
                  <AmountText cents={item.amountCents} style={styles.amount} />
                  {next ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item.description}: ${next.label}`}
                      onPress={next.onPress}
                      hitSlop={6}
                      style={({ pressed }) => [styles.action, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text style={[styles.actionText, { color: colors.primary, fontFamily: fonts.semiBold }]}>{next.label}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 10 },
  totalCard: { gap: 4 },
  total: { fontSize: 30, letterSpacing: -1 },
  label: { fontSize: 12, lineHeight: 18 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 14 },
  meta: { fontSize: 11, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 14 },
  action: { minHeight: 36, minWidth: 44, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 11 },
});
