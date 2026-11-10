import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';
import { IconButton } from './IconButton';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  showBack?: boolean;
}

export function ScreenHeader({ title, subtitle, right, showBack = false }: ScreenHeaderProps) {
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  return (
    <View style={styles.container}>
      {showBack ? <IconButton icon="chevron-back" label="Voltar" onPress={() => router.back()} /> : null}
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.bold }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.regular }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 66,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textContainer: { flex: 1 },
  title: { fontSize: 28, letterSpacing: -0.9 },
  subtitle: { fontSize: 13, marginTop: 3 },
  right: { flexDirection: 'row', alignItems: 'center' },
});
