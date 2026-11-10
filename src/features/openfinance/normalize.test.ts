import { describe, expect, it } from 'vitest';
import {
  addDays,
  billDatesFor,
  billStatusFor,
  billMonthFor,
  finalizeCardTransactions,
  normalizeAccount,
  normalizeLoan,
  normalizeTransaction,
  parseItemIds,
  placeInstallments,
  pluggyDateToLocal,
  toCents,
  validateOpenFinanceSettings,
} from './normalize';

const UUID_A = '11111111-2222-3333-4444-555555555555';
const UUID_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('toCents', () => {
  it('converte reais com casas decimais sem erro de arredondamento', () => {
    expect(toCents(142.41)).toBe(14241);
    expect(toCents(-212.45)).toBe(-21245);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1500)).toBe(150000);
  });

  it('recusa valor ausente, infinito ou absurdo', () => {
    expect(toCents('10')).toBeNull();
    expect(toCents(Number.NaN)).toBeNull();
    expect(toCents(Number.POSITIVE_INFINITY)).toBeNull();
    expect(toCents(2_000_000_000)).toBeNull();
  });
});

describe('pluggyDateToLocal', () => {
  it('converte UTC para o dia em Brasília (UTC−3)', () => {
    expect(pluggyDateToLocal('2026-11-09T03:00:00.000Z')).toBe('2026-11-09');
    expect(pluggyDateToLocal('2026-11-09T02:59:00.000Z')).toBe('2026-11-08');
    expect(pluggyDateToLocal('2026-12-01T01:00:00.000Z')).toBe('2026-11-30');
  });

  it('aceita data simples e recusa texto inválido', () => {
    expect(pluggyDateToLocal('2026-11-09')).toBe('2026-11-09');
    expect(pluggyDateToLocal('ontem')).toBeNull();
    expect(pluggyDateToLocal(undefined)).toBeNull();
  });
});

describe('addDays e parseItemIds', () => {
  it('volta 90 dias atravessando meses e anos', () => {
    expect(addDays('2026-11-10', -90)).toBe('2026-08-12');
    expect(addDays('2026-01-15', -20)).toBe('2025-12-26');
  });

  it('separa por linha, vírgula ou espaço e tira repetidos', () => {
    expect(parseItemIds(` ${UUID_A}\n${UUID_B}, ${UUID_A} ;`)).toEqual([UUID_A, UUID_B]);
    expect(parseItemIds('   ')).toEqual([]);
  });
});

describe('validateOpenFinanceSettings', () => {
  const valid = { clientId: UUID_A, clientSecret: 'segredo-de-teste', itemIds: [UUID_B] };

  it('aceita configuração completa', () => {
    expect(validateOpenFinanceSettings(valid)).toBeNull();
  });

  it('aponta o campo errado', () => {
    expect(validateOpenFinanceSettings({ ...valid, clientId: 'abc' })).toMatch(/Client ID/);
    expect(validateOpenFinanceSettings({ ...valid, clientSecret: '' })).toMatch(/Client Secret/);
    expect(validateOpenFinanceSettings({ ...valid, itemIds: [] })).toMatch(/Item ID/);
    expect(validateOpenFinanceSettings({ ...valid, itemIds: ['nao-e-uuid'] })).toMatch(/Item ID inválido/);
  });
});

describe('normalizeAccount', () => {
  it('mapeia corrente, poupança e cartão', () => {
    expect(normalizeAccount({ id: 'a1', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta', balance: 1234.56, currencyCode: 'BRL' }, UUID_A, 'Banco X'))
      .toEqual({ externalId: 'pluggy:a1', itemId: UUID_A, kind: 'checking', name: 'Conta', institution: 'Banco X', bankBalanceCents: 123456 });
    expect(normalizeAccount({ id: 'a2', type: 'BANK', subtype: 'SAVINGS_ACCOUNT', balance: 10 }, UUID_A, 'Banco X')?.kind).toBe('savings');
    const card = normalizeAccount({ id: 'a3', type: 'CREDIT', marketingName: 'Cartão Roxo', name: 'x', balance: 142.41 }, UUID_A, 'Banco X');
    expect(card).toMatchObject({ kind: 'credit', name: 'Cartão Roxo', bankBalanceCents: 14241 });
  });

  it('descarta formato inesperado e moeda estrangeira', () => {
    expect(normalizeAccount({ id: 'a1', type: 'BANK', balance: 'x' }, UUID_A, 'B')).toBeNull();
    expect(normalizeAccount({ id: 'a1', type: 'OUTRO', balance: 1 }, UUID_A, 'B')).toBeNull();
    expect(normalizeAccount({ id: 'a1', type: 'BANK', balance: 1, currencyCode: 'USD' }, UUID_A, 'B')).toBeNull();
    expect(normalizeAccount(null, UUID_A, 'B')).toBeNull();
  });
});

describe('normalizeTransaction', () => {
  const base = { id: 't1', description: 'Mercado', amount: -50.5, type: 'DEBIT', date: '2026-11-05T15:00:00.000Z', status: 'POSTED' };

  it('na conta usa o type para o sentido, não o sinal', () => {
    expect(normalizeTransaction(base, 'checking')).toMatchObject({ direction: 'out', amountCents: 5050, date: '2026-11-05', status: 'completed', billPayment: false });
    expect(normalizeTransaction({ ...base, amount: 50.5, type: 'DEBIT' }, 'checking')?.direction).toBe('out');
    expect(normalizeTransaction({ ...base, amount: 3000, type: 'CREDIT', description: 'Salário' }, 'checking')?.direction).toBe('in');
  });

  it('no cartão, positivo é compra e negativo é pagamento ou estorno', () => {
    expect(normalizeTransaction({ ...base, amount: 80, type: 'DEBIT' }, 'credit')).toMatchObject({ direction: 'out', cardPayment: false });
    expect(normalizeTransaction({ ...base, amount: -500, description: 'Pagamento recebido' }, 'credit')).toMatchObject({ direction: 'in', cardPayment: true });
    expect(normalizeTransaction({ ...base, amount: -30, description: 'Estorno loja' }, 'credit')).toMatchObject({ direction: 'in', cardPayment: false });
  });

  it('reconhece pagamento de fatura pela operação, categoria ou descrição', () => {
    expect(normalizeTransaction({ ...base, description: 'PIX', operationType: 'PAGAMENTO_FATURA' }, 'checking')?.billPayment).toBe(true);
    expect(normalizeTransaction({ ...base, description: 'Débito', category: 'Credit card payment' }, 'checking')?.billPayment).toBe(true);
    expect(normalizeTransaction({ ...base, description: 'Pagamento de fatura' }, 'checking')?.billPayment).toBe(true);
    expect(normalizeTransaction({ ...base, description: 'PAGTO CARTAO CREDITO' }, 'checking')?.billPayment).toBe(true);
    expect(normalizeTransaction({ ...base, description: 'Fatura', type: 'CREDIT', amount: 10 }, 'checking')?.billPayment).toBe(false);
  });

  it('pendente continua pendente e valor zero ou inválido fica de fora', () => {
    expect(normalizeTransaction({ ...base, status: 'PENDING' }, 'checking')?.status).toBe('pending');
    expect(normalizeTransaction({ ...base, amount: 0 }, 'checking')).toBeNull();
    expect(normalizeTransaction({ ...base, date: 'x' }, 'checking')).toBeNull();
    expect(normalizeTransaction({ ...base, id: '' }, 'checking')).toBeNull();
  });
});

describe('normalizeLoan', () => {
  it('usa o saldo devedor do contrato', () => {
    expect(normalizeLoan({ id: 'l1', productName: 'Crédito pessoal', payments: { contractOutstandingBalance: 8450.3 } }, UUID_A, 'Banco X'))
      .toEqual({ externalId: 'pluggy-loan:l1', itemId: UUID_A, name: 'Crédito pessoal', institution: 'Banco X', outstandingCents: 845030 });
  });

  it('sem saldo devedor válido, fica de fora', () => {
    expect(normalizeLoan({ id: 'l1', productName: 'X' }, UUID_A, 'B')).toBeNull();
    expect(normalizeLoan({ id: 'l1', payments: { contractOutstandingBalance: -1 } }, UUID_A, 'B')).toBeNull();
  });
});

describe('fatura do cartão', () => {
  it('lê fechamento e vencimento da fatura aberta', () => {
    const card = normalizeAccount({ id: 'k', type: 'CREDIT', balance: 10, creditData: { balanceCloseDate: '2026-12-03', balanceDueDate: '2026-12-10' } }, UUID_A, 'B');
    expect(card?.billCycle).toEqual({ closeDate: '2026-12-03', dueDate: '2026-12-10' });
    expect(normalizeAccount({ id: 'k', type: 'CREDIT', balance: 10, creditData: { balanceCloseDate: '2026-12-10', balanceDueDate: '2026-12-03' } }, UUID_A, 'B')?.billCycle).toBeUndefined();
    expect(normalizeAccount({ id: 'k', type: 'CREDIT', balance: 10 }, UUID_A, 'B')?.billCycle).toBeUndefined();
  });

  it('compra antes do fechamento vence na fatura do mês; no dia ou depois, na seguinte', () => {
    const cycle = { closeDate: '2026-12-03', dueDate: '2026-12-10' };
    expect(billMonthFor('2026-11-02', cycle)).toBe('2026-11');
    expect(billMonthFor('2026-11-03', cycle)).toBe('2026-12');
    expect(billMonthFor('2026-11-25', cycle)).toBe('2026-12');
    expect(billMonthFor('2026-12-31', cycle)).toBe('2027-01');
  });

  it('vencimento no mês seguinte ao fechamento empurra um mês', () => {
    const cycle = { closeDate: '2026-11-28', dueDate: '2026-12-05' };
    expect(billMonthFor('2026-11-10', cycle)).toBe('2026-12');
    expect(billMonthFor('2026-11-28', cycle)).toBe('2027-01');
  });

  it('fechamento acompanha o vencimento: Nubank fecha dia 29 em outubro e dia 28 em setembro', () => {
    // Fatura aberta informada em novembro: fecha 28/11 e vence 05/12 (7 dias).
    const cycle = { closeDate: '2026-11-28', dueDate: '2026-12-05' };
    expect(billMonthFor('2026-10-28', cycle)).toBe('2026-11');
    expect(billMonthFor('2026-10-29', cycle)).toBe('2026-12');
    expect(billMonthFor('2026-09-27', cycle)).toBe('2026-10');
    expect(billMonthFor('2026-09-28', cycle)).toBe('2026-11');
    expect(billMonthFor('2027-02-25', cycle)).toBe('2027-03');
    expect(billMonthFor('2027-02-26', cycle)).toBe('2027-04');
  });

  it('datas de cada fatura: fecha 7 dias antes do dia 5 e vencimento no fim de semana vai para segunda', () => {
    const cycle = { closeDate: '2026-11-28', dueDate: '2026-12-05' };
    expect(billDatesFor('2026-11', cycle)).toEqual({ closeDate: '2026-10-29', dueDate: '2026-11-05' });
    // 05/12/2026 é sábado: paga na segunda 07/12.
    expect(billDatesFor('2026-12', cycle)).toEqual({ closeDate: '2026-11-28', dueDate: '2026-12-07' });
  });

  it('fatura fechada a pagar e fatura aberta', () => {
    const cycle = { closeDate: '2026-11-28', dueDate: '2026-12-05' };
    expect(billStatusFor('2026-11', cycle, '2026-11-10')).toMatchObject({ closed: true, dueDate: '2026-11-05' });
    expect(billStatusFor('2026-12', cycle, '2026-11-10')).toMatchObject({ closed: false, closeDate: '2026-11-28' });
    expect(billStatusFor('2026-12', cycle, '2026-11-28').closed).toBe(true);
  });

  it('banco com dia fixo de fechamento continua no mesmo dia todo mês', () => {
    const cycle = { closeDate: '2026-11-10', dueDate: '2026-11-20' };
    expect(billMonthFor('2026-10-09', cycle)).toBe('2026-10');
    expect(billMonthFor('2026-10-10', cycle)).toBe('2026-11');
    expect(billMonthFor('2027-02-10', cycle)).toBe('2027-03');
  });
});

describe('parcelas', () => {
  const card = (id: string, raw: Record<string, unknown>) => normalizeTransaction({ id, amount: 100, date: '2026-11-08T15:00:00.000Z', status: 'PENDING', ...raw }, 'credit')!;

  it('lê número, total e data da compra; parcela inválida fica sem parcela', () => {
    expect(card('a', { description: 'Loja', creditCardMetadata: { installmentNumber: 2, totalInstallments: 10, purchaseDate: '2026-10-08T12:00:00.000Z' } }).installment)
      .toEqual({ number: 2, total: 10, purchaseDate: '2026-10-08' });
    expect(card('b', { description: 'Loja', creditCardMetadata: { installmentNumber: 11, totalInstallments: 10 } }).installment).toBeUndefined();
    expect(card('c', { description: 'Loja', creditCardMetadata: { installmentNumber: 1, totalInstallments: 1 } }).installment).toBeUndefined();
  });

  it('parcela com a data da compra vai para o mês dela e ganha (n/N)', () => {
    const list = placeInstallments([
      card('p1', { description: 'Loja Nova', creditCardMetadata: { installmentNumber: 1, totalInstallments: 3 } }),
      card('p2', { description: 'Loja Nova', creditCardMetadata: { installmentNumber: 2, totalInstallments: 3 } }),
      card('p3', { description: 'Loja Nova PARC 03/03', creditCardMetadata: { installmentNumber: 3, totalInstallments: 3 } }),
    ]);
    expect(list.map((item) => [item.description, item.date])).toEqual([
      ['Loja Nova (1/3)', '2026-11-08'],
      ['Loja Nova (2/3)', '2026-12-08'],
      ['Loja Nova PARC 03/03', '2027-01-08'],
    ]);
  });

  it('parcela que o banco já mandou no mês certo não muda', () => {
    const list = placeInstallments([card('x', { description: 'TV', date: '2027-01-05T15:00:00.000Z', creditCardMetadata: { installmentNumber: 3, totalInstallments: 5, purchaseDate: '2026-11-05T12:00:00.000Z' } })]);
    expect(list[0]!.date).toBe('2027-01-05');
  });

  it('no cartão com ciclo conhecido, cada compra recebe o mês da fatura', () => {
    const cycle = { closeDate: '2026-12-03', dueDate: '2026-12-10' };
    const list = finalizeCardTransactions(
      [card('a', { description: 'Mercado' }), card('b', { description: 'Sofá', creditCardMetadata: { installmentNumber: 2, totalInstallments: 2, purchaseDate: '2026-11-08T12:00:00.000Z' } })],
      cycle,
    );
    expect(list.map((item) => [item.date, item.billMonth])).toEqual([
      ['2026-11-08', '2026-12'],
      ['2026-12-08', '2027-01'],
    ]);
    expect(finalizeCardTransactions([card('c', { description: 'Mercado' })], undefined)[0]!.billMonth).toBeUndefined();
  });
});
