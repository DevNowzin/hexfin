import { Switch } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

/**
 * Liga/desliga com as cores do tema. No navegador, o react-native-web ignora `thumbColor`
 * quando ligado e usa `activeThumbColor` (verde por padrão), por isso as duas vão juntas.
 */
export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: ToggleProps) {
  const { colors } = useAppTheme();
  const thumb = value ? colors.primaryText : colors.textMuted;
  const webColors = { activeThumbColor: colors.primaryText, activeTrackColor: colors.primary };
  return (
    <Switch
      accessibilityLabel={accessibilityLabel}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
      thumbColor={thumb}
      {...webColors}
    />
  );
}
