import { toDateInput } from '@/utils/format';
import type { Account, FinanceData, Transaction, TransactionDraft } from './types';

function daysAgo(reference: Date, amount: number): string {
  const date = new Date(reference);
  date.setDate(date.getDate() - amount);
  return toDateInput(date);
}

function dateInMonth(reference: Date, monthOffset: number, day: number): string {
  const firstDay = new Date(reference.getFullYear(), reference.getMonth() + monthOffset, 1, 12);
  const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  return toDateInput(new Date(firstDay.getFullYear(), firstDay.getMonth(), Math.min(day, lastDay), 12));
}

function makeTransaction(id: string, draft: TransactionDraft): Transaction {
  return { ...draft, id, createdAt: `${draft.date}T12:00:00.000Z` };
}

export function createSeedData(reference = new Date()): FinanceData {
  const accounts: Account[] = [
    {
      id: 'account_nubank',
      name: 'Conta principal',
      institution: 'Nubank',
      type: 'checking',
      color: '#8B5CF6',
      openingBalanceCents: 325000,
    },
    {
      id: 'account_inter',
      name: 'Reserva',
      institution: 'Inter',
      type: 'savings',
      color: '#F97316',
      openingBalanceCents: 485000,
    },
    {
      id: 'account_xp',
      name: 'Investimentos',
      institution: 'XP',
      type: 'investment',
      color: '#4ADE80',
      openingBalanceCents: 642000,
    },
    {
      id: 'account_cash',
      name: 'Dinheiro',
      institution: 'Carteira',
      type: 'cash',
      color: '#34D399',
      openingBalanceCents: 15000,
    },
  ];

  const current: Transaction[] = [
    makeTransaction('tx_salary_current', {
      description: 'Salário',
      amountCents: 850000,
      type: 'income',
      date: dateInMonth(reference, 0, 1),
      categoryId: 'salary',
      accountId: 'account_nubank',
      status: 'completed',
      recurrence: 'monthly',
    }),
    makeTransaction('tx_freelance_current', {
      description: 'Projeto freelance',
      amountCents: 125000,
      type: 'income',
      date: dateInMonth(reference, 0, 3),
      categoryId: 'other',
      accountId: 'account_nubank',
      status: 'completed',
    }),
    makeTransaction('tx_rent_current', {
      description: 'Aluguel',
      amountCents: 220000,
      type: 'expense',
      date: dateInMonth(reference, 0, 5),
      categoryId: 'housing',
      accountId: 'account_nubank',
      status: 'completed',
      recurrence: 'monthly',
    }),
    makeTransaction('tx_market_current', {
      description: 'Mercado Pão de Açúcar',
      amountCents: 18640,
      type: 'expense',
      date: daysAgo(reference, 2),
      categoryId: 'food',
      accountId: 'account_nubank',
      status: 'completed',
      notes: 'Compras da semana',
    }),
    makeTransaction('tx_restaurant_current', {
      description: 'Madero',
      amountCents: 8490,
      type: 'expense',
      date: daysAgo(reference, 3),
      categoryId: 'food',
      accountId: 'account_nubank',
      status: 'completed',
    }),
    makeTransaction('tx_uber_current', {
      description: 'Uber',
      amountCents: 3290,
      type: 'expense',
      date: daysAgo(reference, 4),
      categoryId: 'transport',
      accountId: 'account_nubank',
      status: 'completed',
    }),
    makeTransaction('tx_pharmacy_current', {
      description: 'Drogasil',
      amountCents: 4720,
      type: 'expense',
      date: daysAgo(reference, 6),
      categoryId: 'health',
      accountId: 'account_nubank',
      status: 'completed',
    }),
    makeTransaction('tx_netflix_current', {
      description: 'Netflix',
      amountCents: 5590,
      type: 'expense',
      date: dateInMonth(reference, 0, 8),
      categoryId: 'subscriptions',
      accountId: 'account_nubank',
      status: 'completed',
      recurrence: 'monthly',
    }),
    makeTransaction('tx_spotify_current', {
      description: 'Spotify',
      amountCents: 2190,
      type: 'expense',
      date: dateInMonth(reference, 0, 10),
      categoryId: 'subscriptions',
      accountId: 'account_nubank',
      status: 'completed',
      recurrence: 'monthly',
    }),
    makeTransaction('tx_book_current', {
      description: 'Livraria da Vila',
      amountCents: 6490,
      type: 'expense',
      date: daysAgo(reference, 7),
      categoryId: 'education',
      accountId: 'account_inter',
      status: 'completed',
    }),
    makeTransaction('tx_investment_current', {
      description: 'Aporte mensal',
      amountCents: 100000,
      type: 'expense',
      date: dateInMonth(reference, 0, 6),
      categoryId: 'investments',
      accountId: 'account_nubank',
      transferAccountId: 'account_xp',
      status: 'completed',
      recurrence: 'monthly',
      notes: 'Aporte programado para a reserva de longo prazo.',
    }),
    makeTransaction('tx_pending_current', {
      description: 'Conta de energia',
      amountCents: 14230,
      type: 'expense',
      date: dateInMonth(reference, 0, 28),
      categoryId: 'housing',
      accountId: 'account_nubank',
      status: 'pending',
    }),
  ];

  const previous = Array.from({ length: 5 }, (_, index) => index + 1).flatMap((offset): Transaction[] => [
    makeTransaction(`tx_salary_${offset}`, {
      description: 'Salário',
      amountCents: 850000,
      type: 'income',
      date: dateInMonth(reference, -offset, 1),
      categoryId: 'salary',
      accountId: 'account_nubank',
      status: 'completed',
      recurrence: 'monthly',
    }),
    makeTransaction(`tx_rent_${offset}`, {
      description: 'Aluguel',
      amountCents: 220000,
      type: 'expense',
      date: dateInMonth(reference, -offset, 5),
      categoryId: 'housing',
      accountId: 'account_nubank',
      status: 'completed',
      recurrence: 'monthly',
    }),
    makeTransaction(`tx_food_${offset}`, {
      description: offset % 2 === 0 ? 'Mercado Dia' : 'Pão de Açúcar',
      amountCents: 145000 + offset * 7350,
      type: 'expense',
      date: dateInMonth(reference, -offset, 12),
      categoryId: 'food',
      accountId: 'account_nubank',
      status: 'completed',
    }),
    makeTransaction(`tx_transport_${offset}`, {
      description: 'Combustível',
      amountCents: 38000 + offset * 2500,
      type: 'expense',
      date: dateInMonth(reference, -offset, 15),
      categoryId: 'transport',
      accountId: 'account_inter',
      status: 'completed',
    }),
    makeTransaction(`tx_leisure_${offset}`, {
      description: offset % 2 === 0 ? 'Cinema' : 'Final de semana',
      amountCents: 28000 + (6 - offset) * 5200,
      type: 'expense',
      date: dateInMonth(reference, -offset, 20),
      categoryId: 'leisure',
      accountId: 'account_nubank',
      status: 'completed',
    }),
    makeTransaction(`tx_subscriptions_${offset}`, {
      description: 'Netflix',
      amountCents: 5590,
      type: 'expense',
      date: dateInMonth(reference, -offset, 8),
      categoryId: 'subscriptions',
      accountId: 'account_nubank',
      status: 'completed',
      recurrence: 'monthly',
    }),
    makeTransaction(`tx_investments_${offset}`, {
      description: 'Aporte mensal',
      amountCents: 80000 + offset * 5000,
      type: 'expense',
      date: dateInMonth(reference, -offset, 6),
      categoryId: 'investments',
      accountId: 'account_nubank',
      transferAccountId: 'account_xp',
      status: 'completed',
      recurrence: 'monthly',
    }),
  ]);

  return {
    accounts,
    transactions: [...current, ...previous],
    profile: { name: 'Você', hideBalances: false, theme: 'system' },
  };
}
