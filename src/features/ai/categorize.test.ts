import { describe, expect, it } from 'vitest';
import {
  categorySuggestionSchema,
  localCategorize,
  normalizeDescription,
  parseCategorySuggestion,
  suggestionCacheKey,
  validateCategorizeRequest,
} from './categorize.ts';

describe('normalizeDescription', () => {
  it('remove acentos, pontuação e caixa', () => {
    expect(normalizeDescription('  Pão de Açúcar — LOJA 12! ')).toBe('pao de acucar loja 12');
  });
});

describe('validateCategorizeRequest', () => {
  it('aceita e limpa entrada válida', () => {
    expect(validateCategorizeRequest({ description: ' Uber ', type: 'expense' })).toEqual({
      ok: true,
      value: { description: 'Uber', type: 'expense', locale: 'pt-BR' },
    });
  });

  it.each([
    [null],
    [{ description: '   ', type: 'expense' }],
    [{ description: 'a'.repeat(81), type: 'expense' }],
    [{ description: 'ok', type: 'transfer' }],
    [{ description: 'ok', type: 'expense', locale: 'en-US' }],
  ])('rejeita %j', (body) => {
    expect(validateCategorizeRequest(body).ok).toBe(false);
  });
});

describe('parseCategorySuggestion', () => {
  it('aceita categoria válida para o tipo', () => {
    expect(parseCategorySuggestion({ categoryId: 'food', confidence: 0.9, reason: ' Mercado ' }, 'expense')).toEqual({
      categoryId: 'food',
      confidence: 0.9,
      reason: 'Mercado',
    });
  });

  it('rejeita categoria desconhecida ou de outro tipo', () => {
    expect(parseCategorySuggestion({ categoryId: 'crypto', confidence: 0.9, reason: '' }, 'expense')).toBeNull();
    expect(parseCategorySuggestion({ categoryId: 'salary', confidence: 0.9, reason: '' }, 'expense')).toBeNull();
  });

  it('rejeita confiança fora de [0, 1] ou não numérica', () => {
    expect(parseCategorySuggestion({ categoryId: 'food', confidence: 1.2, reason: '' }, 'expense')).toBeNull();
    expect(parseCategorySuggestion({ categoryId: 'food', confidence: '0.9', reason: '' }, 'expense')).toBeNull();
    expect(parseCategorySuggestion({ categoryId: 'food', confidence: Number.NaN, reason: '' }, 'expense')).toBeNull();
  });

  it('corta justificativa longa e tolera ausência', () => {
    const long = parseCategorySuggestion({ categoryId: 'food', confidence: 0.5, reason: 'x'.repeat(500) }, 'expense');
    expect(long?.reason).toHaveLength(160);
    expect(parseCategorySuggestion({ categoryId: 'food', confidence: 0.5 }, 'expense')?.reason).toBe('');
  });
});

describe('localCategorize', () => {
  it.each([
    ['Mercado Pão de Açúcar', 'expense', 'food'],
    ['Mercado Livre - fone', 'expense', 'shopping'],
    ['Uber para o trabalho', 'expense', 'transport'],
    ['NETFLIX.COM', 'expense', 'subscriptions'],
    ['Drogaria São Paulo', 'expense', 'health'],
    ['Salário novembro', 'income', 'salary'],
    ['Rendimento CDB', 'income', 'investments'],
  ] as const)('%s → %s', (description, type, expected) => {
    expect(localCategorize(description, type)?.categoryId).toBe(expected);
  });

  it('não sugere categoria incompatível com o tipo', () => {
    expect(localCategorize('Salário', 'expense')).toBeNull();
    expect(localCategorize('Uber', 'income')).toBeNull();
  });

  it('não casa pedaço de palavra', () => {
    expect(localCategorize('Barbearia', 'expense')).toBeNull();
  });

  it('retorna null sem correspondência', () => {
    expect(localCategorize('xyz qualquer', 'expense')).toBeNull();
  });
});

describe('schema e cache', () => {
  it('o enum do schema só tem categorias do tipo', () => {
    const schema = categorySuggestionSchema('income') as { properties: { categoryId: { enum: string[] } } };
    expect(schema.properties.categoryId.enum).toEqual(['salary', 'investments', 'other']);
  });

  it('a chave de cache ignora acento e caixa', () => {
    expect(suggestionCacheKey({ description: 'Padaria São João', type: 'expense' })).toBe(
      suggestionCacheKey({ description: 'PADARIA sao joao', type: 'expense' }),
    );
  });
});
