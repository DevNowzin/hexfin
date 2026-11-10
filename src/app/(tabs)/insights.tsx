import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Card } from '@/components/Card';
import { CashFlowChart } from '@/components/CashFlowChart';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { EmptyState } from '@/components/EmptyState';
import { MonthSelector } from '@/components/MonthSelector';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { AiInsightsCard } from '@/features/ai/components/AiInsightsCard';
import { buildInsightsRequest } from '@/features/ai/insightsRequest';
import { ASSISTANTS, isAssistantEnabled } from '@/features/finance/assistants';
import { useFinance } from '@/features/finance/FinanceContext';
import {
  buildInsights,
  getCashFlow,
  getCurrentMonthKey,
  getMonthSummary,
  getSpendingByCategory,
  getTopEstablishments,
  shiftMonth,
} from '@/features/finance/selectors';
import { useAppTheme } from '@/theme/AppTheme';
import { formatMonth } from '@/utils/format';

export default function InsightsScreen() {
  const data = useFinance();
  const { colors, fonts } = useAppTheme();
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const summary = getMonthSummary(data.transactions, monthKey);
  const previous = getMonthSummary(data.transactions, shiftMonth(monthKey, -1));
  const categories = getSpendingByCategory(data.transactions, monthKey);
  const insightsById = new Map(buildInsights(data, monthKey).map((insight) => [insight.id, insight]));
  const enabledAssistants = ASSISTANTS.filter((assistant) => isAssistantEnabled(data.profile.disabledAssistants, assistant.id));
  const hasAny = data.transactions.length > 0;
  const establishments = getTopEstablishments(data.transactions, monthKey).slice(0, 5);
  const expenseVariation = previous.expenseCents > 0
    ? Math.round(((summary.expenseCents - previous.expenseCents) / previous.expenseCents) * 100)
    : 0;

  return (
    <Screen>
      <ScreenHeader title="Assistentes" subtitle="Regras que rodam só neste celular" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} />
        <AiInsightsCard request={buildInsightsRequest(data.transactions, monthKey)} />

        <View style={styles.assistantsSection}>
          <SectionHeader title="Seus assistentes" />
          <View style={styles.insightsList}>
            {enabledAssistants.map((assistant) => {
              const message = insightsById.get(assistant.id);
              const toneColor = message?.tone === 'positive' ? colors.income : message?.tone === 'warning' ? colors.expense : colors.text;
              return (
                <Card key={assistant.id} style={styles.insightCard}>
                  <View style={styles.assistantHeader}>
                    <View style={[styles.insightIcon, { backgroundColor: `${colors.primary}20` }]}>
                      <Ionicons name={assistant.icon as never} size={21} color={colors.primary} />
                    </View>
                    <View style={styles.insightContent}>
                      <Text style={[styles.insightTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{assistant.name}</Text>
                      <Text style={[styles.insightDescription, { color: colors.textMuted, fontFamily: fonts.regular }]}>{assistant.watches}</Text>
                    </View>
                  </View>
                  <View style={[styles.assistantMessage, { borderTopColor: colors.border }]}>
                    {message ? (
                      <>
                        <Text style={[styles.insightTitle, { color: toneColor, fontFamily: fonts.semiBold }]}>{message.title}</Text>
                        <Text style={[styles.insightDescription, { color: colors.textMuted, fontFamily: fonts.regular }]}>{message.description}</Text>
                      </>
                    ) : (
                      <Text style={[styles.insightDescription, { color: colors.textMuted, fontFamily: fonts.regular }]}>Sem novidades em {formatMonth(monthKey, false)}.</Text>
                    )}
                  </View>
                </Card>
              );
            })}
            {enabledAssistants.length === 0 ? (
              <Card style={styles.insightCard}>
                <Text style={[styles.insightDescription, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                  Todos os assistentes estão desligados. Ligue os que quiser em Perfil › Assistentes.
                </Text>
              </Card>
            ) : null}
          </View>
        </View>

        {hasAny ? (
          <>
            <Card style={styles.overviewCard}>
              <Text style={[styles.overline, { color: colors.textMuted, fontFamily: fonts.medium }]}>RESUMO DE {formatMonth(monthKey, false).toLocaleUpperCase('pt-BR')}</Text>
              <View style={styles.overviewRow}>
                <View>
                  <Text style={[styles.overviewLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Você gastou</Text>
                  <AmountText cents={summary.expenseCents} style={styles.overviewValue} />
                </View>
                <View style={[styles.variationBadge, { backgroundColor: expenseVariation <= 0 ? `${colors.primary}20` : `${colors.expense}18` }]}>
                  <Ionicons name={expenseVariation <= 0 ? 'trending-down' : 'trending-up'} size={16} color={expenseVariation <= 0 ? colors.income : colors.expense} />
                  <Text style={[styles.variationText, { color: expenseVariation <= 0 ? colors.income : colors.expense, fontFamily: fonts.semiBold }]}>
                    {Math.abs(expenseVariation)}%
                  </Text>
                </View>
              </View>
              <Text style={[styles.comparison, { color: colors.textMuted, fontFamily: fonts.regular }]}>em comparação ao mês anterior</Text>
              <View style={[styles.netResult, { borderTopColor: colors.border }]}>
                <Text style={[styles.netLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Resultado do mês</Text>
                <AmountText cents={summary.balanceCents} showSign color={summary.balanceCents >= 0 ? colors.income : colors.expense} style={styles.netValue} />
              </View>
            </Card>
        <View style={styles.section}>
          <SectionHeader title="Fluxo de caixa" actionLabel="Últimos 6 meses" />
          <Card><CashFlowChart points={getCashFlow(data.transactions)} /></Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Gastos por categoria" actionLabel={formatMonth(monthKey, false)} />
          <Card><CategoryBreakdown items={categories} limit={8} showCounts /></Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Maiores gastos" actionLabel={formatMonth(monthKey, false)} />
          <Card style={styles.establishmentsCard}>
            {establishments.length > 0 ? establishments.map((item, index) => (
              <View key={item.description} style={[styles.establishmentRow, { borderBottomColor: colors.border, borderBottomWidth: index < establishments.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
                <View style={[styles.rank, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.rankText, { color: colors.textMuted, fontFamily: fonts.semiBold }]}>{index + 1}</Text>
                </View>
                <View style={styles.establishmentContent}>
                  <Text numberOfLines={1} style={[styles.establishmentName, { color: colors.text, fontFamily: fonts.medium }]}>{item.description}</Text>
                  <Text style={[styles.establishmentMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>{item.category.name} · {item.count} {item.count === 1 ? 'vez' : 'vezes'}</Text>
                </View>
                <AmountText cents={item.totalCents} style={styles.establishmentAmount} />
              </View>
            )) : <Text style={[styles.empty, { color: colors.textMuted, fontFamily: fonts.regular }]}>Sem despesas concluídas neste período.</Text>}
          </Card>
        </View>

          </>
        ) : (
          <Card style={styles.emptyAnalyses}>
            <EmptyState
              icon="analytics-outline"
              title="Análises aparecem com o uso"
              description="Registre entradas e saídas para ver o resumo do mês, o fluxo de caixa e as categorias."
            />
          </Card>
        )}

        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.privacyText, { color: colors.textMuted, fontFamily: fonts.regular }]}>Os assistentes rodam neste celular, sem enviar seus dados.</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  overviewCard: { marginTop: 28 },
  assistantsSection: { marginTop: 14 },
  assistantHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  assistantMessage: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 12 },
  emptyAnalyses: { marginTop: 28 },
  overline: { fontSize: 10, letterSpacing: 0.7 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  overviewLabel: { fontSize: 13 },
  overviewValue: { fontSize: 29, marginTop: 5, letterSpacing: -0.8 },
  variationBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  variationText: { fontSize: 12 },
  comparison: { fontSize: 11, marginTop: 6 },
  netResult: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  netLabel: { fontSize: 13 },
  netValue: { fontSize: 16 },
  section: { marginTop: 28 },
  insightsList: { gap: 10 },
  insightCard: { padding: 16 },
  insightIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 14 },
  insightDescription: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  establishmentsCard: { paddingTop: 8, paddingBottom: 8 },
  establishmentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  rank: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12 },
  establishmentContent: { flex: 1 },
  establishmentName: { fontSize: 14 },
  establishmentMeta: { fontSize: 11, marginTop: 4 },
  establishmentAmount: { fontSize: 13 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 },
  privacyText: { fontSize: 11 },
});
