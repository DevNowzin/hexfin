import { Text, type TextStyle } from 'react-native';
import { useFinance } from '@/features/finance/FinanceContext';
import { useAppTheme } from '@/theme/AppTheme';
import { formatCurrency } from '@/utils/format';

interface AmountTextProps {
  cents: number;
  showSign?: boolean;
  color?: string;
  style?: TextStyle;
}

export function AmountText({ cents, showSign = false, color, style }: AmountTextProps) {
  const { profile } = useFinance();
  const { colors, fonts } = useAppTheme();
  return (
    <Text style={[{ color: color ?? colors.text, fontFamily: fonts.semiBold, fontVariant: ['tabular-nums'] }, style]}>
      {profile.hideBalances ? 'R$ ••••••' : formatCurrency(cents, showSign)}
    </Text>
  );
}
