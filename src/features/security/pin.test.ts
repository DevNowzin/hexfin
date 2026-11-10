import { describe, expect, it } from 'vitest';
import {
  attemptsBeforeWait,
  isAutoLockSeconds,
  isValidPinFormat,
  lockoutMs,
  pinsMatch,
  pinWeakness,
  shouldLockOnResume,
} from './pin.ts';

describe('formato e força do PIN', () => {
  it.each([
    ['482915', true],
    ['48291', false],
    ['4829150', false],
    ['48a915', false],
    ['', false],
  ])('%s válido? %s', (pin, expected) => {
    expect(isValidPinFormat(pin)).toBe(expected);
  });

  it('recusa repetidos e sequências', () => {
    expect(pinWeakness('111111')).toMatch(/repetir/);
    expect(pinWeakness('123456')).toMatch(/sequências/);
    expect(pinWeakness('987654')).toMatch(/sequências/);
    expect(pinWeakness('12345')).toMatch(/6 números/);
  });

  it('aceita PIN comum', () => {
    expect(pinWeakness('482915')).toBeNull();
    expect(pinWeakness('112233')).toBeNull();
  });
});

describe('pinsMatch', () => {
  it('compara exatamente', () => {
    expect(pinsMatch('482915', '482915')).toBe(true);
    expect(pinsMatch('482916', '482915')).toBe(false);
    expect(pinsMatch('48291', '482915')).toBe(false);
    expect(pinsMatch('', '')).toBe(false);
  });
});

describe('espera após erros', () => {
  it('não espera nas 4 primeiras tentativas', () => {
    expect(lockoutMs(0)).toBe(0);
    expect(lockoutMs(4)).toBe(0);
    expect(attemptsBeforeWait(3)).toBe(2);
  });

  it('dobra a partir do quinto erro até 15 minutos', () => {
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(20)).toBe(15 * 60_000);
    expect(attemptsBeforeWait(9)).toBe(0);
  });

  it('valores inválidos não travam', () => {
    expect(lockoutMs(Number.NaN)).toBe(0);
    expect(lockoutMs(-3)).toBe(0);
  });
});

describe('bloqueio ao voltar', () => {
  it('bloqueia imediatamente quando a opção é 0', () => {
    expect(shouldLockOnResume(1000, 1000, 0)).toBe(true);
  });

  it('respeita o tempo escolhido', () => {
    expect(shouldLockOnResume(0, 59_000, 60)).toBe(false);
    expect(shouldLockOnResume(0, 60_000, 60)).toBe(true);
  });

  it('não bloqueia se nunca foi para o segundo plano', () => {
    expect(shouldLockOnResume(null, 999_999, 0)).toBe(false);
  });

  it('só aceita as opções da tela', () => {
    expect(isAutoLockSeconds(60)).toBe(true);
    expect(isAutoLockSeconds(30)).toBe(false);
  });
});
