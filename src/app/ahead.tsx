import { Ionicons } from '@expo/vector-icons';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Card } from '@/components/Card';
import { CategoryIcon } from '@/components/CategoryIcon';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { type AheadItem, getMonthAhead } from '@/features/finance/ahead';
import { getCategory } from '@/features/finance/categories';
import { useFinance } from '@/features/finance/FinanceContext';
import type { Category } from '@/features/finance/types';
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

  function category(item: AheadItem): Category | null {
    const ref = item.ref;
    if (ref.type === 'transaction') {
      const found = finance.transactions.find((transaction) => transaction.id === ref.transactionId);
      return found ? getCategory(found.categoryId) : null;
    }
    if (ref.type === 'bill') {
      const found = finance.bills.find((bill) => bill.id === ref.billId);
      return found ? getCategory(found.categoryId) : null;
    }
    return null;
  }

  /** Ação que grava algo (botão na linha). */
  function confirmAction(item: AheadItem): { label: string; onPress: () => void } | null {
    const ref = item.ref;
    if (ref.type === 'bill') return { label: 'Já paguei', onPress: () => finance.setBillPaid(ref.billId, ref.monthKey, true) };
    if (ref.type === 'salary' && finance.work) {
      const work = finance.work;
      return { label: 'Recebi', onPress: () => finance.saveWork({ ...work, receivedEarly: [...work.receivedEarly, ref.paymentId] }) };
    }
    return null;
  }

  /** Para onde a linha leva quando é só para ver (a linha inteira é o toque). */
  function openTarget(item: AheadItem): Href | null {
    const ref = item.ref;
    if (ref.type === 'card') return '/transactions';
    if (ref.type === 'transaction') return `/transaction/${ref.transactionId}`;
    return null;
  }

  function renderRow(item: AheadItem, index: number) {
    const confirm = confirmAction(item);
    const target = openTarget(item);
    const itemCategory = category(item);
    const bordered = index < items.length - 1;
    const tint = item.overdue ? colors.expense : colors.primary;
    const content = (
      <>
        {itemCategory && !item.overdue ? (
          <CategoryIcon category={itemCategory} size={40} />
        ) : (
          <View style={[styles.icon, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name={KIND_ICON[item.kind]} size={18} color={tint} />
          </View>
        )}
        <View style={styles.info}>
          <Text numberOfLines={1} style={[styles.name, { color: colors.text, fontFamily: fonts.medium }]}>{item.description}</Text>
          <Text numberOfLines={2} style={[styles.meta, { color: item.overdue ? colors.expense : colors.textMuted, fontFamily: fonts.regular }]}>
            {tag(item)} · {relativeDayLabel(item.date)}
          </Text>
        </View>
        <View style={styles.right}>
          <AmountText cents={item.amountCents} style={styles.amount} />
          {confirm ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.description}: ${confirm.label}`}
              onPress={confirm.onPress}
              hitSlop={6}
              style={({ pressed }) => [styles.action, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.actionText, { color: colors.primary, fontFamily: fonts.semiBold }]}>{confirm.label}</Text>
            </Pressable>
          ) : null}
        </View>
        {target ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
      </>
    );
    const rowStyle = [styles.row, { borderBottomColor: colors.border, borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0 }];
    if (!target) return <View key={item.id} style={rowStyle}>{content}</View>;
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${item.description}`}
        onPress={() => router.push(target)}
        style={({ pressed }) => [...rowStyle, { opacity: pressed ? 0.62 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={receivable ? 'A receber' : 'A pagar'} subtitle={receivable ? 'Até o fim do mês' : 'Até o fim do mês e a próxima fatura'} showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.totalCard}>
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.regular }]}>Total</Text>
          <AmountText cents={total} color={items.length === 0 ? colors.textMuted : receivable ? colors.income : colors.expense} style={styles.total} />
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            {receivable ? 'Previsões não entram no saldo até o dinheiro cair.' : 'Nada aqui é dado como pago sem você confirmar.'}
          </Text>
        </Card>
        <Card style={items.length === 0 ? undefined : styles.list}>
          {items.length === 0 ? (
            <EmptyState icon={receivable ? 'arrow-down-circle-outline' : 'checkmark-done-outline'} title="Nada previsto" description={receivable ? 'Nenhum recebimento até o fim do mês.' : 'Nenhuma conta ou fatura a pagar.'} />
          ) : (
            items.map(renderRow)
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 10 },
  totalCard: { gap: 4 },
  total: { fontSize: 30, letterSpacing: -1 },
  label: { fontSize: 12, lineHeight: 18 },
  list: { paddingTop: 4, paddingBottom: 4 },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14 },
  meta: { fontSize: 11, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 14 },
  action: { minHeight: 36, minWidth: 44, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 11 },
});
