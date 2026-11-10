import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Category } from '@/features/finance/types';
import { useAppTheme } from '@/theme/AppTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface CategoryIconProps {
  category: Category;
  size?: number;
}

export function CategoryIcon({ category, size = 44 }: CategoryIconProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${category.color}18`,
        },
      ]}
    >
      <Ionicons
        name={category.icon as IconName}
        size={size * 0.47}
        color={category.id === 'other' ? colors.textMuted : category.color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
