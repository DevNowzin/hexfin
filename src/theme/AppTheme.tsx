import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { useFinance } from '@/features/finance/FinanceContext';
import type { ThemePreference } from '@/features/finance/types';
import { darkColors, fonts, lightColors, type AppColors } from './colors';

interface AppThemeValue {
  colors: AppColors;
  fonts: typeof fonts;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const AppThemeContext = createContext<AppThemeValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const { profile, updateProfile } = useFinance();
  const isDark = profile.theme === 'system' ? systemScheme !== 'light' : profile.theme === 'dark';

  const value = useMemo<AppThemeValue>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      fonts,
      isDark,
      preference: profile.theme,
      setPreference: (theme) => updateProfile({ theme }),
    }),
    [isDark, profile.theme, updateProfile],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme deve ser usado dentro de AppThemeProvider');
  return context;
}
