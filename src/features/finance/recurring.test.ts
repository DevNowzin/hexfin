import { describe, expect, it } from 'vitest';
import { addMonths, detectRecurring, getUpcoming, seriesKey } from './recurring';
import type { Transaction } from './types';

let next = 0;
function expense(date: string, description: string, amountCents: number, patch: Partial<Transaction> = {}): Transaction {
  next += 1;
  return {
    id: `t${next}`,
    description,
    amountCents,
    type: 'expense',
    date,
    categoryId: 'subscriptions',
    accountId: 'acc',
    status: 'completed',
    createdAt: `${date}T12:00:00.000Z`,
    ...patch,
  };
}

const TODAY = '2026-11-10';

describe('addMonths e seriesKey', () => {
  it('soma meses e segura o fim do mês', () => {
    expect(addMonths('2026-11-05', 1)).toBe('2026-12-05');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 2)).toBe('2027-02-15');
  });

  it('ignora números, pontuação, acento e caixa', () => {
    expect(seriesKey('NETFLIX.COM 8213')).toBe(seriesKey('Netflix.com 9921'));
    expect(seriesKey('Academia Ação')).toBe('academia acao');
  });
});

describe('detectRecurring', () => {
  it('detecta a mesma despesa com valor parecido em meses seguidos', () => {
    const { items, monthlyTotalCents } = detectRecurring(
      [expense('2026-09-05', 'NETFLIX.COM 111', 5590), expense('2026-10-05', 'NETFLIX.COM 222', 5590), expense('2026-11-05', 'Netflix.com 333', 5990)],
      TODAY,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'detected', cadence: 'monthly', typicalCents: 5590, occurrences: 3, lastDate: '2026-11-05', nextDate: '2026-12-05' });
    expect(monthlyTotalCents).toBe(5590);
  });

  it('não detecta valor muito diferente, um mês só, meses separados ou série parada', () => {
    expect(detectRecurring([expense('2026-10-05', 'Loja X', 10000), expense('2026-11-05', 'Loja X', 20000)], TODAY).items).toEqual([]);
    expect(detectRecurring([expense('2026-11-01', 'Academia', 9000), expense('2026-11-08', 'Academia', 9000)], TODAY).items).toEqual([]);
    expect(detectRecurring([expense('2026-07-05', 'Seguro', 9000), expense('2026-09-05', 'Seguro', 9000)], TODAY).items).toEqual([]);
    expect(detectRecurring([expense('2026-08-05', 'Revista', 1500), expense('2026-09-05', 'Revista', 1500)], TODAY).items).toEqual([]);
  });

  it('gasto do dia a dia (mais de 2 por mês) não é conta fixa', () => {
    const coffee = ['2026-10-02', '2026-10-09', '2026-10-16', '2026-11-03', '2026-11-06'].map((date) => expense(date, 'Padaria', 800));
    expect(detectRecurring(coffee, TODAY).items).toEqual([]);
  });

  it('parcela, pagamento de fatura, aporte, pendente, futuro e receita ficam de fora', () => {
    const list = [
      expense('2026-10-05', 'Loja (2/10)', 10000), expense('2026-11-05', 'Loja (3/10)', 10000),
      expense('2026-10-06', 'Pagamento de fatura', 50000, { billPayment: true }), expense('2026-11-06', 'Pagamento de fatura', 50000, { billPayment: true }),
      expense('2026-10-07', 'Aporte', 20000, { transferAccountId: 'inv' }), expense('2026-11-07', 'Aporte', 20000, { transferAccountId: 'inv' }),
      expense('2026-10-08', 'Pendente', 3000, { status: 'pending' }), expense('2026-11-08', 'Pendente', 3000, { status: 'pending' }),
      expense('2026-10-09', 'Futuro', 3000), expense('2026-11-20', 'Futuro', 3000),
      expense('2026-10-01', 'Salário', 500000, { type: 'income' }), expense('2026-11-01', 'Salário', 500000, { type: 'income' }),
    ];
    expect(detectRecurring(list, TODAY).items).toEqual([]);
  });

  it('marcada por você: vale o último valor de cada série, uma vez só', () => {
    const { items, monthlyTotalCents } = detectRecurring(
      [expense('2026-09-10', 'Aluguel', 150000, { recurrence: 'monthly' }), expense('2026-10-10', 'Aluguel', 160000, { recurrence: 'monthly' })],
      TODAY,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'manual', typicalCents: 160000, nextDate: '2026-11-10' });
    expect(monthlyTotalCents).toBe(160000);
  });

  it('semanal e anual viram valor por mês', () => {
    const { items, monthlyTotalCents } = detectRecurring(
      [expense('2026-11-03', 'Feira', 6000, { recurrence: 'weekly' }), expense('2026-03-01', 'IPVA', 120000, { recurrence: 'yearly' })],
      TODAY,
    );
    expect(items.map((item) => [item.description, item.monthlyCents, item.nextDate])).toEqual([
      ['Feira', 26000, '2026-11-10'],
      ['IPVA', 10000, '2027-03-01'],
    ]);
    expect(monthlyTotalCents).toBe(36000);
  });
});

describe('getUpcoming', () => {
  it('lista só o que tem data depois de hoje, do mais próximo ao mais distante', () => {
    const list = [expense('2026-12-05', 'Parcela', 1000), expense('2026-11-20', 'Agendado', 2000), expense('2026-11-10', 'Hoje', 3000), expense('2026-11-25', 'Fatura', 9000, { billPayment: true })];
    expect(getUpcoming(list, TODAY).map((item) => item.description)).toEqual(['Agendado', 'Parcela']);
  });
});
