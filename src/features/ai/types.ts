// Contratos compartilhados entre o app e o backend (server/). Sem imports de runtime
// para que o Node consiga carregar este arquivo diretamente.

// Ficam aqui (e não em anthropic.ts) para que ler a configuração não carregue o SDK.
export const DEFAULT_AI_MODEL = 'claude-opus-5-5';
export const DEFAULT_AI_TIMEOUT_MS = 15000;

export type CategorizableType = 'income' | 'expense';

export interface CategorizeRequest {
  description: string;
  type: CategorizableType;
  locale: 'pt-BR';
}

export interface CategorySuggestion {
  categoryId: string;
  confidence: number;
  reason: string;
}

/** De onde veio a sugestão: modelo de IA ou regras locais determinísticas. */
export type SuggestionSource = 'ai' | 'local';

export interface SuggestionResult extends CategorySuggestion {
  source: SuggestionSource;
  /** Preenchido quando a IA estava ativa mas falhou e o app caiu nas regras locais. */
  fallbackReason?: AiErrorCode;
}

export type AiErrorCode =
  | 'not_configured'
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'refused'
  | 'invalid_response'
  | 'server';

export class AiError extends Error {
  readonly code: AiErrorCode;

  constructor(code: AiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AiError';
    this.code = code;
  }
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

// Comentários da IA nos Assistentes (H3). Só percentuais calculados no app: nunca valores em reais.
export const INSIGHTS_TIMEOUT_MS = 30000;

export interface InsightsCategoryShare {
  id: string;
  /** Fatia da categoria nas despesas concluídas do mês, 0 a 100. */
  sharePercent: number;
}

export interface InsightsRequest {
  /** Mês no formato YYYY-MM. */
  month: string;
  /** Quanto da receita sobrou no mês; null sem receitas. */
  savingsRatePercent: number | null;
  /** Variação das despesas contra o mês anterior; null sem base de comparação. */
  expenseChangePercent: number | null;
  categories: InsightsCategoryShare[];
  locale: 'pt-BR';
}

export type InsightTone = 'positive' | 'warning' | 'neutral';

export interface AiInsight {
  title: string;
  message: string;
  tone: InsightTone;
}
