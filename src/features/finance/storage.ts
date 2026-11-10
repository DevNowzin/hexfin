import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeBills } from './bills';
import type { FinanceData } from './types';

const STORAGE_KEY = 'hexfin:finance:v1';

function isFinanceData(value: unknown): value is FinanceData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FinanceData>;
  return (
    Array.isArray(candidate.accounts) &&
    Array.isArray(candidate.transactions) &&
    Boolean(candidate.profile) &&
    typeof candidate.profile?.name === 'string'
  );
}

export async function loadFinanceData(): Promise<FinanceData | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isFinanceData(parsed)) return null;
    return parsed.bills === undefined ? parsed : { ...parsed, bills: sanitizeBills(parsed.bills) };
  } catch {
    return null;
  }
}

export async function saveFinanceData(data: FinanceData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
