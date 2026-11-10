import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Card } from '@/components/Card';
import { CategoryIcon } from '@/components/CategoryIcon';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { ScopeToggle } from '@/components/ScopeToggle';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { TransactionItem } from '@/components/TransactionItem';
import { getCategory } from '@/features/finance/categories';
import { useFinance } from '@/features/finance/FinanceContext';
import { detectRecurring, getUpcoming, type RecurringExpense } from '@/features/finance/recurring';
import { filterByScope, hasCardAccounts, type MoneyScope } from '@/features/finance/scope';
import type { Recurrence } from '@/features/finance/types';
import { useAppTheme } from '@/theme/AppTheme';
import { formatTransactionDate, toDateInput } from '@/utils/format';

const CADENCE: Record<Recurrence, string> = { weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' };
const UPCOMING_LIMIT = 8;

function RecurringRow({ item, bordered }: { item: RecurringExpense; bordered: boolean }) {
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const planned = item.source === 'planned';
  const meta = planned
    ? item.remaining
      ? `Empréstimo · próxima ${formatTransactionDate(item.nextDate)} · ${item.remaining === 1 ? 'última parcela' : `faltam ${item.remaining}`}`
      : `Conta fixa · vence ${formatTransactionDate(item.nextDate)} · cadastrada por você`
    : `${CADENCE[item.cadence]} · próxima ${formatTransactionDate(item.nextDate)} · ${item.source === 'manual' ? 'marcada por você' : `detectada em ${item.occurrences} meses`}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={planned ? `Editar ${item.description}` : `Abrir a última cobrança de ${item.description}`}
      onPress={() => router.push(planned ? `/bill/${item.billId}` : `/transaction/${item.lastTransactionId}`)}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.62 : 1 },
      ]}
    >
      <CategoryIcon category={getCategory(item.categoryId)} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text, fontFamily: fonts.medium }]}>{item.description}</Text>
        <Text numberOfLines={2} style={[styles.rowMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          {meta}
        </Text>
      </View>
      <AmountText cents={item.typicalCents} style={styles.rowAmount} />
    </Pressable>
  );
}

export default function RecurringScreen() {
  const { transactions, accounts, bills } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const [chosenScope, setScope] = useState<MoneyScope>('account');
  const hasCards = hasCardAccounts(accounts);
  const scope: MoneyScope = hasCards ? chosenScope : 'account';
  const today = toDateInput();
  const items = filterByScope(detectRecurring(transactions, today, bills).items, accounts, scope);
  const monthlyTotalCents = items.reduce((total, item) => total + item.monthlyCents, 0);
  const upcoming = filterByScope(getUpcoming(transactions, today), accounts, scope).slice(0, UPCOMING_LIMIT);
  const count = items.length;
  const side = scope === 'card' ? 'no cartão' : hasCards ? 'na conta' : '';

  return (
    <Screen>
      <ScreenHeader
        title="Recorrentes"
        subtitle={scope === 'card' ? 'Assinaturas e parcelas do cartão' : 'Contas fixas, assinaturas e o que vem por aí'}
        right={
          <>
            {hasCards ? <ScopeToggle value={scope} onChange={setScope} /> : null}
            <IconButton icon="add" label="Adicionar conta fixa ou empréstimo" onPress={() => router.push('/bill/new')} filled />
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={[styles.overline, { color: colors.textMuted, fontFamily: fonts.medium }]}>POR MÊS{side ? ` ${side.toLocaleUpperCase('pt-BR')}` : ''}</Text>
          <AmountText cents={monthlyTotalCents} style={styles.total} />
          <Text style={[styles.caption, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            {count === 0 ? `Nenhum gasto recorrente ${side || 'encontrado'} ainda` : `${count} ${count === 1 ? 'gasto recorrente' : 'gastos recorrentes'}`}
          </Text>
        </Card>

        {upcoming.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Próximos" />
            <Card style={styles.listCard}>
              {upcoming.map((transaction, index) => (
                <TransactionItem key={transaction.id} transaction={transaction} showDate hideTag bordered={index < upcoming.length - 1} />
              ))}
            </Card>
            <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              {scope === 'card'
                ? 'Parcelas futuras entram na fatura do mês delas, não na de agora.'
                : 'Agendados só entram no saldo e nos gastos quando o dia chegar.'}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Gastos recorrentes" />
          {count > 0 ? (
            <Card style={styles.listCard}>
              {items.map((item, index) => (
                <RecurringRow key={item.key} item={item} bordered={index < count - 1} />
              ))}
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="repeat-outline"
                title="Nada recorrente por aqui"
                description="Aparecem quando a mesma despesa se repete em meses seguidos com valor parecido, quando você marca uma transação como mensal ou quando cadastra uma conta fixa ou um empréstimo no +."
              />
            </Card>
          )}
          {count > 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              Detectadas: mesma despesa com valor parecido (±15%) em meses seguidos. Contas que o banco não traz, cadastre no +; elas só preveem e não mexem no saldo.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  overline: { fontSize: 10, letterSpacing: 0.7 },
  total: { fontSize: 29, marginTop: 8, letterSpacing: -0.8 },
  caption: { fontSize: 12, marginTop: 6 },
  section: { marginTop: 28 },
  listCard: { paddingVertical: 4 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  rowAmount: { fontSize: 14 },
  hint: { fontSize: 11, lineHeight: 17, marginTop: 10, paddingHorizontal: 4 },
});
