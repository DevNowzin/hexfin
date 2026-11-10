import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from '@expo-google-fonts/geist';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AiSettingsProvider } from '@/features/ai/AiSettingsContext';
import { FinanceProvider, useFinance } from '@/features/finance/FinanceContext';
import { LockScreen } from '@/features/security/LockScreen';
import { Onboarding } from '@/features/security/Onboarding';
import { SecurityProvider, useSecurity } from '@/features/security/SecurityContext';
import { AppThemeProvider, useAppTheme } from '@/theme/AppTheme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { colors, isDark } = useAppTheme();
  const { hydrated } = useFinance();
  const security = useSecurity();
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
  });
  const ready = hydrated && security.hydrated && (fontsLoaded || Boolean(fontError));
  // A raposa se monta inteira (~1,3 s) antes de entrar, mesmo que os dados cheguem antes.
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  // A abertura nativa (só o fundo preto) sai assim que a tela de carregamento aparece.
  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (ready) hideSplash();
  }, [ready, hideSplash]);

  if (!ready || !introDone) return <LoadingScreen onShown={hideSplash} onIntroDone={finishIntro} />;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/new" />
        <Stack.Screen name="accounts/new" />
      </Stack>
      {/* Boas-vindas e bloqueio cobrem a navegação sem desmontá-la. */}
      {!security.prefs.onboarded ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
          <Onboarding />
        </View>
      ) : security.locked ? (
        <LockScreen />
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <FinanceProvider>
          <AiSettingsProvider>
            <AppThemeProvider>
              <SecurityProvider>
                <RootNavigator />
              </SecurityProvider>
            </AppThemeProvider>
          </AiSettingsProvider>
        </FinanceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
