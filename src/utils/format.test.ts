import { describe, expect, it } from 'vitest';
import {
  amountInputToCents,
  centsToAmountInput,
  formatAmountInput,
  greetingForHour,
  formatCurrency,
  isValidDateInput,
} from './format';
import { toDateInput } from './format';

describe('formatos financeiros', () => {
  it('formata centavos em reais', () => {
    expect(formatCurrency(123456)).toMatch(/1\.234,56/);
    expect(formatCurrency(-123456)).toContain('-');
    expect(formatCurrency(123456, true)).toContain('+');
  });

  it('converte a entrada decimal sem usar ponto flutuante', () => {
    const digits = centsToAmountInput(123456);
    expect(digits).toBe('123456');
    expect(amountInputToCents(digits)).toBe(123456);
    expect(formatAmountInput(digits)).toBe('1.234,56');
  });
});

describe('datas', () => {
  it('valida datas reais no formato do formulário', () => {
    expect(isValidDateInput('2026-11-09')).toBe(true);
    expect(isValidDateInput('2026-02-30')).toBe(false);
    expect(isValidDateInput('09/11/2026')).toBe(false);
  });

  it('usa componentes locais ao serializar', () => {
    expect(toDateInput(new Date(2026, 10, 9, 12))).toBe('2026-11-09');
  });
});

describe('greetingForHour', () => {
  it.each([
    [4, 'Boa noite'],
    [5, 'Bom dia'],
    [11, 'Bom dia'],
    [12, 'Boa tarde'],
    [17, 'Boa tarde'],
    [18, 'Boa noite'],
    [23, 'Boa noite'],
  ])('%i h → %s', (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});
