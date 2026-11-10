import { Image, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';

const LOGO = require('../../assets/brand/logo.png');

interface HexLogoProps {
  compact?: boolean;
  size?: number;
}

/** A raposa no hexágono (assets/brand/logo.svg) e, fora do modo compacto, o nome. */
export function HexLogo({ compact = false, size = 40 }: HexLogoProps) {
  const { colors, fonts } = useAppTheme();
  return (
    <View style={styles.container}>
      <Image source={LOGO} accessibilityIgnoresInvertColors style={{ width: size, height: size }} />
      {!compact ? <Text style={[styles.wordmark, { color: colors.text, fontFamily: fonts.bold }]}>HexFin</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontSize: 24, letterSpacing: -0.8 },
});
