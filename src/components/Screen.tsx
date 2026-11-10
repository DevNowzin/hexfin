import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/AppTheme';

interface ScreenProps extends PropsWithChildren {
  style?: ViewStyle;
  withTopInset?: boolean;
}

export function Screen({ children, style, withTopInset = true }: ScreenProps) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView
      edges={withTopInset ? ['top'] : []}
      style={[styles.container, { backgroundColor: colors.background }, style]}
    >
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
});
