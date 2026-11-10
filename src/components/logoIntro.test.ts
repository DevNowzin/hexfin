import { describe, expect, it } from 'vitest';
import { INTRO_STEPS, introDurationMs, toBox } from './logoIntro';

describe('montagem da raposa', () => {
  it('termina quando a orelha chega, perto de 1,3 s', () => {
    expect(introDurationMs()).toBe(1250);
    expect(introDurationMs([])).toBe(0);
  });

  it('cada peça entra uma vez, na ordem hexágono, faixa, rabo e orelha por último', () => {
    expect(INTRO_STEPS.map((step) => step.layer)).toEqual(['hexTop', 'hexLeft', 'band', 'tail', 'ear']);
    const delays = INTRO_STEPS.map((step) => step.delayMs);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
  });

  it('converte o quadro do SVG para o tamanho da tela', () => {
    expect(toBox(184, 160)).toBe(160);
    expect(toBox(92, 160)).toBe(80);
    expect(toBox(16, 160)).toBeCloseTo(13.91, 2);
  });
});
