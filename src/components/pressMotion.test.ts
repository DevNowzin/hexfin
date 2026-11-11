import { describe, expect, it } from 'vitest';
import { FOLD_MS, PRESS_MS, foldRotation, motionMs, pressScale } from './pressMotion';

describe('movimento do toque', () => {
  it('encolhe um pouco só enquanto pressionado', () => {
    expect(pressScale(true, false)).toBe(0.97);
    expect(pressScale(false, false)).toBe(1);
  });

  it('não mexe nada com "reduzir movimento" ligado', () => {
    expect(pressScale(true, true)).toBe(1);
    expect(motionMs(PRESS_MS, true)).toBe(0);
    expect(motionMs(FOLD_MS, true)).toBe(0);
  });

  it('fica entre 150 e 300 ms', () => {
    for (const ms of [PRESS_MS, FOLD_MS]) {
      expect(ms).toBeGreaterThanOrEqual(150);
      expect(ms).toBeLessThanOrEqual(300);
    }
  });

  it('a seta gira meia volta ao abrir', () => {
    expect(foldRotation(false)).toBe(0);
    expect(foldRotation(true)).toBe(180);
  });
});
