import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteSecret, getSecret, setSecret } from '@/utils/secureStore';
import { DEFAULT_AI_SETTINGS, type AiMode, type AiSettings } from './config';

export { SECRETS_ARE_ENCRYPTED } from '@/utils/secureStore';

const PREFS_KEY = 'hexfin:ai:v1';
const API_KEY = 'hexfin.ai.apiKey';
const BACKEND_TOKEN = 'hexfin.ai.backendToken';

function isAiMode(value: unknown): value is AiMode {
  return value === 'off' || value === 'direct' || value === 'backend';
}

function parsePrefs(raw: string | null): Partial<AiSettings> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      mode: isAiMode(value.mode) ? value.mode : undefined,
      model: typeof value.model === 'string' ? value.model : undefined,
      backendUrl: typeof value.backendUrl === 'string' ? value.backendUrl : undefined,
      consentedAt: typeof value.consentedAt === 'string' ? value.consentedAt : undefined,
      insightsConsentedAt: typeof value.insightsConsentedAt === 'string' ? value.insightsConsentedAt : undefined,
    };
  } catch {
    return {};
  }
}

export async function loadAiSettings(): Promise<AiSettings> {
  const [prefs, apiKey, backendToken] = await Promise.all([
    AsyncStorage.getItem(PREFS_KEY).then(parsePrefs),
    getSecret(API_KEY),
    getSecret(BACKEND_TOKEN),
  ]);
  const defined = Object.fromEntries(Object.entries(prefs).filter(([, value]) => value !== undefined));
  return { ...DEFAULT_AI_SETTINGS, ...defined, apiKey, backendToken };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  const { apiKey, backendToken, ...prefs } = settings;
  await Promise.all([
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)),
    setSecret(API_KEY, apiKey.trim()),
    setSecret(BACKEND_TOKEN, backendToken.trim()),
  ]);
}

export async function clearAiSettings(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(PREFS_KEY), deleteSecret(API_KEY), deleteSecret(BACKEND_TOKEN)]);
}
