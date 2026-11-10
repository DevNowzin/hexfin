import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeWorkSettings } from '@/features/work/payroll';
import { toDateInput } from '@/utils/format';
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
    const { bills, work, ...rest } = parsed;
    const cleanWork = work === undefined ? undefined : sanitizeWorkSettings(work, toDateInput());
    return { ...rest, ...(bills === undefined ? {} : { bills: sanitizeBills(bills) }), ...(cleanWork ? { work: cleanWork } : {}) };
  } catch {
    return null;
  }
}

export async function saveFinanceData(data: FinanceData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
