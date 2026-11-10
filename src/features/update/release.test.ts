import { describe, expect, it } from 'vitest';
import { UPDATE_REPO, isNewer, parseLatestRelease, parseVersion } from './release';

const apkUrl = `https://github.com/${UPDATE_REPO}/releases/download/v1.2.0/HexFin-1.2.0.apk`;

function release(patch: Record<string, unknown> = {}) {
  return {
    tag_name: 'v1.2.0',
    draft: false,
    prerelease: false,
    body: 'Montagem da raposa e aviso de versão nova.',
    assets: [
      { name: 'notas.txt', browser_download_url: `https://github.com/${UPDATE_REPO}/releases/download/v1.2.0/notas.txt` },
      { name: 'HexFin-1.2.0.apk', browser_download_url: apkUrl },
    ],
    ...patch,
  };
}

describe('versões', () => {
  it('lê vX.Y.Z e X.Y.Z e recusa o resto', () => {
    expect(parseVersion('v1.2.0')).toEqual([1, 2, 0]);
    expect(parseVersion(' 10.0.3 ')).toEqual([10, 0, 3]);
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('v1.2.0-beta')).toBeNull();
  });

  it('compara número por número, não como texto', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('v1.2.0', '1.1.9')).toBe(true);
    expect(isNewer('1.2.0', '1.2.0')).toBe(false);
    expect(isNewer('1.1.0', '1.2.0')).toBe(false);
    expect(isNewer('lixo', '1.0.0')).toBe(false);
  });
});

describe('parseLatestRelease', () => {
  it('pega a versão, o APK do próprio repositório e as notas', () => {
    expect(parseLatestRelease(release())).toEqual({ version: '1.2.0', apkUrl, notes: 'Montagem da raposa e aviso de versão nova.' });
  });

  it('recusa rascunho, prévia, versão ilegível, sem APK e APK de outro lugar', () => {
    expect(parseLatestRelease(release({ draft: true }))).toBeNull();
    expect(parseLatestRelease(release({ prerelease: true }))).toBeNull();
    expect(parseLatestRelease(release({ tag_name: 'nova' }))).toBeNull();
    expect(parseLatestRelease(release({ assets: [] }))).toBeNull();
    expect(parseLatestRelease(release({ assets: [{ name: 'HexFin.apk', browser_download_url: 'https://exemplo.com/HexFin.apk' }] }))).toBeNull();
    expect(parseLatestRelease(null)).toBeNull();
  });
});
