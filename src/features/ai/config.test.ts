import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS, isAiReady, isValidBackendUrl, validateAiSettings } from './config.ts';

const consentedAt = '2026-11-09T12:00:00.000Z';

describe('isValidBackendUrl', () => {
  it.each([
    ['https://api.hexfin.app', true],
    ['http://localhost:8787', true],
    ['http://10.0.2.2:8787', true],
    ['http://192.168.0.10:8787', false],
    ['ftp://x', false],
    ['não é url', false],
  ])('%s → %s', (url, expected) => {
    expect(isValidBackendUrl(url)).toBe(expected);
  });
});

describe('validateAiSettings', () => {
  it('desligada é sempre válida e nunca pronta', () => {
    expect(validateAiSettings(DEFAULT_AI_SETTINGS)).toBeNull();
    expect(isAiReady(DEFAULT_AI_SETTINGS)).toBe(false);
  });

  it('exige consentimento', () => {
    expect(validateAiSettings({ ...DEFAULT_AI_SETTINGS, mode: 'direct', apiKey: 'x'.repeat(30) })).toMatch(/Autorize/);
  });

  it('modo direto exige chave e modelo válidos', () => {
    const base = { ...DEFAULT_AI_SETTINGS, mode: 'direct' as const, consentedAt };
    expect(validateAiSettings({ ...base, apiKey: 'curta' })).toMatch(/chave/);
    expect(validateAiSettings({ ...base, apiKey: 'x'.repeat(30), model: 'gpt-x' })).toMatch(/Modelo/);
    expect(isAiReady({ ...base, apiKey: 'x'.repeat(30) })).toBe(true);
  });

  it('modo servidor exige URL segura e token', () => {
    const base = { ...DEFAULT_AI_SETTINGS, mode: 'backend' as const, consentedAt };
    expect(validateAiSettings({ ...base, backendUrl: 'http://exemplo.com', backendToken: 'x'.repeat(30) })).toMatch(/https/);
    expect(validateAiSettings({ ...base, backendUrl: 'https://exemplo.com', backendToken: 'curto' })).toMatch(/token/);
    expect(isAiReady({ ...base, backendUrl: 'https://exemplo.com', backendToken: 'x'.repeat(30) })).toBe(true);
  });
});
