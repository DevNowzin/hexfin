import { useEffect, useState } from 'react';
import { suggestCategory, type SuggestionOutcome } from '@/services/ai';
import { useAiSettings } from './AiSettingsContext';
import type { CategorizableType } from './types';

const DEBOUNCE_MS = 700;
const MIN_LENGTH = 3;

interface CategorizationState extends SuggestionOutcome {
  loading: boolean;
}

/**
 * Sugere uma categoria para a descrição digitada. Nunca altera o formulário:
 * quem aplica a sugestão é o usuário.
 */
export function useCategorization(description: string, type: CategorizableType, enabled: boolean): CategorizationState {
  const { settings } = useAiSettings();
  const [state, setState] = useState<CategorizationState>({ suggestion: null, loading: false });
  const trimmed = description.trim();

  useEffect(() => {
    if (!enabled || trimmed.length < MIN_LENGTH) {
      setState({ suggestion: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true }));
    const timer = setTimeout(() => {
      suggestCategory({ description: trimmed, type }, settings, { signal: controller.signal })
        .then((outcome) => {
          if (!controller.signal.aborted) setState({ ...outcome, loading: false });
        })
        .catch(() => {
          // suggestCategory já converte falhas em fallback; isto cobre só bugs inesperados.
          if (!controller.signal.aborted) setState({ suggestion: null, error: 'server', loading: false });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, trimmed, type, settings]);

  return state;
}
