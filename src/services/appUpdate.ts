// Único ponto de rede com o GitHub: lê a última versão pública do app. Não envia nenhum dado do usuário.
import { type AppRelease, LATEST_RELEASE_URL, parseLatestRelease } from '@/features/update/release';

const TIMEOUT_MS = 8000;

export type UpdateCheck =
  | { ok: true; release: AppRelease | null }
  | { ok: false; error: 'offline' | 'timeout' | 'invalid' };

/** Busca a última release. `release: null` = nenhuma versão publicada ainda (404) ou sem APK válido. */
export async function fetchLatestRelease(fetcher: typeof fetch = fetch): Promise<UpdateCheck> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (response.status === 404) return { ok: true, release: null };
    if (!response.ok) return { ok: false, error: 'invalid' };
    const body: unknown = await response.json();
    return { ok: true, release: parseLatestRelease(body) };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, error: 'timeout' };
    return { ok: false, error: error instanceof SyntaxError ? 'invalid' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
