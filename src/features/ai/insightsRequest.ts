// Monta o pedido dos comentários da IA a partir dos seletores (só no app, não no backend).
import { getMonthSummary, getSpendingByCategory, shiftMonth } from '@/features/finance/selectors';
import type { Transaction } from '@/features/finance/types';
import { MAX_ABS_PERCENT, MAX_INSIGHT_CATEGORIES } from './insights';
import type { InsightsRequest } from './types';

function clampPercent(value: number): number {
  return Math.max(-MAX_ABS_PERCENT, Math.min(MAX_ABS_PERCENT, Math.round(value)));
}

/**
 * Só percentuais calculados aqui, com as mesmas regras dos assistentes locais: nenhum valor
 * em reais, conta ou descrição sai do aparelho. Null quando o mês não tem nada concluído.
 */
export function buildInsightsRequest(transactions: Transaction[], monthKey: string): InsightsRequest | null {
  const current = getMonthSummary(transactions, monthKey);
  if (current.incomeCents === 0 && current.expenseCents === 0) return null;
  const previous = getMonthSummary(transactions, shiftMonth(monthKey, -1));
  const hasComparison = previous.expenseCents > 0 && current.expenseCents > 0;
  return {
    month: monthKey,
    savingsRatePercent: current.incomeCents > 0 ? clampPercent((current.balanceCents / current.incomeCents) * 100) : null,
    expenseChangePercent: hasComparison
      ? clampPercent(((current.expenseCents - previous.expenseCents) / previous.expenseCents) * 100)
      : null,
    categories: getSpendingByCategory(transactions, monthKey)
      .slice(0, MAX_INSIGHT_CATEGORIES)
      .map((item) => ({ id: item.category.id, sharePercent: Math.round(item.percentage) })),
    locale: 'pt-BR',
  };
}
