import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';

/** Brilho roxo-azulado no topo da tela. Gradiente nativo do React Native (sem dependência). */
export function GlowBackground({ height = 460 }: { height?: number }) {
  const { colors, isDark } = useAppTheme();
  const strength = isDark ? 'A6' : '40';
  const gradient = [
    `radial-gradient(ellipse 70% 60% at 30% 0%, ${colors.primary}${strength} 0%, transparent 70%)`,
    `radial-gradient(ellipse 60% 55% at 85% 10%, ${colors.glow}${isDark ? '73' : '2E'} 0%, transparent 70%)`,
    `linear-gradient(180deg, transparent 55%, ${colors.background} 100%)`,
  ].join(', ');
  const style: ViewStyle =
    Platform.OS === 'web'
      ? ({ backgroundImage: gradient } as ViewStyle)
      : ({ experimental_backgroundImage: gradient } as ViewStyle);
  return <View pointerEvents="none" style={[styles.glow, { height }, style]} />;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
});
