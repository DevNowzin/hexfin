import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentMonthKey, shiftMonth } from '@/features/finance/selectors';
import { useAppTheme } from '@/theme/AppTheme';
import { formatMonth } from '@/utils/format';

interface MonthSelectorProps {
  monthKey: string;
  onChange: (monthKey: string) => void;
  allowFuture?: boolean;
}

export function MonthSelector({ monthKey, onChange, allowFuture = false }: MonthSelectorProps) {
  const { colors, fonts } = useAppTheme();
  const atCurrentMonth = monthKey >= getCurrentMonthKey();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" hitSlop={8} onPress={() => onChange(shiftMonth(monthKey, -1))} style={styles.button}>
        <Ionicons name="chevron-back" size={19} color={colors.text} />
      </Pressable>
      <Text style={[styles.label, { color: colors.text, fontFamily: fonts.semiBold }]}>{formatMonth(monthKey)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        disabled={!allowFuture && atCurrentMonth}
        hitSlop={8}
        onPress={() => onChange(shiftMonth(monthKey, 1))}
        style={[styles.button, { opacity: !allowFuture && atCurrentMonth ? 0.25 : 1 }]}
      >
        <Ionicons name="chevron-forward" size={19} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, flex: 1, textAlign: 'center' },
});
