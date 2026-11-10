import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { attemptsBeforeWait, lockoutMs, pinsMatch, shouldLockOnResume, type AutoLockSeconds } from './pin';
import { clearSecurity, DEFAULT_SECURITY_PREFS, loadSecurity, savePin, saveSecurityPrefs, type SecurityPrefs } from './storage';

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; attemptsLeft: number; waitMs: number }
  | { ok: false; reason: 'waiting'; waitMs: number };

interface SecurityValue {
  hydrated: boolean;
  prefs: SecurityPrefs;
  locked: boolean;
  /** Termina as boas-vindas; `pin` null = usuário pulou o PIN. */
  completeOnboarding: (pin: string | null) => Promise<void>;
  verifyPin: (pin: string) => Promise<VerifyResult>;
  unlock: (pin: string) => Promise<VerifyResult>;
  enablePin: (pin: string) => Promise<void>;
  disablePin: () => Promise<void>;
  setAutoLock: (seconds: AutoLockSeconds) => Promise<void>;
  /** Esqueceu o PIN: apaga PIN e preferências. Quem chama apaga os outros dados. */
  forgetAll: () => Promise<void>;
}

const SecurityContext = createContext<SecurityValue | null>(null);

export function SecurityProvider({ children }: PropsWithChildren) {
  const [prefs, setPrefs] = useState<SecurityPrefs>(DEFAULT_SECURITY_PREFS);
  const [hydrated, setHydrated] = useState(false);
  const [locked, setLocked] = useState(false);
  const pinRef = useRef('');
  const prefsRef = useRef(prefs);
  const backgroundedAt = useRef<number | null>(null);

  const persist = useCallback(async (next: SecurityPrefs) => {
    prefsRef.current = next;
    setPrefs(next);
    await saveSecurityPrefs(next);
  }, []);

  useEffect(() => {
    let active = true;
    loadSecurity()
      .then(({ prefs: loaded, pin }) => {
        if (!active) return;
        pinRef.current = pin;
        prefsRef.current = loaded;
        setPrefs(loaded);
        setLocked(loaded.pinEnabled);
      })
      .catch((error: unknown) => {
        console.warn('[security] não foi possível ler o bloqueio', error instanceof Error ? error.name : 'unknown');
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const current = prefsRef.current;
      if (current.pinEnabled && shouldLockOnResume(backgroundedAt.current, Date.now(), current.autoLockSeconds)) setLocked(true);
      backgroundedAt.current = null;
    });
    return () => subscription.remove();
  }, []);

  const verifyPin = useCallback(
    async (pin: string): Promise<VerifyResult> => {
      const current = prefsRef.current;
      const now = Date.now();
      if (current.lockedUntil > now) return { ok: false, reason: 'waiting', waitMs: current.lockedUntil - now };
      if (pinsMatch(pin, pinRef.current)) {
        if (current.failedAttempts > 0 || current.lockedUntil > 0) await persist({ ...current, failedAttempts: 0, lockedUntil: 0 });
        return { ok: true };
      }
      const failedAttempts = current.failedAttempts + 1;
      const waitMs = lockoutMs(failedAttempts);
      await persist({ ...current, failedAttempts, lockedUntil: waitMs ? now + waitMs : 0 });
      return { ok: false, reason: 'wrong', attemptsLeft: attemptsBeforeWait(failedAttempts), waitMs };
    },
    [persist],
  );

  const unlock = useCallback(
    async (pin: string) => {
      const result = await verifyPin(pin);
      if (result.ok) setLocked(false);
      return result;
    },
    [verifyPin],
  );

  const enablePin = useCallback(
    async (pin: string) => {
      await savePin(pin);
      pinRef.current = pin;
      await persist({ ...prefsRef.current, pinEnabled: true, failedAttempts: 0, lockedUntil: 0 });
    },
    [persist],
  );

  const disablePin = useCallback(async () => {
    await savePin('');
    pinRef.current = '';
    await persist({ ...prefsRef.current, pinEnabled: false, failedAttempts: 0, lockedUntil: 0 });
  }, [persist]);

  const completeOnboarding = useCallback(
    async (pin: string | null) => {
      if (pin) {
        await savePin(pin);
        pinRef.current = pin;
      }
      await persist({ ...prefsRef.current, onboarded: true, pinEnabled: Boolean(pin), failedAttempts: 0, lockedUntil: 0 });
      setLocked(false);
    },
    [persist],
  );

  const setAutoLock = useCallback(
    async (seconds: AutoLockSeconds) => persist({ ...prefsRef.current, autoLockSeconds: seconds }),
    [persist],
  );

  const forgetAll = useCallback(async () => {
    await clearSecurity();
    pinRef.current = '';
    prefsRef.current = DEFAULT_SECURITY_PREFS;
    setPrefs(DEFAULT_SECURITY_PREFS);
    setLocked(false);
  }, []);

  const value = useMemo(
    () => ({ hydrated, prefs, locked, completeOnboarding, verifyPin, unlock, enablePin, disablePin, setAutoLock, forgetAll }),
    [hydrated, prefs, locked, completeOnboarding, verifyPin, unlock, enablePin, disablePin, setAutoLock, forgetAll],
  );
  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity(): SecurityValue {
  const value = useContext(SecurityContext);
  if (!value) throw new Error('useSecurity precisa estar dentro de SecurityProvider.');
  return value;
}
