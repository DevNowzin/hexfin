import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { clearOpenFinanceSettings, loadOpenFinanceSettings, saveOpenFinanceSettings } from './storage';
import { DEFAULT_OPEN_FINANCE_SETTINGS, type OpenFinanceSettings } from './types';

/** Configuração do Open Finance, relida sempre que a tela ganha foco. */
export function useOpenFinanceSettings() {
  const [settings, setSettings] = useState<OpenFinanceSettings>(DEFAULT_OPEN_FINANCE_SETTINGS);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadOpenFinanceSettings()
        .then((loaded) => {
          if (!active) return;
          setSettings(loaded);
          setLoadError(false);
        })
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setHydrated(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const save = useCallback(async (next: OpenFinanceSettings) => {
    await saveOpenFinanceSettings(next);
    setSettings(next);
  }, []);

  const clear = useCallback(async () => {
    await clearOpenFinanceSettings();
    setSettings(DEFAULT_OPEN_FINANCE_SETTINGS);
  }, []);

  return { settings, hydrated, loadError, save, clear };
}
