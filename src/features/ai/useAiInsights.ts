import { useEffect, useRef, useState } from 'react';
import { suggestInsights } from '@/services/ai';
import { useAiSettings } from './AiSettingsContext';
import { isInsightsReady } from './config';
import { insightsCacheKey } from './insights';
import type { AiErrorCode, AiInsight, InsightsRequest } from './types';

type InsightsStatus = 'idle' | 'loading' | 'done' | 'error';

interface InsightsState {
  /** Para qual pedido (mês + percentuais) este estado vale; outro pedido volta a "idle". */
  key: string | null;
  status: InsightsStatus;
  insights: AiInsight[];
  error?: AiErrorCode;
}

const IDLE: Omit<InsightsState, 'key'> = { status: 'idle', insights: [] };

/** Comentários da IA sob demanda: só chama quando o usuário toca. Nunca altera dados. */
export function useAiInsights(request: InsightsRequest | null) {
  const { settings } = useAiSettings();
  const ready = isInsightsReady(settings);
  const key = request ? insightsCacheKey(request) : null;
  const [state, setState] = useState<InsightsState>({ key: null, ...IDLE });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function run() {
    if (!request || !ready) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ key, status: 'loading', insights: [] });
    suggestInsights(request, settings, { signal: controller.signal })
      .then((outcome) => {
        if (controller.signal.aborted) return;
        setState(
          outcome.insights.length > 0
            ? { key, status: 'done', insights: outcome.insights }
            : { key, status: 'error', insights: [], error: outcome.error ?? 'invalid_response' },
        );
      })
      .catch(() => {
        // suggestInsights já converte falhas; isto cobre só bugs inesperados.
        if (!controller.signal.aborted) setState({ key, status: 'error', insights: [], error: 'server' });
      });
  }

  const current = state.key === key ? state : { key, ...IDLE };
  return { available: ready && request !== null, status: current.status, insights: current.insights, error: current.error, run };
}
