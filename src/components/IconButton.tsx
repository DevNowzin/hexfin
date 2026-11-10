import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  filled?: boolean;
  color?: string;
}

export function IconButton({ icon, label, onPress, style, filled = false, color }: IconButtonProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled ? colors.surfaceElevated : 'transparent', opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      <Ionicons name={icon} size={21} color={color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
