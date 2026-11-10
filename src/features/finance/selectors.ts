import { formatCurrency, formatTransactionDate, parseLocalDate, toDateInput } from '@/utils/format';
import { CATEGORIES, getCategory } from './categories';
import { detectRecurring } from './recurring';
import { type MoneyScope, scopeOf } from './scope';
import type {
  Account,
  CashFlowPoint,
  CategoryTotal,
  FinanceData,
  MonthSummary,
  Transaction,
} from './types';

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const dateComparison = b.date.localeCompare(a.date);
    return dateComparison || b.createdAt.localeCompare(a.createdAt);
  });
}

/** Mês em que a transação conta: o da fatura (cartão do Open Finance) ou o da data. */
export function transactionMonth(transaction: Transaction): string {
  return transaction.billMonth ?? transaction.date.slice(0, 7);
}

/** Já aconteceu: concluída e com data até hoje. Agendados e parcelas futuras só contam quando o dia chega. */
export function isEffective(transaction: Transaction, today: string): boolean {
  return transaction.status === 'completed' && transaction.date <= today;
}

export function getAccountBalance(account: Account, transactions: Transaction[], today = toDateInput()): number {
  return transactions.reduce((balance, transaction) => {
    if (!isEffective(transaction, today)) return balance;
    let nextBalance = balance;
    if (transaction.accountId === account.id) {
      nextBalance += transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents;
    }
    if (transaction.transferAccountId === account.id && transaction.transferAccountId !== transaction.accountId) {
      nextBalance += transaction.amountCents;
    }
    return nextBalance;
  }, account.openingBalanceCents);
}

/** Cartão de crédito e empréstimo são dívidas: aparecem com saldo negativo, mas não entram no "saldo em contas". */
export function isLiability(account: Pick<Account, 'type'>): boolean {
  return account.type === 'credit' || account.type === 'loan';
}

/** Pagamento de fatura só move dinheiro para o cartão: as compras já contaram como gasto. */
export function countsAsFlow(transaction: Transaction): boolean {
  return !transaction.billPayment;
}

export function getTotalBalance(accounts: Account[], transactions: Transaction[], today = toDateInput()): number {
  return accounts.reduce((total, account) => (isLiability(account) ? total : total + getAccountBalance(account, transactions, today)), 0);
}

/** Pendentes e com data futura vão para `pendingCents` e não entram em receitas e despesas. */
export function getMonthSummary(transactions: Transaction[], monthKey: string, today = toDateInput()): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let pendingCents = 0;

  for (const transaction of transactions) {
    if (transactionMonth(transaction) !== monthKey || !countsAsFlow(transaction)) continue;
    if (!isEffective(transaction, today)) {
      pendingCents += transaction.type === 'expense' ? transaction.amountCents : 0;
      continue;
    }
    if (transaction.type === 'income') incomeCents += transaction.amountCents;
    else expenseCents += transaction.amountCents;
  }

  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, pendingCents };
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return shifted.toISOString().slice(0, 7);
}

export function getCurrentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getCashFlow(transactions: Transaction[], reference = new Date(), months = 6): CashFlowPoint[] {
  const currentMonth = getCurrentMonthKey(reference);
  return Array.from({ length: months }, (_, index) => {
    const monthKey = shiftMonth(currentMonth, index - months + 1);
    const [year = 1970, month = 1] = monthKey.split('-').map(Number);
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
      .format(new Date(year, month - 1, 1))
      .replace('.', '')
      .slice(0, 3);
    return { monthKey, label, ...getMonthSummary(transactions, monthKey, toDateInput(reference)) };
  });
}

export function getSpendingByCategory(transactions: Transaction[], monthKey: string, today = toDateInput()): CategoryTotal[] {
  const totals = new Map<string, { totalCents: number; transactionCount: number }>();
  let monthExpenses = 0;

  for (const transaction of transactions) {
    if (
      transaction.type !== 'expense' ||
      !isEffective(transaction, today) ||
      transactionMonth(transaction) !== monthKey ||
      !countsAsFlow(transaction)
    ) continue;
    const current = totals.get(transaction.categoryId) ?? { totalCents: 0, transactionCount: 0 };
    current.totalCents += transaction.amountCents;
    current.transactionCount += 1;
    totals.set(transaction.categoryId, current);
    monthExpenses += transaction.amountCents;
  }

  return CATEGORIES.map((category) => {
    const total = totals.get(category.id);
    return {
      category,
      totalCents: total?.totalCents ?? 0,
      transactionCount: total?.transactionCount ?? 0,
      percentage: monthExpenses > 0 ? ((total?.totalCents ?? 0) / monthExpenses) * 100 : 0,
    };
  })
    .filter((item) => item.totalCents > 0)
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function groupTransactionsByDate(transactions: Transaction[]): Array<[string, Transaction[]]> {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of sortTransactions(transactions)) {
    const group = groups.get(transaction.date) ?? [];
    group.push(transaction);
    groups.set(transaction.date, group);
  }
  return [...groups.entries()];
}

export interface EstablishmentTotal {
  description: string;
  totalCents: number;
  count: number;
  category: ReturnType<typeof getCategory>;
}

export function getTopEstablishments(transactions: Transaction[], monthKey: string, today = toDateInput()): EstablishmentTotal[] {
  const totals = new Map<string, EstablishmentTotal>();
  for (const transaction of transactions) {
    if (
      transaction.type !== 'expense' ||
      !isEffective(transaction, today) ||
      transactionMonth(transaction) !== monthKey ||
      !countsAsFlow(transaction)
    ) continue;
    const key = transaction.description.trim().toLocaleLowerCase('pt-BR');
    const current = totals.get(key) ?? {
      description: transaction.description,
      totalCents: 0,
      count: 0,
      category: getCategory(transaction.categoryId),
    };
    current.totalCents += transaction.amountCents;
    current.count += 1;
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => b.totalCents - a.totalCents);
}

export interface FinanceInsight {
  id: string;
  icon: string;
  title: string;
  description: string;
  tone: 'positive' | 'warning' | 'neutral';
}

function describeWeek(week: WeeklySummary, hideValues: boolean): FinanceInsight {
  const variation = week.previousCents > 0 ? Math.round(((week.currentCents - week.previousCents) / week.previousCents) * 100) : null;
  const percent = Math.abs(variation ?? 0);
  let sentence: string;
  if (hideValues) {
    sentence =
      variation === null ? 'Você teve gastos nos últimos 7 dias'
      : variation === 0 ? 'Seus gastos dos últimos 7 dias ficaram iguais aos da semana anterior'
      : `Seus gastos dos últimos 7 dias ficaram ${percent}% ${variation > 0 ? 'acima' : 'abaixo'} da semana anterior`;
  } else {
    const versus =
      variation === null ? ''
      : variation === 0 ? ', o mesmo que na semana anterior'
      : `, ${percent}% ${variation > 0 ? 'a mais' : 'a menos'} que na semana anterior`;
    sentence = `Você gastou ${formatCurrency(week.currentCents)} nos últimos 7 dias${versus}`;
  }
  const up = variation !== null && variation > 0;
  const down = variation !== null && variation < 0;
  return {
    id: 'weekly-summary',
    icon: 'calendar-outline',
    title: up ? 'Semana mais cara' : down ? 'Semana mais leve' : 'Resumo da semana',
    description: `${sentence}. ${week.topCategory.name} foi o que mais pesou.`,
    tone: up ? 'warning' : down ? 'positive' : 'neutral',
  };
}

/** `today` em `YYYY-MM-DD`; o resumo da semana só aparece no mês de hoje. */
export function buildInsights(data: FinanceData, monthKey: string, today = toDateInput()): FinanceInsight[] {
  const current = getMonthSummary(data.transactions, monthKey, today);
  const previous = getMonthSummary(data.transactions, shiftMonth(monthKey, -1), today);
  const categories = getSpendingByCategory(data.transactions, monthKey, today);
  const insights: FinanceInsight[] = [];

  const duplicates = findDuplicateCharges(data.transactions, monthKey, 3, today);
  const duplicate = duplicates[0];
  if (duplicate) {
    const value = data.profile.hideBalances ? '' : ` de ${formatCurrency(duplicate.amountCents)}`;
    const others = duplicates.length - 1;
    insights.push({
      id: 'duplicate-charges',
      icon: 'copy-outline',
      title: 'Possível cobrança repetida',
      description:
        `"${duplicate.description}"${value} aparece ${duplicate.dates.length} vezes (${duplicate.dates.map(formatTransactionDate).join(', ')}). Confira se não foi cobrado em dobro.` +
        (others > 0 ? ` Há mais ${others} ${others === 1 ? 'caso' : 'casos'} no mês.` : ''),
      tone: 'warning',
    });
  }

  if (current.incomeCents > 0) {
    const savingsRate = Math.round((current.balanceCents / current.incomeCents) * 100);
    insights.push({
      id: 'savings-rate',
      icon: savingsRate >= 20 ? 'sparkles-outline' : 'information-circle-outline',
      title: savingsRate >= 20 ? 'Bom ritmo de economia' : 'Margem apertada neste mês',
      description:
        savingsRate >= 0
          ? `Você preservou ${savingsRate}% das receitas deste mês. A referência recomendada é 20%.`
          : 'As despesas superaram as receitas. Revise os maiores gastos para recuperar sua margem.',
      tone: savingsRate >= 20 ? 'positive' : 'warning',
    });
  }

  if (previous.expenseCents > 0 && current.expenseCents > 0) {
    const variation = Math.round(((current.expenseCents - previous.expenseCents) / previous.expenseCents) * 100);
    insights.push({
      id: 'month-comparison',
      icon: variation <= 0 ? 'trending-down-outline' : 'trending-up-outline',
      title: variation <= 0 ? 'Gastos sob controle' : 'Gastos em alta',
      description: `Suas despesas estão ${Math.abs(variation)}% ${variation <= 0 ? 'menores' : 'maiores'} que no mês anterior.`,
      tone: variation <= 0 ? 'positive' : 'warning',
    });
  }

  const week = monthKey === today.slice(0, 7) ? getWeeklySummary(data.transactions, today) : null;
  if (week) insights.push(describeWeek(week, data.profile.hideBalances));

  const topCategory = categories[0];
  if (topCategory) {
    insights.push({
      id: 'top-category',
      icon: topCategory.category.icon,
      title: `${topCategory.category.name} lidera os gastos`,
      description: `Representa ${Math.round(topCategory.percentage)}% das despesas do mês. Pequenos ajustes aqui geram mais impacto.`,
      tone: 'neutral',
    });
  }

  const recurring = detectRecurring(data.transactions, today, data.bills);
  if (recurring.monthlyTotalCents > 0) {
    const count = recurring.items.length;
    const what = `${count} ${count === 1 ? 'gasto recorrente' : 'gastos recorrentes'}`;
    insights.push({
      id: 'recurring',
      icon: 'refresh-outline',
      title: 'Compromissos recorrentes',
      description: data.profile.hideBalances
        ? `Você tem ${what}. Revise na aba Recorrentes para achar onde economizar.`
        : `Você tem ${what}, cerca de ${formatCurrency(recurring.monthlyTotalCents)} por mês.`,
      tone: 'neutral',
    });
  }

  return insights;
}

export type ActivityFilter = 'all' | 'income' | 'expense' | 'pending';

/** Minúsculas e sem acentos, para a busca achar "cafe" em "Café". */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function matchesActivityFilter(transaction: Transaction, filter: ActivityFilter, today: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return !isEffective(transaction, today);
  return isEffective(transaction, today) && transaction.type === filter;
}

/**
 * Lista de Atividades: mês, filtro em pílula e busca. Pendentes e futuras só aparecem em "Todas" e "Pendentes".
 * Com `scope` (e `accounts`), fica só o lado Conta ou o lado Cartão.
 */
export function filterActivities(
  transactions: Transaction[],
  options: { monthKey: string; filter: ActivityFilter; query?: string; today?: string; scope?: MoneyScope; accounts?: Account[] },
): Transaction[] {
  const query = normalizeSearchText(options.query ?? '');
  const today = options.today ?? toDateInput();
  return transactions.filter((transaction) => {
    if (transactionMonth(transaction) !== options.monthKey) return false;
    if (options.scope && scopeOf(transaction.accountId, options.accounts ?? []) !== options.scope) return false;
    if (!matchesActivityFilter(transaction, options.filter, today)) return false;
    return !query || normalizeSearchText(transaction.description).includes(query);
  });
}

const DAY_MS = 86_400_000;

/** Número do dia de uma data `YYYY-MM-DD`, lida no fuso local (sem UTC). Diferença entre dois = dias corridos. */
export function dayNumber(date: string): number {
  return Math.round(parseLocalDate(date).getTime() / DAY_MS);
}

export interface DuplicateCharge {
  description: string;
  amountCents: number;
  dates: string[];
  transactionIds: string[];
}

function duplicateKey(transaction: Transaction): string {
  return `${normalizeSearchText(transaction.description).replace(/\s+/g, ' ')}|${transaction.amountCents}`;
}

/**
 * Possíveis cobranças repetidas: despesas concluídas com a mesma descrição e o mesmo valor,
 * a até `windowDays` dias uma da outra, com pelo menos uma no mês. Aportes entre contas ficam de fora.
 */
export function findDuplicateCharges(transactions: Transaction[], monthKey: string, windowDays = 3, today = toDateInput()): DuplicateCharge[] {
  const series = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !isEffective(transaction, today) || transaction.transferAccountId) continue;
    const key = duplicateKey(transaction);
    series.set(key, [...(series.get(key) ?? []), transaction]);
  }

  const found: DuplicateCharge[] = [];
  const keep = (cluster: Transaction[]) => {
    const first = cluster[0];
    if (!first || cluster.length < 2 || !cluster.some((item) => transactionMonth(item) === monthKey)) return;
    found.push({
      description: first.description.trim(),
      amountCents: first.amountCents,
      dates: cluster.map((item) => item.date),
      transactionIds: cluster.map((item) => item.id),
    });
  };

  for (const items of series.values()) {
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    let cluster: Transaction[] = [];
    for (const item of sorted) {
      const last = cluster[cluster.length - 1];
      if (last && dayNumber(item.date) - dayNumber(last.date) > windowDays) {
        keep(cluster);
        cluster = [];
      }
      cluster.push(item);
    }
    keep(cluster);
  }

  const latest = (charge: DuplicateCharge) => charge.dates[charge.dates.length - 1] ?? '';
  return found.sort((a, b) => latest(b).localeCompare(latest(a)));
}

export interface WeeklySummary {
  currentCents: number;
  previousCents: number;
  topCategory: CategoryTotal['category'];
}

/**
 * Gasto concluído dos últimos 7 dias (hoje e os 6 anteriores) contra os 7 dias antes deles,
 * com a categoria que mais pesou. Sem gasto na semana, devolve `null`. Datas futuras ficam de fora.
 */
export function getWeeklySummary(transactions: Transaction[], today: string): WeeklySummary | null {
  const end = dayNumber(today);
  const byCategory = new Map<string, number>();
  let currentCents = 0;
  let previousCents = 0;

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.status !== 'completed' || !countsAsFlow(transaction)) continue;
    const age = end - dayNumber(transaction.date);
    if (age < 0 || age > 13) continue;
    if (age > 6) {
      previousCents += transaction.amountCents;
      continue;
    }
    currentCents += transaction.amountCents;
    byCategory.set(transaction.categoryId, (byCategory.get(transaction.categoryId) ?? 0) + transaction.amountCents);
  }

  const [top] = [...byCategory.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (currentCents === 0 || !top) return null;
  return { currentCents, previousCents, topCategory: getCategory(top[0]) };
}
