import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { fetchLatestRelease, type UpdateCheck } from '@/services/appUpdate';
import { type AppRelease, isNewer } from './release';

/** Versão deste APK (a do app.json usado no build). */
export const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export type UpdateState =
  | { status: 'idle' | 'checking' | 'current' }
  | { status: 'available'; release: AppRelease }
  | { status: 'error'; error: Extract<UpdateCheck, { ok: false }>['error'] };

// Uma consulta por abertura do app, compartilhada entre as telas.
let shared: UpdateState = { status: 'idle' };
const listeners = new Set<(state: UpdateState) => void>();

function publish(state: UpdateState) {
  shared = state;
  listeners.forEach((listener) => listener(state));
}

export async function checkForUpdate(): Promise<UpdateState> {
  // Só o Android instala APK; no Web não há o que atualizar.
  if (Platform.OS !== 'android') return shared;
  publish({ status: 'checking' });
  const result = await fetchLatestRelease();
  if (!result.ok) {
    publish({ status: 'error', error: result.error });
  } else if (result.release && isNewer(result.release.version, CURRENT_VERSION)) {
    publish({ status: 'available', release: result.release });
  } else {
    publish({ status: 'current' });
  }
  return shared;
}

/** Estado da versão nova. Com `autoCheck`, procura uma vez na abertura do app. */
export function useAppUpdate(autoCheck = false) {
  const [state, setState] = useState<UpdateState>(shared);

  useEffect(() => {
    listeners.add(setState);
    if (autoCheck && shared.status === 'idle') {
      checkForUpdate().catch((error: unknown) => {
        console.warn('[update] falha ao procurar versão', error instanceof Error ? error.name : 'unknown');
      });
    }
    return () => {
      listeners.delete(setState);
    };
  }, [autoCheck]);

  const check = useCallback(() => checkForUpdate(), []);
  return { state, check };
}
