import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme/AppTheme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const { colors, fonts } = useAppTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} style={styles.action}>
          <Text style={[styles.actionText, { color: colors.textMuted, fontFamily: fonts.medium }]}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, letterSpacing: -0.3 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4 },
  actionText: { fontSize: 13 },
});
