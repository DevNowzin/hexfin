// Client ID e Client Secret no SecureStore; Item IDs, consentimento e última sincronização no AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteSecret, getSecret, setSecret } from '@/utils/secureStore';
import { DEFAULT_OPEN_FINANCE_SETTINGS, type LastSync, type OpenFinanceSettings } from './types';

const PREFS_KEY = 'hexfin:openfinance:v1';
const CLIENT_ID = 'hexfin.openfinance.clientId';
const CLIENT_SECRET = 'hexfin.openfinance.clientSecret';

function count(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function parseLastSync(value: unknown): LastSync | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.at !== 'string') return undefined;
  return {
    at: raw.at,
    accountsAdded: count(raw.accountsAdded),
    accountsUpdated: count(raw.accountsUpdated),
    transactionsAdded: count(raw.transactionsAdded),
    transactionsUpdated: count(raw.transactionsUpdated),
    transactionsRemoved: count(raw.transactionsRemoved),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((item): item is string => typeof item === 'string') : [],
  };
}

export function parseOpenFinancePrefs(raw: string | null): Pick<OpenFinanceSettings, 'itemIds' | 'consentedAt' | 'lastSync'> {
  if (!raw) return { itemIds: [] };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      itemIds: Array.isArray(value.itemIds) ? value.itemIds.filter((id): id is string => typeof id === 'string') : [],
      consentedAt: typeof value.consentedAt === 'string' ? value.consentedAt : undefined,
      lastSync: parseLastSync(value.lastSync),
    };
  } catch {
    return { itemIds: [] };
  }
}

export async function loadOpenFinanceSettings(): Promise<OpenFinanceSettings> {
  const [prefs, clientId, clientSecret] = await Promise.all([
    AsyncStorage.getItem(PREFS_KEY).then(parseOpenFinancePrefs),
    getSecret(CLIENT_ID),
    getSecret(CLIENT_SECRET),
  ]);
  return { ...DEFAULT_OPEN_FINANCE_SETTINGS, ...prefs, clientId, clientSecret };
}

export async function saveOpenFinanceSettings(settings: OpenFinanceSettings): Promise<void> {
  const { clientId, clientSecret, ...prefs } = settings;
  await Promise.all([
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)),
    setSecret(CLIENT_ID, clientId.trim()),
    setSecret(CLIENT_SECRET, clientSecret.trim()),
  ]);
}

/** Remove credenciais e Item IDs. As contas e transações já importadas continuam no app. */
export async function clearOpenFinanceSettings(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(PREFS_KEY), deleteSecret(CLIENT_ID), deleteSecret(CLIENT_SECRET)]);
}
