import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';

type IconName = keyof typeof Ionicons.glyphMap;

/** Ícones que a pessoa pode escolher para uma conta, além da cor. */
export const ACCOUNT_ICONS: Array<{ name: IconName; label: string }> = [
  { name: 'wallet-outline', label: 'Carteira' },
  { name: 'card-outline', label: 'Cartão' },
  { name: 'business-outline', label: 'Banco' },
  { name: 'cash-outline', label: 'Dinheiro' },
  { name: 'trending-up-outline', label: 'Investimento' },
  { name: 'shield-checkmark-outline', label: 'Reserva' },
  { name: 'home-outline', label: 'Casa' },
  { name: 'car-outline', label: 'Carro' },
  { name: 'airplane-outline', label: 'Viagem' },
  { name: 'school-outline', label: 'Estudos' },
  { name: 'gift-outline', label: 'Presente' },
  { name: 'heart-outline', label: 'Saúde' },
];

const ICON_NAMES = new Set<string>(ACCOUNT_ICONS.map((item) => item.name));

export function isAccountIcon(value: unknown): value is IconName {
  return typeof value === 'string' && ICON_NAMES.has(value);
}

interface AccountLogoProps {
  color: string;
  icon?: string;
  logoUrl?: string;
  /** Letra mostrada quando não há logo nem ícone. */
  initial?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Logo do banco (Open Finance) ou o ícone/cor escolhidos para a conta. */
export function AccountLogo({ color, icon, logoUrl, initial, size = 44, style }: AccountLogoProps) {
  const { colors, fonts } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (logoUrl && !failed) {
    return (
      <View style={[styles.base, round, { backgroundColor: colors.surfaceElevated }, style]}>
        <Image source={{ uri: logoUrl }} onError={() => setFailed(true)} style={round} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View style={[styles.base, round, { backgroundColor: color }, style]}>
      {isAccountIcon(icon) ? (
        <Ionicons name={icon} size={Math.round(size * 0.45)} color={colors.onColor} />
      ) : initial ? (
        <Text style={{ color: colors.onColor, fontFamily: fonts.bold, fontSize: Math.round(size * 0.38) }}>{initial}</Text>
      ) : (
        <View style={[styles.dot, { backgroundColor: colors.onColor }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dot: { width: 12, height: 12, borderRadius: 6, opacity: 0.85 },
});
