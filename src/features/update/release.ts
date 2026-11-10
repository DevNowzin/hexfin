// Versões do app publicadas no GitHub (funções puras, testadas).
// O app só lê a última versão pública do repositório; não envia nenhum dado.

/** Repositório público onde ficam as versões (Releases com o APK). */
export const UPDATE_REPO = 'DevNowzin/hexfin';
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
const DOWNLOAD_PREFIX = `https://github.com/${UPDATE_REPO}/releases/download/`;
const MAX_NOTES_LENGTH = 600;

export interface AppRelease {
  version: string;
  apkUrl: string;
  notes: string;
}

/** "v1.2.0" ou "1.2.0" → [1, 2, 0]; outra coisa → null. */
export function parseVersion(text: string): [number, number, number] | null {
  const match = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(text.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** A versão publicada é mais nova que a instalada? Versão ilegível nunca é "mais nova". */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let index = 0; index < 3; index += 1) {
    if (a[index]! !== b[index]!) return a[index]! > b[index]!;
  }
  return false;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Lê a resposta de `releases/latest`. Só aceita APK baixado do próprio repositório pelo GitHub
 * (nada de link de outro lugar), versão no formato `vX.Y.Z` e release publicada (sem rascunho nem prévia).
 */
export function parseLatestRelease(value: unknown): AppRelease | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.draft === true || raw.prerelease === true) return null;
  const tag = text(raw.tag_name);
  const parsed = parseVersion(tag);
  if (!parsed) return null;
  const assets = Array.isArray(raw.assets) ? raw.assets : [];
  const apk = assets
    .map((asset) => (asset && typeof asset === 'object' ? (asset as Record<string, unknown>) : {}))
    .map((asset) => ({ name: text(asset.name), url: text(asset.browser_download_url) }))
    .find((asset) => asset.name.toLowerCase().endsWith('.apk') && asset.url.startsWith(DOWNLOAD_PREFIX));
  if (!apk) return null;
  return {
    version: parsed.join('.'),
    apkUrl: apk.url,
    notes: text(raw.body).trim().slice(0, MAX_NOTES_LENGTH),
  };
}
