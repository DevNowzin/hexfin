import { describe, expect, it } from 'vitest';
import type { Transaction } from '@/features/finance/types';
import {
  buildInsightsUserMessage,
  citesOnlyKnownNumbers,
  insightsCacheKey,
  parseInsightsResponse,
  validateInsightsRequest,
} from './insights';
import { buildInsightsRequest } from './insightsRequest';
import type { InsightsRequest } from './types';

const request: InsightsRequest = {
  month: '2026-11',
  savingsRatePercent: 23,
  expenseChangePercent: -12,
  categories: [
    { id: 'food', sharePercent: 40 },
    { id: 'housing', sharePercent: 35 },
  ],
  locale: 'pt-BR',
};

function transaction(patch: Partial<Transaction>): Transaction {
  return {
    id: 't',
    description: 'Teste',
    amountCents: 1000,
    type: 'expense',
    date: '2026-11-09',
    categoryId: 'food',
    accountId: 'a',
    status: 'completed',
    createdAt: '2026-11-09T12:00:00.000Z',
    ...patch,
  };
}

describe('pedido de comentários da IA', () => {
  it('aceita o contrato e normaliza o idioma', () => {
    const { locale: _locale, ...withoutLocale } = request;
    expect(validateInsightsRequest(withoutLocale)).toEqual({ ok: true, value: request });
  });

  it('recusa qualquer campo fora do contrato, como valores em reais ou descrições', () => {
    expect(validateInsightsRequest({ ...request, incomeCents: 500000 })).toMatchObject({ ok: false, error: 'Campo não permitido: incomeCents.' });
    expect(validateInsightsRequest({ ...request, categories: [{ id: 'food', sharePercent: 40, totalCents: 9000 }] }).ok).toBe(false);
    expect(validateInsightsRequest({ ...request, categories: [{ id: 'food', sharePercent: 40, description: 'Mercado' }] }).ok).toBe(false);
  });

  it('recusa percentuais quebrados, fora da faixa, categoria desconhecida e mês inválido', () => {
    expect(validateInsightsRequest({ ...request, savingsRatePercent: 23.5 }).ok).toBe(false);
    expect(validateInsightsRequest({ ...request, categories: [{ id: 'food', sharePercent: 140 }] }).ok).toBe(false);
    expect(validateInsightsRequest({ ...request, categories: [{ id: 'cassino', sharePercent: 10 }] }).ok).toBe(false);
    expect(validateInsightsRequest({ ...request, month: '2026-13' }).ok).toBe(false);
  });

  it('recusa mês sem nada para comentar', () => {
    expect(validateInsightsRequest({ ...request, savingsRatePercent: null, expenseChangePercent: null, categories: [] }).ok).toBe(false);
  });

  it('monta a mensagem com nomes de categoria e só percentuais', () => {
    const message = buildInsightsUserMessage(request);
    expect(message).toContain('Taxa de economia: 23%');
    expect(message).toContain('contra o mês anterior: -12%');
    expect(message).toContain('- Alimentação: 40%');
    expect(message).not.toContain('R$');
  });

  it('a chave de cache muda quando os percentuais mudam', () => {
    expect(insightsCacheKey(request)).not.toBe(insightsCacheKey({ ...request, savingsRatePercent: 24 }));
  });
});

describe('resposta da IA', () => {
  const ok = { title: 'Alimentação pesa mais', message: 'Alimentação ficou com 40% das despesas. Vale revisar os pedidos por aplicativo.', tone: 'neutral' };

  it('aceita comentários válidos e corta em 3', () => {
    expect(parseInsightsResponse({ insights: [ok, ok, ok, ok] }, request)).toHaveLength(3);
  });

  it('descarta comentário com tom fora da lista, vazio ou longo demais', () => {
    const result = parseInsightsResponse(
      { insights: [ok, { ...ok, tone: 'alegre' }, { ...ok, title: '  ' }, { ...ok, message: 'x'.repeat(241) }] },
      request,
    );
    expect(result).toEqual([ok]);
  });

  it('descarta comentário que cita reais ou percentual que o app não mandou', () => {
    expect(citesOnlyKnownNumbers('Você economizou 23% e gastou 12% a menos.', request)).toBe(true);
    expect(citesOnlyKnownNumbers('Você gastou R$ 900 com mercado.', request)).toBe(false);
    expect(citesOnlyKnownNumbers('Sobrou cerca de 25% da renda.', request)).toBe(false);
    expect(citesOnlyKnownNumbers('Moradia ficou com 35,5 % das despesas.', request)).toBe(false);
    expect(parseInsightsResponse({ insights: [{ ...ok, message: 'Corte 30% dos gastos com lazer.' }] }, request)).toBeNull();
  });

  it('devolve null para formato inválido', () => {
    expect(parseInsightsResponse(null, request)).toBeNull();
    expect(parseInsightsResponse({ insights: 'texto' }, request)).toBeNull();
    expect(parseInsightsResponse({ insights: [] }, request)).toBeNull();
  });
});

describe('montagem do pedido no app', () => {
  const list = [
    transaction({ id: 'salario', type: 'income', amountCents: 500000, categoryId: 'salary' }),
    transaction({ id: 'mercado', amountCents: 30000, categoryId: 'food' }),
    transaction({ id: 'aluguel', amountCents: 90000, categoryId: 'housing' }),
    transaction({ id: 'pendente', amountCents: 70000, status: 'pending' }),
    transaction({ id: 'outubro', amountCents: 100000, date: '2026-10-10' }),
  ];

  it('calcula só percentuais com as mesmas regras dos assistentes locais', () => {
    expect(buildInsightsRequest(list, '2026-11')).toEqual({
      month: '2026-11',
      savingsRatePercent: 76,
      expenseChangePercent: 20,
      categories: [
        { id: 'housing', sharePercent: 75 },
        { id: 'food', sharePercent: 25 },
      ],
      locale: 'pt-BR',
    });
  });

  it('nunca leva centavos, descrições ou contas e passa na validação estrita', () => {
    const built = buildInsightsRequest(list, '2026-11');
    const json = JSON.stringify(built);
    expect(json).not.toMatch(/Cents|Teste|salario|accountId|description/);
    expect(validateInsightsRequest(built).ok).toBe(true);
  });

  it('sem base de comparação ou sem receitas usa null; mês vazio não gera pedido', () => {
    const onlyExpense = buildInsightsRequest([transaction({ amountCents: 5000 })], '2026-11');
    expect(onlyExpense).toMatchObject({ savingsRatePercent: null, expenseChangePercent: null });
    expect(buildInsightsRequest(list, '2026-09')).toBeNull();
  });
});
