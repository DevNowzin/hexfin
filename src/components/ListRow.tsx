import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface ListRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Com `onPress` e sem `right`, mostra a seta. */
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  bordered?: boolean;
}

/** Linha de lista em cartão: ícone, texto e seta ou controle à direita. */
export function ListRow({ icon, title, subtitle, onPress, right, destructive = false, bordered = false }: ListRowProps) {
  const { colors, fonts } = useAppTheme();
  const tint = destructive ? colors.expense : colors.text;
  const content = (
    <>
      <View style={[styles.icon, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon} size={19} color={tint} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: tint, fontFamily: fonts.medium }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.regular }]}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </>
  );
  const rowStyle = [styles.row, bordered ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null];

  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, { opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, minWidth: 0 },
  title: { fontSize: 14 },
  subtitle: { fontSize: 11, marginTop: 3 },
});
