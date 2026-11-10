import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { MoneyScope } from '@/features/finance/scope';
import { useAppTheme } from '@/theme/AppTheme';

const OPTIONS: Array<{ id: MoneyScope; icon: 'wallet-outline' | 'card-outline'; label: string }> = [
  { id: 'account', icon: 'wallet-outline', label: 'Conta' },
  { id: 'card', icon: 'card-outline', label: 'Cartão' },
];

interface ScopeToggleProps {
  value: MoneyScope;
  onChange: (scope: MoneyScope) => void;
}

/** Chave liga/desliga Conta | Cartão: a bolinha fica no lado ativo. */
export function ScopeToggle({ value, onChange }: ScopeToggleProps) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="radio"
            accessibilityLabel={`Mostrar ${option.label.toLocaleLowerCase('pt-BR')}`}
            accessibilityState={{ selected: active, checked: active }}
            hitSlop={4}
            onPress={() => onChange(option.id)}
            style={[styles.thumb, { backgroundColor: active ? colors.primary : 'transparent' }]}
          >
            <Ionicons name={option.icon} size={18} color={active ? colors.primaryText : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 3, marginRight: 8 },
  thumb: { width: 40, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
