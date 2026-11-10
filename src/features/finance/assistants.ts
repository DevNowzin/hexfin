import type { FinanceInsight } from './selectors';
import type { AssistantId } from './types';

export interface Assistant {
  id: AssistantId;
  name: string;
  icon: string;
  /** O que o assistente observa, em uma frase. */
  watches: string;
}

/** Assistentes locais: regras determinísticas que rodam no aparelho. O id é o mesmo do insight que cada um gera. */
export const ASSISTANTS: readonly Assistant[] = [
  { id: 'savings-rate', name: 'Economia do mês', icon: 'leaf-outline', watches: 'Quanto da sua renda sobrou no mês' },
  { id: 'month-comparison', name: 'Comparação mensal', icon: 'git-compare-outline', watches: 'Seus gastos contra os do mês anterior' },
  { id: 'top-category', name: 'Maior gasto', icon: 'pie-chart-outline', watches: 'A categoria que mais pesou no mês' },
  { id: 'weekly-summary', name: 'Resumo da semana', icon: 'calendar-outline', watches: 'Seus gastos dos últimos 7 dias' },
  { id: 'recurring', name: 'Contas fixas', icon: 'refresh-outline', watches: 'Despesas que se repetem todo mês' },
  { id: 'duplicate-charges', name: 'Cobrança repetida', icon: 'copy-outline', watches: 'A mesma despesa e o mesmo valor em até 3 dias' },
];

export function isAssistantEnabled(disabled: readonly AssistantId[] | undefined, id: AssistantId): boolean {
  return !disabled?.includes(id);
}

/** Liga ou desliga um assistente; devolve a nova lista de desligados, sem repetir ids. */
export function toggleAssistant(disabled: readonly AssistantId[] | undefined, id: AssistantId): AssistantId[] {
  const current = disabled ?? [];
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

/** Só os insights dos assistentes ligados (usado no carrossel do Início). */
export function visibleInsights(insights: FinanceInsight[], disabled: readonly AssistantId[] | undefined): FinanceInsight[] {
  return insights.filter((insight) => !disabled?.some((id) => id === insight.id));
}
