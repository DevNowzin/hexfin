import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteSecret, getSecret, setSecret } from '@/utils/secureStore';
import { isAutoLockSeconds, type AutoLockSeconds } from './pin';

const PREFS_KEY = 'hexfin:security:v1';
const PIN_KEY = 'hexfin.security.pin';

export interface SecurityPrefs {
  /** Já passou pelas boas-vindas. */
  onboarded: boolean;
  pinEnabled: boolean;
  autoLockSeconds: AutoLockSeconds;
  failedAttempts: number;
  /** Epoch ms até quando novas tentativas são recusadas. */
  lockedUntil: number;
}

export const DEFAULT_SECURITY_PREFS: SecurityPrefs = {
  onboarded: false,
  pinEnabled: false,
  autoLockSeconds: 60,
  failedAttempts: 0,
  lockedUntil: 0,
};

function nonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function parsePrefs(raw: string | null): SecurityPrefs {
  if (!raw) return DEFAULT_SECURITY_PREFS;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      onboarded: value.onboarded === true,
      pinEnabled: value.pinEnabled === true,
      autoLockSeconds: isAutoLockSeconds(value.autoLockSeconds) ? value.autoLockSeconds : DEFAULT_SECURITY_PREFS.autoLockSeconds,
      failedAttempts: nonNegativeInt(value.failedAttempts),
      lockedUntil: nonNegativeInt(value.lockedUntil),
    };
  } catch {
    return DEFAULT_SECURITY_PREFS;
  }
}

export async function loadSecurity(): Promise<{ prefs: SecurityPrefs; pin: string }> {
  const [prefs, pin] = await Promise.all([AsyncStorage.getItem(PREFS_KEY).then(parsePrefs), getSecret(PIN_KEY)]);
  // PIN ativo sem PIN guardado (ex.: SecureStore limpo pelo sistema) não pode trancar o usuário para sempre.
  if (prefs.pinEnabled && !pin) return { prefs: { ...prefs, pinEnabled: false }, pin };
  return { prefs, pin };
}

export async function saveSecurityPrefs(prefs: SecurityPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function savePin(pin: string): Promise<void> {
  await setSecret(PIN_KEY, pin);
}

export async function clearSecurity(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(PREFS_KEY), deleteSecret(PIN_KEY)]);
}
