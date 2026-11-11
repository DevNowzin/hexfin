import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { MonthSelector } from '@/components/MonthSelector';
import { ScopeToggle } from '@/components/ScopeToggle';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TransactionItem } from '@/components/TransactionItem';
import { useFinance } from '@/features/finance/FinanceContext';
import {
  type ActivityFilter,
  filterActivities,
  getCurrentMonthKey,
  getDayOutflowCents,
  groupTransactionsByDate,
} from '@/features/finance/selectors';
import { getAccountStatement, getCardBill, hasCardAccounts, type MoneyScope } from '@/features/finance/scope';
import { billStatusFor } from '@/features/openfinance/normalize';
import { useAppTheme } from '@/theme/AppTheme';
import { formatMonth, parseLocalDate, relativeDayLabel, toDateInput } from '@/utils/format';

function shortDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const filters: Array<{ id: ActivityFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'income', label: 'Entradas' },
  { id: 'expense', label: 'Saídas' },
  { id: 'pending', label: 'Pendentes' },
];

export default function TransactionsScreen() {
  const { transactions, accounts } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [chosenScope, setScope] = useState<MoneyScope>('account');
  // Sem cartão conectado não há o que separar: a chave some e tudo é Conta.
  const hasCards = hasCardAccounts(accounts);
  const scope: MoneyScope = hasCards ? chosenScope : 'account';

  const filtered = useMemo(
    () => filterActivities(transactions, { monthKey, filter, query, scope, accounts }),
    [transactions, monthKey, filter, query, scope, accounts],
  );
  const groups = groupTransactionsByDate(filtered);
  // O resumo é sempre do mês inteiro do lado escolhido: filtros e busca só mudam a lista.
  const summary = getAccountStatement(transactions, accounts, monthKey);
  const bill = getCardBill(transactions, accounts, monthKey);
  const hasAny = transactions.length > 0;
  const monthName = formatMonth(monthKey, false).toLocaleLowerCase('pt-BR');
  // Com um só cartão com ciclo informado, diz se a fatura do mês já fechou (a pagar) ou ainda está aberta.
  const cycles = accounts.flatMap((account) => (account.type === 'credit' && account.billCycle ? [account.billCycle] : []));
  const billStatus = cycles.length === 1 ? billStatusFor(monthKey, cycles[0]!, toDateInput()) : null;
  const cardWithoutCycle = accounts.find((account) => account.type === 'credit' && !account.billCycle);

  return (
    <Screen>
      <ScreenHeader
        title="Atividades"
        subtitle={scope === 'card' ? 'Fatura do cartão' : hasCards ? 'Extrato da conta' : 'Tudo o que entrou e saiu'}
        right={
          <>
            {hasCards ? <ScopeToggle value={scope} onChange={setScope} /> : null}
            <IconButton icon="add" label="Nova transação" onPress={() => router.push('/transaction/new')} filled />
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} />
          <TextInput
            accessibilityLabel="Buscar transações"
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por estabelecimento"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            style={[styles.searchInput, { color: colors.text, fontFamily: fonts.regular }]}
            returnKeyType="search"
          />
          {query ? (
            <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={19} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filters}>
          {filters.map((item) => {
            const active = item.id === filter;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar: ${item.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(item.id)}
                style={[
                  styles.filter,
                  {
                    backgroundColor: active ? colors.text : colors.surface,
                    borderColor: active ? colors.text : colors.border,
                  },
                ]}
              >
                <Text numberOfLines={1} style={[styles.filterText, { color: active ? colors.background : colors.textMuted, fontFamily: fonts.medium }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* No cartão dá para ver a fatura aberta e as próximas (parcelas), que vencem em meses futuros. */}
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} allowFuture={scope === 'card'} />

        {hasAny && scope === 'card' ? (
          <Card style={styles.billCard}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Fatura de {monthName}</Text>
            <AmountText cents={bill.totalCents} style={styles.billTotal} />
            {billStatus ? (
              <Text style={[styles.billMeta, { color: colors.text, fontFamily: fonts.medium }]}>
                {billStatus.closed
                  ? `Fechada em ${shortDate(billStatus.closeDate)} · vence ${shortDate(billStatus.dueDate)}`
                  : `Aberta · fecha ${shortDate(billStatus.closeDate)} · vence ${shortDate(billStatus.dueDate)}`}
              </Text>
            ) : null}
            {cardWithoutCycle ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Informar o vencimento de ${cardWithoutCycle.name}`}
                onPress={() => router.push(`/accounts/${cardWithoutCycle.id}/edit`)}
                style={({ pressed }) => [styles.cycleHint, { borderColor: colors.warning, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.billMeta, { color: colors.warning, fontFamily: fonts.medium }]}>
                  {cardWithoutCycle.name}: o banco não informou o fechamento. Toque para informar o vencimento e a fatura ficar certa.
                </Text>
              </Pressable>
            ) : null}
            <Text style={[styles.billMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              {bill.count} {bill.count === 1 ? 'lançamento' : 'lançamentos'}
              {bill.creditsCents > 0 ? ' · estornos já descontados' : ''}
            </Text>
            {bill.upcomingCents > 0 ? (
              <Text style={[styles.billMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                Inclui <AmountText cents={bill.upcomingCents} style={styles.billMetaAmount} /> de parcelas que ainda vão entrar
              </Text>
            ) : null}
          </Card>
        ) : null}

        {hasAny && scope === 'account' ? (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Receitas</Text>
            <AmountText cents={summary.incomeCents} color={colors.income} style={styles.summaryValue} />
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>{hasCards ? 'Saídas' : 'Despesas'}</Text>
            <AmountText cents={summary.expenseCents} style={styles.summaryValue} />
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Resultado</Text>
            <AmountText cents={summary.balanceCents} showSign color={summary.balanceCents >= 0 ? colors.income : colors.expense} style={styles.summaryValue} />
          </View>
        </Card>
        ) : null}

        {hasAny ? (
          <View style={styles.resultHeader}>
            <Text style={[styles.resultCount, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              {filtered.length} {filtered.length === 1 ? 'atividade' : 'atividades'}
            </Text>
          </View>
        ) : null}

        {groups.length === 0 ? (
          <Card style={hasAny ? undefined : styles.firstEmpty}>
            <EmptyState
              icon={hasAny ? 'search-outline' : 'swap-vertical-outline'}
              title={hasAny ? 'Nada por aqui' : 'Nenhuma atividade ainda'}
              description={
                !hasAny
                  ? 'Conecte o Open Finance pelo Início ou toque em + no topo para registrar à mão.'
                  : query
                    ? 'Tente outro termo ou outro filtro.'
                    : scope === 'card'
                      ? 'Nenhuma compra nesta fatura com esse filtro.'
                      : 'Nenhuma atividade neste mês com esse filtro.'
              }
            />
          </Card>
        ) : (
          groups.map(([date, items]) => (
            <View key={date} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text numberOfLines={1} style={[styles.groupTitle, { color: colors.textMuted, fontFamily: fonts.medium }]}>{relativeDayLabel(date)}</Text>
                {getDayOutflowCents(items) > 0 ? (
                  <AmountText cents={-getDayOutflowCents(items)} showSign color={colors.textMuted} style={styles.groupTotal} />
                ) : null}
              </View>
              <Card style={styles.groupCard}>
                {items.map((transaction, index) => (
                  <TransactionItem key={transaction.id} transaction={transaction} bordered={index < items.length - 1} />
                ))}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  search: { minHeight: 52, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 14, outlineStyle: 'none' } as never,
  filters: { flexDirection: 'row', gap: 6, marginVertical: 14 },
  filter: { flex: 1, minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  filterText: { fontSize: 13 },
  summaryCard: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 17, marginTop: 14 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, marginBottom: 6 },
  summaryValue: { fontSize: 12 },
  billCard: { marginTop: 14 },
  billTotal: { fontSize: 26, marginTop: 4, letterSpacing: -0.6 },
  billMeta: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  cycleHint: { marginTop: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingBottom: 8 },
  billMetaAmount: { fontSize: 12 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  resultHeader: { marginTop: 24, marginBottom: 6 },
  firstEmpty: { marginTop: 14 },
  resultCount: { fontSize: 12 },
  group: { marginTop: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9, marginHorizontal: 2 },
  groupTitle: { fontSize: 12, flexShrink: 1 },
  groupTotal: { fontSize: 12 },
  groupCard: { paddingTop: 6, paddingBottom: 6 },
});
