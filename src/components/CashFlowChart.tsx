import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CashFlowPoint } from '@/features/finance/types';
import { useFinance } from '@/features/finance/FinanceContext';
import { useAppTheme } from '@/theme/AppTheme';
import { formatCompactCurrency, formatMonth } from '@/utils/format';

interface CashFlowChartProps {
  points: CashFlowPoint[];
}

export function CashFlowChart({ points }: CashFlowChartProps) {
  const { profile } = useFinance();
  const { colors, fonts } = useAppTheme();
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, points.length - 1));
  const selected = points[selectedIndex] ?? points[points.length - 1];
  const maximum = Math.max(1, ...points.flatMap((point) => [point.incomeCents, point.expenseCents]));

  return (
    <View>
      {selected ? (
        <View style={styles.summary}>
          <Text style={[styles.month, { color: colors.textMuted, fontFamily: fonts.medium }]}>{formatMonth(selected.monthKey)}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Receitas</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontFamily: fonts.semiBold }]}>{profile.hideBalances ? 'R$ ••••••' : formatCompactCurrency(selected.incomeCents)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
              <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Despesas</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontFamily: fonts.semiBold }]}>{profile.hideBalances ? 'R$ ••••••' : formatCompactCurrency(selected.expenseCents)}</Text>
            </View>
          </View>
        </View>
      ) : null}
      <View style={[styles.chart, { borderBottomColor: colors.border }]}>
        {points.map((point, index) => {
          const incomeHeight = point.incomeCents > 0 ? Math.max(5, (point.incomeCents / maximum) * 132) : 2;
          const expenseHeight = point.expenseCents > 0 ? Math.max(5, (point.expenseCents / maximum) * 132) : 2;
          const selectedPoint = index === selectedIndex;
          return (
            <Pressable
              key={point.monthKey}
              accessibilityRole="button"
              accessibilityLabel={`Ver fluxo de ${formatMonth(point.monthKey)}`}
              onPress={() => setSelectedIndex(index)}
              style={styles.column}
            >
              <View style={styles.bars}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: incomeHeight,
                      backgroundColor: colors.primary,
                      opacity: selectedPoint ? 1 : 0.48,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.bar,
                    {
                      height: expenseHeight,
                      backgroundColor: colors.textMuted,
                      opacity: selectedPoint ? 0.95 : 0.3,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: selectedPoint ? colors.text : colors.textMuted,
                    fontFamily: selectedPoint ? fonts.semiBold : fonts.regular,
                  },
                ]}
              >
                {point.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: 20 },
  month: { fontSize: 13, marginBottom: 10, textTransform: 'capitalize' },
  summaryRow: { flexDirection: 'row', gap: 24 },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 12 },
  chart: { height: 174, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end' },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bars: { height: 140, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  bar: { width: 9, borderRadius: 5 },
  label: { fontSize: 11, marginTop: 10, marginBottom: 10, textTransform: 'capitalize' },
});
