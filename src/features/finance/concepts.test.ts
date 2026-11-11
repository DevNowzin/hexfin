import { describe, expect, it } from 'vitest';
import { CONCEPTS_NOTICE, INVESTMENT_CONCEPTS } from './concepts';

describe('conceitos de investimento', () => {
  it('cada conceito tem id único e texto curto para caber no cartão', () => {
    const ids = INVESTMENT_CONCEPTS.map((concept) => concept.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const concept of INVESTMENT_CONCEPTS) {
      expect(concept.title.length).toBeGreaterThan(0);
      expect(concept.text.length).toBeLessThanOrEqual(120);
    }
  });

  it('não indica produto nem diz o que fazer com o dinheiro', () => {
    const advice = /\b(compre|venda|invista|aplique|recomend|melhor investimento|cdb|tesouro|a[cç][aã]o|a[cç][oõ]es|fii|cripto|bitcoin|poupan[cç]a)\b/i;
    for (const concept of INVESTMENT_CONCEPTS) expect(concept.text).not.toMatch(advice);
  });

  it('não traz valores em dinheiro nem taxas', () => {
    for (const concept of INVESTMENT_CONCEPTS) expect(concept.text).not.toMatch(/R\$|\d+\s*%/);
  });

  it('avisa que é só educativo', () => {
    expect(CONCEPTS_NOTICE).toContain('Não é recomendação');
  });
});
