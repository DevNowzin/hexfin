import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { clearSuggestionCache } from '@/services/ai';
import { DEFAULT_AI_SETTINGS, type AiSettings } from './config';
import { clearAiSettings, loadAiSettings, saveAiSettings } from './storage';

interface AiSettingsValue {
  settings: AiSettings;
  hydrated: boolean;
  save: (next: AiSettings) => Promise<void>;
  reset: () => Promise<void>;
}

const AiSettingsContext = createContext<AiSettingsValue | null>(null);

export function AiSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    loadAiSettings()
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .catch((error: unknown) => {
        // Sem configuração legível a IA fica desligada; o app segue com as regras locais.
        console.warn('[ai] não foi possível ler as configurações', error instanceof Error ? error.name : 'unknown');
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (next: AiSettings) => {
    await saveAiSettings(next);
    clearSuggestionCache();
    setSettings(next);
  }, []);

  const reset = useCallback(async () => {
    await clearAiSettings();
    clearSuggestionCache();
    setSettings(DEFAULT_AI_SETTINGS);
  }, []);

  const value = useMemo(() => ({ settings, hydrated, save, reset }), [settings, hydrated, save, reset]);
  return <AiSettingsContext.Provider value={value}>{children}</AiSettingsContext.Provider>;
}

export function useAiSettings(): AiSettingsValue {
  const value = useContext(AiSettingsContext);
  if (!value) throw new Error('useAiSettings precisa estar dentro de AiSettingsProvider.');
  return value;
}
