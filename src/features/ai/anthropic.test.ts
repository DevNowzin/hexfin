import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { requestInsights } from './anthropic';
import { insightsResponseSchema } from './insights';
import type { InsightsRequest } from './types';

const request: InsightsRequest = {
  month: '2026-11',
  savingsRatePercent: 23,
  expenseChangePercent: null,
  categories: [{ id: 'food', sharePercent: 40 }],
  locale: 'pt-BR',
};

function fakeClient(response: unknown) {
  const create = vi.fn().mockResolvedValue(response);
  const client = { beta: { messages: { create } } } as unknown as Anthropic;
  return { client, create };
}

function textResponse(body: unknown, stop_reason = 'end_turn') {
  return { stop_reason, content: [{ type: 'text', text: JSON.stringify(body) }] };
}

describe('requestInsights (cliente falso, sem chave real)', () => {
  it('pede saída estruturada com esforço baixo, fallback e só percentuais na mensagem', async () => {
    const { client, create } = fakeClient(
      textResponse({ insights: [{ title: 'Boa margem', message: 'Sobrou 23% da renda.', tone: 'positive' }] }),
    );
    const insights = await requestInsights(client, 'claude-opus-5-5', request);
    expect(insights).toEqual([{ title: 'Boa margem', message: 'Sobrou 23% da renda.', tone: 'positive' }]);

    const params = create.mock.calls[0]![0];
    expect(params).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: insightsResponseSchema } },
    });
    const userMessage = params.messages[0].content as string;
    expect(userMessage).toContain('Alimentação: 40%');
    expect(userMessage).not.toMatch(/R\$|Cents/);
  });

  it('o esquema não usa limites que a saída estruturada não aceita', () => {
    expect(JSON.stringify(insightsResponseSchema)).not.toMatch(/maxLength|minLength|maxItems|minItems|minimum|maximum/);
  });

  it('recusa, resposta cortada e comentários inválidos viram erros conhecidos', async () => {
    await expect(requestInsights(fakeClient(textResponse({}, 'refusal')).client, 'claude-opus-5-5', request)).rejects.toMatchObject({ code: 'refused' });
    await expect(requestInsights(fakeClient(textResponse({}, 'max_tokens')).client, 'claude-opus-5-5', request)).rejects.toMatchObject({ code: 'invalid_response' });
    const invented = textResponse({ insights: [{ title: 'Corte gastos', message: 'Corte 30% do lazer.', tone: 'warning' }] });
    await expect(requestInsights(fakeClient(invented).client, 'claude-opus-5-5', request)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('modelos sem fallback padrão não mandam o beta', async () => {
    const { client, create } = fakeClient(textResponse({ insights: [{ title: 'Ok', message: 'Tudo certo.', tone: 'neutral' }] }));
    await requestInsights(client, 'claude-haiku-5-5', request);
    expect(create.mock.calls[0]![0]).not.toHaveProperty('fallbacks');
  });
});
