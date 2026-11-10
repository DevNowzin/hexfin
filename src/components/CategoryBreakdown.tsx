import { StyleSheet, Text, View } from 'react-native';
import type { CategoryTotal } from '@/features/finance/types';
import { useAppTheme } from '@/theme/AppTheme';
import { AmountText } from './AmountText';
import { CategoryIcon } from './CategoryIcon';

interface CategoryBreakdownProps {
  items: CategoryTotal[];
  limit?: number;
  showCounts?: boolean;
}

export function CategoryBreakdown({ items, limit = 4, showCounts = false }: CategoryBreakdownProps) {
  const { colors, fonts } = useAppTheme();
  const visibleItems = items.slice(0, limit);

  if (visibleItems.length === 0) {
    return <Text style={[styles.empty, { color: colors.textMuted, fontFamily: fonts.regular }]}>Nenhuma despesa concluída neste mês.</Text>;
  }

  return (
    <View>
      <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
        {visibleItems.map((item, index) => (
          <View
            key={item.category.id}
            style={[
              styles.segment,
              {
                backgroundColor: item.category.color,
                flexGrow: Math.max(item.percentage, 3),
                borderTopLeftRadius: index === 0 ? 6 : 0,
                borderBottomLeftRadius: index === 0 ? 6 : 0,
                borderTopRightRadius: index === visibleItems.length - 1 ? 6 : 0,
                borderBottomRightRadius: index === visibleItems.length - 1 ? 6 : 0,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.list}>
        {visibleItems.map((item) => (
          <View key={item.category.id} style={styles.row}>
            <CategoryIcon category={item.category} size={38} />
            <View style={styles.content}>
              <Text style={[styles.name, { color: colors.text, fontFamily: fonts.medium }]}>{item.category.name}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                {Math.round(item.percentage)}% dos gastos{showCounts ? ` · ${item.transactionCount} transações` : ''}
              </Text>
            </View>
            <AmountText cents={item.totalCents} style={styles.value} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 12, borderRadius: 6, flexDirection: 'row', gap: 3, overflow: 'hidden', marginBottom: 20 },
  segment: { height: '100%' },
  list: { gap: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  content: { flex: 1 },
  name: { fontSize: 14 },
  subtitle: { fontSize: 11, marginTop: 3 },
  value: { fontSize: 13 },
  empty: { fontSize: 14, lineHeight: 21, textAlign: 'center', paddingVertical: 12 },
});
