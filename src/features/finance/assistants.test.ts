import { describe, expect, it } from 'vitest';
import { ASSISTANTS, isAssistantEnabled, toggleAssistant, visibleInsights } from './assistants';
import { createSeedData } from './seed';
import { buildInsights, type FinanceInsight } from './selectors';

function insight(id: string): FinanceInsight {
  return { id, icon: 'sparkles-outline', title: id, description: id, tone: 'neutral' };
}

describe('assistentes locais', () => {
  it('todos começam ligados quando o perfil não tem a lista', () => {
    for (const assistant of ASSISTANTS) expect(isAssistantEnabled(undefined, assistant.id)).toBe(true);
  });

  it('desliga e liga de novo sem repetir ids', () => {
    const off = toggleAssistant(undefined, 'recurring');
    expect(off).toEqual(['recurring']);
    expect(isAssistantEnabled(off, 'recurring')).toBe(false);
    expect(isAssistantEnabled(off, 'top-category')).toBe(true);
    const both = toggleAssistant(off, 'top-category');
    expect(both).toEqual(['recurring', 'top-category']);
    expect(toggleAssistant(both, 'recurring')).toEqual(['top-category']);
  });

  it('não altera a lista recebida', () => {
    const disabled = ['recurring' as const];
    toggleAssistant(disabled, 'savings-rate');
    expect(disabled).toEqual(['recurring']);
  });

  it('esconde do carrossel os insights de assistentes desligados', () => {
    const insights = [insight('savings-rate'), insight('recurring'), insight('top-category')];
    expect(visibleInsights(insights, undefined)).toHaveLength(3);
    expect(visibleInsights(insights, ['recurring']).map((item) => item.id)).toEqual(['savings-rate', 'top-category']);
  });

  it('todo insight gerado pertence a um assistente', () => {
    const reference = new Date(2026, 10, 9, 12);
    const ids = new Set(ASSISTANTS.map((assistant) => assistant.id as string));
    const generated = buildInsights(createSeedData(reference), '2026-11', '2026-11-09');
    expect(generated.length).toBeGreaterThan(0);
    for (const item of generated) expect(ids.has(item.id)).toBe(true);
  });
});
