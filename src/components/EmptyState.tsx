import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';
import { Button } from './Button';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'file-tray-outline', title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors, fonts } = useAppTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name={icon} size={30} color={colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textMuted, fontFamily: fonts.regular }]}>{description}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 34 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 18, textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  button: { marginTop: 20 },
});
