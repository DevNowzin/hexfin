import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';
import { PIN_LENGTH } from '../pin';

interface PinPadProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** Bolinhas do PIN + teclado numérico próprio (não abre o teclado do sistema). */
export function PinPad({ value, onChange, disabled = false, error = false }: PinPadProps) {
  const { colors, fonts } = useAppTheme();

  function press(key: (typeof KEYS)[number]) {
    if (disabled || !key) return;
    if (key === 'del') return onChange(value.slice(0, -1));
    if (value.length < PIN_LENGTH) onChange(value + key);
  }

  return (
    <View style={styles.container}>
      <View style={styles.dots} accessibilityLabel={`${value.length} de ${PIN_LENGTH} dígitos`}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => {
          const filled = index < value.length;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  borderColor: error ? colors.expense : filled ? colors.primary : colors.border,
                  backgroundColor: filled ? (error ? colors.expense : colors.primary) : 'transparent',
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key, index) =>
          key ? (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Apagar dígito' : key}
              disabled={disabled}
              onPress={() => press(key)}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: key === 'del' ? 'transparent' : pressed ? colors.surfaceElevated : colors.surface, opacity: disabled ? 0.4 : 1 },
              ]}
            >
              {key === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={colors.text} />
              ) : (
                <Text style={[styles.keyText, { color: colors.text, fontFamily: fonts.medium }]}>{key}</Text>
              )}
            </Pressable>
          ) : (
            <View key={`blank-${index}`} style={styles.key} />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 36 },
  dots: { flexDirection: 'row', gap: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  grid: { width: 288, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  key: { width: 84, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 26 },
});
