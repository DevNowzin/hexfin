import { useCallback, useEffect, useRef, useState } from 'react';
import { useFinance } from '@/features/finance/FinanceContext';
import { OPEN_FINANCE_ERROR_MESSAGES, syncOpenFinance } from '@/services/openFinance';
import { toDateInput } from '@/utils/format';
import { describeImport } from './merge';
import { institutionsNeedingLogo, validateOpenFinanceSettings } from './normalize';
import type { OpenFinanceSettings } from './types';

export interface QuickSyncMessage {
  text: string;
  tone: 'ok' | 'error';
}

/**
 * Sincroniza com a conexão já salva (o botão pequeno do Início). Sem conexão completa ou sem
 * autorização, `ready` é falso e a tela leva para o Open Finance em vez de sincronizar.
 */
export function useQuickSync(settings: OpenFinanceSettings, save: (next: OpenFinanceSettings) => Promise<void>) {
  const { importOpenFinance, accounts } = useFinance();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<QuickSyncMessage | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const ready = Boolean(settings.consentedAt) && validateOpenFinanceSettings(settings) === null;

  useEffect(() => () => controllerRef.current?.abort(), []);

  const sync = useCallback(async () => {
    if (!ready || busy) return;
    setBusy(true);
    setMessage(null);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const outcome = await syncOpenFinance(settings, toDateInput(), { signal: controller.signal }, institutionsNeedingLogo(accounts));
      if (controller.signal.aborted) return;
      if (!outcome.ok) {
        setMessage({ text: OPEN_FINANCE_ERROR_MESSAGES[outcome.error], tone: 'error' });
        return;
      }
      const report = importOpenFinance(outcome.snapshot);
      await save({ ...settings, lastSync: { ...report, at: new Date().toISOString(), warnings: outcome.snapshot.warnings } });
      setMessage({ text: `Sincronizado: ${describeImport(report)}.`, tone: 'ok' });
    } catch {
      setMessage({ text: 'Os dados vieram, mas não foi possível salvar o resumo. Tente de novo.', tone: 'error' });
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [ready, busy, settings, save, importOpenFinance, accounts]);

  const dismiss = useCallback(() => setMessage(null), []);
  return { ready, busy, message, sync, dismiss };
}
