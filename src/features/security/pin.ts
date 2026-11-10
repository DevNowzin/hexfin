// Regras puras do PIN e do bloqueio. Sem imports de React Native: testáveis no Node.

export const PIN_LENGTH = 6;
/** Erros permitidos antes de começar a espera. */
export const FREE_ATTEMPTS = 5;
const FIRST_WAIT_MS = 30_000;
const MAX_WAIT_MS = 15 * 60_000;

export const AUTO_LOCK_OPTIONS = [0, 60, 300] as const;
export type AutoLockSeconds = (typeof AUTO_LOCK_OPTIONS)[number];

export function isAutoLockSeconds(value: unknown): value is AutoLockSeconds {
  return AUTO_LOCK_OPTIONS.includes(value as AutoLockSeconds);
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Mensagem explicando por que o PIN é fácil demais, ou null se ele serve. */
export function pinWeakness(pin: string): string | null {
  if (!isValidPinFormat(pin)) return `Use ${PIN_LENGTH} números.`;
  if (/^(\d)\1+$/.test(pin)) return 'Evite repetir o mesmo número.';
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, index) => digit - digits[index]!);
  if (steps.every((step) => step === 1) || steps.every((step) => step === -1)) return 'Evite sequências como 123456.';
  return null;
}

/** Comparação que não para no primeiro dígito diferente. */
export function pinsMatch(given: string, expected: string): boolean {
  if (given.length !== expected.length || expected.length === 0) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= given.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

/** Espera após `failedAttempts` erros seguidos: 0 até 5 erros, depois 30 s dobrando até 15 min. */
export function lockoutMs(failedAttempts: number): number {
  if (!Number.isFinite(failedAttempts) || failedAttempts < FREE_ATTEMPTS) return 0;
  const doublings = failedAttempts - FREE_ATTEMPTS;
  return Math.min(FIRST_WAIT_MS * 2 ** doublings, MAX_WAIT_MS);
}

export function attemptsBeforeWait(failedAttempts: number): number {
  return Math.max(FREE_ATTEMPTS - failedAttempts, 0);
}

/** Ao voltar do segundo plano: bloqueia se ficou fora por pelo menos `autoLockSeconds`. */
export function shouldLockOnResume(backgroundedAt: number | null, now: number, autoLockSeconds: AutoLockSeconds): boolean {
  if (backgroundedAt === null) return false;
  return now - backgroundedAt >= autoLockSeconds * 1000;
}
