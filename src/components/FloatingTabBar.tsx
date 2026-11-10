import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/AppTheme';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName; label: string }> = {
  index: { on: 'home', off: 'home-outline', label: 'Início' },
  transactions: { on: 'swap-vertical', off: 'swap-vertical-outline', label: 'Atividades' },
  recurring: { on: 'repeat', off: 'repeat-outline', label: 'Recorrentes' },
  insights: { on: 'sparkles', off: 'sparkles-outline', label: 'Assistentes' },
};

/** Barra em pílula com as abas. Nova transação fica discreta, no topo de Atividades. */
export function FloatingTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.background }]}>
      <View style={[styles.pill, { backgroundColor: colors.tabBar, borderColor: colors.border }]}>
        {state.routes.map((route, index) => {
          const icon = ICONS[route.name];
          if (!icon) return null;
          const focused = state.index === index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={icon.label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                if (!focused) navigateToTab(route.key);
              }}
              style={styles.tab}
            >
              <Ionicons name={focused ? icon.on : icon.off} size={24} color={focused ? colors.primary : colors.textMuted} />
              {focused ? <View style={[styles.indicator, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  pill: { flex: 1, height: 68, borderRadius: 34, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', bottom: 10, width: 5, height: 5, borderRadius: 3 },
});
