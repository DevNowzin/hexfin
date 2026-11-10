import { describe, expect, it } from 'vitest';
import { createSeedData } from './seed';
import {
  dayNumber,
  buildInsights,
  filterActivities,
  findDuplicateCharges,
  getAccountBalance,
  getCashFlow,
  getMonthSummary,
  getSpendingByCategory,
  getTotalBalance,
  getWeeklySummary,
  groupTransactionsByDate,
  normalizeSearchText,
  shiftMonth,
} from './selectors';
import { detectRecurring } from './recurring';
import type { Account, Transaction } from './types';

const reference = new Date(2026, 10, 9, 12);
const data = createSeedData(reference);

function transaction(patch: Partial<Transaction> = {}): Transaction {
  return {
    id: 'test',
    description: 'Teste',
    amountCents: 1000,
    type: 'expense',
    date: '2026-11-09',
    categoryId: 'other',
    accountId: 'account',
    status: 'completed',
    createdAt: '2026-11-09T12:00:00.000Z',
    ...patch,
  };
}

describe('resumo mensal', () => {
  it('separa receitas, despesas e pendências', () => {
    expect(getMonthSummary(data.transactions, '2026-11')).toEqual({
      incomeCents: 975000,
      expenseCents: 369410,
      balanceCents: 605590,
      pendingCents: 14230,
    });
  });

  it('ignora outro mês', () => {
    expect(getMonthSummary(data.transactions, '2030-01')).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
      pendingCents: 0,
    });
  });
});

describe('saldos', () => {
  it('calcula o saldo apenas com transações concluídas da conta', () => {
    const account: Account = {
      id: 'account',
      name: 'Principal',
      institution: 'Banco',
      type: 'checking',
      color: '#000000',
      openingBalanceCents: 5000,
    };
    const transactions = [
      transaction({ id: 'income', type: 'income', amountCents: 2000 }),
      transaction({ id: 'expense', amountCents: 500 }),
      transaction({ id: 'pending', amountCents: 900, status: 'pending' }),
      transaction({ id: 'other-account', accountId: 'other', amountCents: 700 }),
    ];
    expect(getAccountBalance(account, transactions)).toBe(6500);
    expect(getTotalBalance([account], transactions)).toBe(6500);
  });

  it('move o valor entre contas em um aporte sem alterar o consolidado', () => {
    const source: Account = {
      id: 'account',
      name: 'Principal',
      institution: 'Banco',
      type: 'checking',
      color: '#000000',
      openingBalanceCents: 5000,
    };
    const destination: Account = { ...source, id: 'destination', name: 'Investimentos', type: 'investment', openingBalanceCents: 10000 };
    const transfer = transaction({ amountCents: 2500, transferAccountId: destination.id });
    expect(getAccountBalance(source, [transfer])).toBe(2500);
    expect(getAccountBalance(destination, [transfer])).toBe(12500);
    expect(getTotalBalance([source, destination], [transfer])).toBe(15000);
  });
});

describe('categorias e recorrências', () => {
  it('ordena categorias por valor e calcula percentuais', () => {
    const categories = getSpendingByCategory(data.transactions, '2026-11');
    expect(categories[0]?.category.id).toBe('housing');
    expect(categories.find((item) => item.category.id === 'food')?.totalCents).toBe(27130);
    expect(categories.reduce((total, item) => total + item.totalCents, 0)).toBe(369410);
  });

});

describe('períodos e agrupamento', () => {
  it('cruza viradas de ano corretamente', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('retorna seis meses em ordem cronológica', () => {
    const points = getCashFlow(data.transactions, reference);
    expect(points).toHaveLength(6);
    expect(points[0]?.monthKey).toBe('2026-06');
    expect(points[5]?.monthKey).toBe('2026-11');
  });

  it('agrupa e ordena transações por data decrescente', () => {
    const groups = groupTransactionsByDate([
      transaction({ id: 'old', date: '2026-11-01' }),
      transaction({ id: 'new', date: '2026-11-09' }),
      transaction({ id: 'same', date: '2026-11-09' }),
    ]);
    expect(groups.map(([date]) => date)).toEqual(['2026-11-09', '2026-11-01']);
    expect(groups[0]?.[1]).toHaveLength(2);
  });
});

describe('filtro de atividades', () => {
  const list = [
    transaction({ id: 'salario', type: 'income', description: 'Salário' }),
    transaction({ id: 'cafe', description: 'Café da esquina' }),
    transaction({ id: 'luz', description: 'Conta de luz', status: 'pending' }),
    transaction({ id: 'reembolso', type: 'income', description: 'Reembolso', status: 'pending' }),
    transaction({ id: 'outubro', description: 'Café antigo', date: '2026-10-30' }),
  ];
  const ids = (filter: 'all' | 'income' | 'expense' | 'pending', query = '') =>
    filterActivities(list, { monthKey: '2026-11', filter, query }).map((item) => item.id);

  it('"Todas" mostra o mês inteiro, inclusive pendentes', () => {
    expect(ids('all')).toEqual(['salario', 'cafe', 'luz', 'reembolso']);
  });

  it('"Entradas" e "Saídas" mostram só concluídas', () => {
    expect(ids('income')).toEqual(['salario']);
    expect(ids('expense')).toEqual(['cafe']);
  });

  it('"Pendentes" junta entradas e saídas pendentes', () => {
    expect(ids('pending')).toEqual(['luz', 'reembolso']);
  });

  it('busca ignora acentos, maiúsculas e espaços nas pontas', () => {
    expect(ids('all', '  CAFE ')).toEqual(['cafe']);
    expect(ids('all', 'salario')).toEqual(['salario']);
    expect(ids('expense', 'luz')).toEqual([]);
  });

  it('normaliza texto para busca', () => {
    expect(normalizeSearchText(' Pão de Açúcar ')).toBe('pao de acucar');
  });
});

describe('cobrança repetida', () => {
  const charge = (id: string, date: string, patch: Partial<Transaction> = {}) =>
    transaction({ id, date, description: 'Streaming Plus', amountCents: 3990, createdAt: `${date}T10:00:00.000Z`, ...patch });
  // Hoje fixo no fim do mês: as datas dos casos já passaram.
  const ids = (list: Transaction[], monthKey = '2026-11') => findDuplicateCharges(list, monthKey, 3, '2026-11-30').map((item) => item.transactionIds);

  it('conta dias corridos sem passar por UTC, inclusive na virada do mês', () => {
    expect(dayNumber('2026-11-01') - dayNumber('2026-10-31')).toBe(1);
    expect(dayNumber('2026-11-12') - dayNumber('2026-11-09')).toBe(3);
  });

  it('acha a mesma cobrança no mesmo dia e a até 3 dias', () => {
    expect(ids([charge('a', '2026-11-09'), charge('b', '2026-11-09')])).toEqual([['a', 'b']]);
    expect(ids([charge('a', '2026-11-09'), charge('b', '2026-11-12')])).toEqual([['a', 'b']]);
  });

  it('ignora 4 dias de distância, valor diferente, pendente e aporte', () => {
    expect(ids([charge('a', '2026-11-09'), charge('b', '2026-11-13')])).toEqual([]);
    expect(ids([charge('a', '2026-11-09'), charge('b', '2026-11-10', { amountCents: 3999 })])).toEqual([]);
    expect(ids([charge('a', '2026-11-09'), charge('b', '2026-11-10', { status: 'pending' })])).toEqual([]);
    expect(ids([charge('a', '2026-11-09', { transferAccountId: 'x' }), charge('b', '2026-11-10', { transferAccountId: 'x' })])).toEqual([]);
  });

  it('ignora receitas iguais', () => {
    expect(ids([charge('a', '2026-11-09', { type: 'income' }), charge('b', '2026-11-09', { type: 'income' })])).toEqual([]);
  });

  it('compara a descrição sem acentos, maiúsculas e espaços extras', () => {
    expect(ids([charge('a', '2026-11-09'), charge('b', '2026-11-10', { description: '  streaming   PLUS ' })])).toEqual([['a', 'b']]);
  });

  it('pega a virada do mês, mas não casos só de meses anteriores', () => {
    expect(ids([charge('a', '2026-10-30'), charge('b', '2026-11-01')])).toEqual([['a', 'b']]);
    expect(ids([charge('a', '2026-10-10'), charge('b', '2026-10-11')])).toEqual([]);
  });

  it('devolve o caso mais recente primeiro, com descrição, valor e datas', () => {
    const result = findDuplicateCharges(
      [charge('a', '2026-11-02'), charge('b', '2026-11-03'), charge('c', '2026-11-20', { description: 'Mercado' }), charge('d', '2026-11-20', { description: 'Mercado' })],
      '2026-11',
      3,
      '2026-11-30',
    );
    expect(result.map((item) => item.description)).toEqual(['Mercado', 'Streaming Plus']);
    expect(result[1]).toMatchObject({ amountCents: 3990, dates: ['2026-11-02', '2026-11-03'] });
  });
});

describe('resumo da semana', () => {
  const spend = (id: string, date: string, amountCents: number, categoryId = 'food', patch: Partial<Transaction> = {}) =>
    transaction({ id, date, amountCents, categoryId, ...patch });

  it('sem gasto nos últimos 7 dias não mostra nada', () => {
    expect(getWeeklySummary([], '2026-11-09')).toBeNull();
    expect(getWeeklySummary([spend('sete', '2026-11-02', 1000)], '2026-11-09')).toBeNull();
  });

  it('separa hoje e os 6 dias anteriores dos 7 antes deles e ignora o resto', () => {
    const list = [
      spend('hoje', '2026-11-09', 1000),
      spend('seis', '2026-11-03', 2000),
      spend('sete', '2026-11-02', 4000),
      spend('treze', '2026-10-27', 8000),
      spend('catorze', '2026-10-26', 16000),
      spend('futuro', '2026-11-10', 32000),
      spend('pendente', '2026-11-08', 64000, 'food', { status: 'pending' }),
      spend('receita', '2026-11-08', 128000, 'salary', { type: 'income' }),
    ];
    expect(getWeeklySummary(list, '2026-11-09')).toMatchObject({ currentCents: 3000, previousCents: 12000 });
  });

  it('aponta a categoria que mais pesou na semana', () => {
    const list = [spend('a', '2026-11-08', 1000, 'food'), spend('b', '2026-11-07', 1500, 'transport'), spend('c', '2026-11-06', 900, 'food')];
    expect(getWeeklySummary(list, '2026-11-09')?.topCategory.id).toBe('food');
  });

  it('atravessa a virada do mês sem UTC', () => {
    expect(getWeeklySummary([spend('a', '2026-10-28', 500)], '2026-11-03')).toMatchObject({ currentCents: 500, previousCents: 0 });
  });
});

describe('mensagens dos assistentes novos', () => {
  const finance = (transactions: Transaction[], hideBalances = false) => ({
    accounts: [],
    transactions,
    profile: { name: '', hideBalances, theme: 'system' as const },
  });
  const repeated = [
    transaction({ id: 'a', date: '2026-11-08', description: 'Streaming', amountCents: 3990 }),
    transaction({ id: 'b', date: '2026-11-09', description: 'Streaming', amountCents: 3990 }),
  ];

  it('resumo da semana compara com a semana anterior e só aparece no mês de hoje', () => {
    const list = [transaction({ id: 'a', date: '2026-11-08', amountCents: 11000 }), transaction({ id: 'b', date: '2026-11-01', amountCents: 10000 })];
    const week = buildInsights(finance(list), '2026-11', '2026-11-09').find((item) => item.id === 'weekly-summary');
    expect(week).toMatchObject({ title: 'Semana mais cara', tone: 'warning' });
    expect(week?.description).toContain('10% a mais que na semana anterior');
    expect(buildInsights(finance(list), '2026-10', '2026-11-09').some((item) => item.id === 'weekly-summary')).toBe(false);
  });

  it('cobrança repetida mostra descrição, valor e quantas vezes', () => {
    const duplicate = buildInsights(finance(repeated), '2026-11', '2026-11-09').find((item) => item.id === 'duplicate-charges');
    expect(duplicate?.tone).toBe('warning');
    expect(duplicate?.description).toContain('"Streaming" de R$');
    expect(duplicate?.description).toContain('2 vezes');
  });

  it('com valores ocultos nenhuma mensagem mostra R$', () => {
    const insights = buildInsights(finance(repeated, true), '2026-11', '2026-11-09');
    expect(insights.map((item) => item.id)).toEqual(expect.arrayContaining(['duplicate-charges', 'weekly-summary']));
    for (const item of insights) expect(item.description).not.toContain('R$');
  });
});

describe('dívidas e pagamento de fatura (Open Finance)', () => {
  const card: Account = { id: 'card', name: 'Cartão', institution: 'Banco', type: 'credit', color: '#EC4899', openingBalanceCents: -50000 };
  const loan: Account = { id: 'loan', name: 'Empréstimo', institution: 'Banco', type: 'loan', color: '#F97316', openingBalanceCents: -900000 };
  const checking: Account = { id: 'checking', name: 'Conta', institution: 'Banco', type: 'checking', color: '#8B7CFF', openingBalanceCents: 200000 };
  const purchase = transaction({ id: 'buy', accountId: 'card', amountCents: 8000, categoryId: 'food', description: 'Restaurante' });
  const billPayment = transaction({ id: 'pay', accountId: 'checking', transferAccountId: 'card', billPayment: true, amountCents: 50000, description: 'Pagamento de fatura' });

  it('saldo total ignora cartão e empréstimo; o saldo de cada um continua negativo', () => {
    expect(getTotalBalance([checking, card, loan], [])).toBe(200000);
    expect(getAccountBalance(card, [])).toBe(-50000);
    expect(getAccountBalance(loan, [])).toBe(-900000);
  });

  it('pagar a fatura tira da conta e abate a dívida do cartão', () => {
    expect(getAccountBalance(checking, [billPayment])).toBe(150000);
    expect(getAccountBalance(card, [billPayment, purchase])).toBe(-8000);
  });

  it('a fatura não entra em resumo, categorias, recorrências nem resumo da semana', () => {
    const items = [purchase, billPayment, transaction({ ...billPayment, id: 'pay-rec', recurrence: 'monthly' })];
    expect(getMonthSummary(items, '2026-11').expenseCents).toBe(8000);
    expect(getSpendingByCategory(items, '2026-11').map((item) => [item.category.id, item.totalCents])).toEqual([['food', 8000]]);
    expect(detectRecurring(items, '2026-11-09').monthlyTotalCents).toBe(0);
    expect(getWeeklySummary(items, '2026-11-09')?.currentCents).toBe(8000);
  });
});

describe('datas futuras e mês da fatura', () => {
  const account: Account = { id: 'account', name: 'Conta', institution: 'Banco', type: 'checking', color: '#8B7CFF', openingBalanceCents: 100000 };
  const future = transaction({ id: 'future', date: '2026-11-25', amountCents: 30000, description: 'Aluguel agendado' });
  const past = transaction({ id: 'past', date: '2026-11-05', amountCents: 5000 });

  it('data depois de hoje não mexe no saldo até o dia chegar', () => {
    expect(getAccountBalance(account, [future, past], '2026-11-10')).toBe(95000);
    expect(getAccountBalance(account, [future, past], '2026-11-25')).toBe(65000);
  });

  it('no resumo do mês, o futuro fica em pendente e não em despesas', () => {
    expect(getMonthSummary([future, past], '2026-11', '2026-11-10')).toEqual({ incomeCents: 0, expenseCents: 5000, balanceCents: -5000, pendingCents: 30000 });
    expect(getSpendingByCategory([future, past], '2026-11', '2026-11-10').map((item) => item.totalCents)).toEqual([5000]);
  });

  it('compra de cartão conta no mês da fatura, não no da data', () => {
    const card = transaction({ id: 'card', date: '2026-11-08', billMonth: '2026-12', amountCents: 7000 });
    expect(getMonthSummary([card], '2026-11', '2026-12-20').expenseCents).toBe(0);
    expect(getMonthSummary([card], '2026-12', '2026-12-20').expenseCents).toBe(7000);
    expect(filterActivities([card], { monthKey: '2026-12', filter: 'all', today: '2026-12-20' }).map((item) => item.id)).toEqual(['card']);
    expect(filterActivities([card], { monthKey: '2026-11', filter: 'all', today: '2026-12-20' })).toEqual([]);
  });

  it('em Atividades, o futuro aparece em Pendentes e não em Saídas', () => {
    const options = { monthKey: '2026-11', today: '2026-11-10' };
    expect(filterActivities([future, past], { ...options, filter: 'pending' }).map((item) => item.id)).toEqual(['future']);
    expect(filterActivities([future, past], { ...options, filter: 'expense' }).map((item) => item.id)).toEqual(['past']);
  });
});
