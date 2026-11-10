import { describe, expect, it } from 'vitest';
import { dueDateIn, firstDueMonth, installmentsFor, nextBillOccurrence, sanitizeBills, validateBillDraft } from './bills';
import { detectRecurring } from './recurring';
import type { PlannedBill, PlannedBillDraft, Transaction } from './types';

const TODAY = '2026-11-10';

function bill(patch: Partial<PlannedBill> = {}): PlannedBill {
  return {
    id: 'b1',
    description: 'Aluguel',
    amountCents: 150000,
    dueDay: 5,
    categoryId: 'housing',
    kind: 'fixed',
    startMonth: '2026-11',
    createdAt: '2026-11-01T12:00:00.000Z',
    ...patch,
  };
}

describe('vencimentos', () => {
  it('segura o fim do mês e escolhe o primeiro vencimento a partir de hoje', () => {
    expect(dueDateIn('2027-02', 31)).toBe('2027-02-28');
    expect(firstDueMonth(15, TODAY)).toBe('2026-11');
    expect(firstDueMonth(10, TODAY)).toBe('2026-11');
    expect(firstDueMonth(5, TODAY)).toBe('2026-12');
  });

  it('conta fixa: próximo vencimento depois de hoje, sem fim', () => {
    expect(nextBillOccurrence(bill(), TODAY)).toEqual({ date: '2026-12-05' });
    expect(nextBillOccurrence(bill({ dueDay: 20 }), TODAY)).toEqual({ date: '2026-11-20' });
    expect(nextBillOccurrence(bill(), '2027-06-01')).toEqual({ date: '2027-06-05' });
  });

  it('empréstimo: conta as parcelas que faltam e termina', () => {
    const loan = bill({ kind: 'loan', dueDay: 20, startMonth: '2026-11', installments: 3 });
    expect(nextBillOccurrence(loan, TODAY)).toEqual({ date: '2026-11-20', remaining: 3 });
    expect(nextBillOccurrence(loan, '2026-12-21')).toEqual({ date: '2027-01-20', remaining: 1 });
    expect(nextBillOccurrence(loan, '2027-01-21')).toBeNull();
  });

  it('editar "faltam N" recalcula o total desde o início', () => {
    expect(installmentsFor('2026-09', 20, 4, TODAY)).toBe(6);
    expect(installmentsFor('2026-11', 20, 4, TODAY)).toBe(4);
  });
});

describe('validateBillDraft', () => {
  const draft: PlannedBillDraft = { description: 'Luz', amountCents: 18000, dueDay: 10, categoryId: 'housing', kind: 'fixed', startMonth: '2026-11' };

  it('aceita uma conta válida e recusa os erros comuns', () => {
    expect(validateBillDraft(draft)).toBeNull();
    expect(validateBillDraft({ ...draft, description: ' ' })).toMatch(/nome/);
    expect(validateBillDraft({ ...draft, amountCents: 0 })).toMatch(/valor/);
    expect(validateBillDraft({ ...draft, dueDay: 32 })).toMatch(/dia/);
    expect(validateBillDraft({ ...draft, kind: 'loan' })).toMatch(/parcelas/);
    expect(validateBillDraft({ ...draft, kind: 'loan', installments: 12 })).toBeNull();
  });
});

describe('sanitizeBills', () => {
  it('descarta o que não tem a forma de uma conta prevista', () => {
    expect(sanitizeBills('x')).toEqual([]);
    expect(sanitizeBills([bill(), { id: 'b2' }, null, bill({ id: 'b3', startMonth: '11/2026' })])).toEqual([bill()]);
  });
});

describe('detectRecurring com contas previstas', () => {
  function paid(date: string): Transaction {
    return {
      id: `t-${date}`,
      description: 'ALUGUEL 123',
      amountCents: 150000,
      type: 'expense',
      date,
      categoryId: 'housing',
      accountId: 'acc',
      status: 'completed',
      createdAt: `${date}T12:00:00.000Z`,
    };
  }

  it('entra no total, e a mesma despesa detectada não conta de novo', () => {
    const result = detectRecurring([paid('2026-09-05'), paid('2026-10-05'), paid('2026-11-05')], TODAY, [bill()]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ source: 'planned', billId: 'b1', nextDate: '2026-12-05', monthlyCents: 150000 });
    expect(result.monthlyTotalCents).toBe(150000);
  });

  it('empréstimo terminado sai da lista', () => {
    const done = bill({ kind: 'loan', startMonth: '2026-01', installments: 3 });
    expect(detectRecurring([], TODAY, [done]).items).toEqual([]);
    const open = bill({ kind: 'loan', startMonth: '2026-11', dueDay: 20, installments: 2 });
    expect(detectRecurring([], TODAY, [open]).items[0]).toMatchObject({ remaining: 2, nextDate: '2026-11-20' });
  });
});
