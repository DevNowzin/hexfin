// Configuração da IA no app (pura, testável). Persistência fica em storage.ts.
import { DEFAULT_AI_MODEL } from './types.ts';

export type AiMode = 'off' | 'direct' | 'backend';

export interface AiSettings {
  mode: AiMode;
  /** Modelo usado no modo "chave própria". */
  model: string;
  /** Chave da API colocada pelo próprio usuário; guardada no SecureStore. */
  apiKey: string;
  backendUrl: string;
  /** Token do app para o backend; guardado no SecureStore. */
  backendToken: string;
  /** Data ISO do consentimento. Sem ele nenhuma chamada sai do aparelho. */
  consentedAt?: string;
  /** Consentimento separado para enviar percentuais do mês (comentários nos Assistentes). */
  insightsConsentedAt?: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  mode: 'off',
  model: DEFAULT_AI_MODEL,
  apiKey: '',
  backendUrl: '',
  backendToken: '',
};

export const MODEL_PRESETS: Array<{ id: string; label: string; hint: string }> = [
  { id: DEFAULT_AI_MODEL, label: 'Opus 5.5', hint: 'Padrão, mais preciso' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', hint: 'Mais barato e rápido' },
];

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

/** HTTPS sempre; HTTP só para localhost e o host do emulador Android (desenvolvimento). */
export function isValidBackendUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function isValidModelId(value: string): boolean {
  return /^claude-[a-z0-9.-]{2,60}$/.test(value.trim());
}

/** Retorna a primeira mensagem de erro de validação ou null se estiver tudo certo. */
export function validateAiSettings(settings: AiSettings): string | null {
  if (settings.mode === 'off') return null;
  if (!settings.consentedAt) return 'Autorize o envio da descrição para ativar a IA.';
  if (settings.mode === 'direct') {
    if (settings.apiKey.trim().length < 20) return 'Cole uma chave de API válida.';
    if (!isValidModelId(settings.model)) return 'Modelo inválido. Use um ID como claude-opus-5-5.';
    return null;
  }
  if (!isValidBackendUrl(settings.backendUrl)) return 'Use uma URL https:// (http só para localhost).';
  if (settings.backendToken.trim().length < 24) return 'O token do servidor precisa de pelo menos 24 caracteres.';
  return null;
}

export function isAiReady(settings: AiSettings): boolean {
  return settings.mode !== 'off' && validateAiSettings(settings) === null;
}

/** Comentários nos Assistentes: IA pronta e consentimento próprio para enviar percentuais do mês. */
export function isInsightsReady(settings: AiSettings): boolean {
  return isAiReady(settings) && Boolean(settings.insightsConsentedAt);
}
