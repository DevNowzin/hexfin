import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useAppTheme } from '@/theme/AppTheme';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Atividades' }} />
      <Tabs.Screen name="recurring" options={{ title: 'Recorrentes' }} />
      <Tabs.Screen name="insights" options={{ title: 'Assistentes' }} />
    </Tabs>
  );
}
