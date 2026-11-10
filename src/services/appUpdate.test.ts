import { describe, expect, it } from 'vitest';
import { LATEST_RELEASE_URL, UPDATE_REPO } from '@/features/update/release';
import { fetchLatestRelease } from './appUpdate';

const body = {
  tag_name: 'v1.2.0',
  body: 'Novidades',
  assets: [{ name: 'HexFin-1.2.0.apk', browser_download_url: `https://github.com/${UPDATE_REPO}/releases/download/v1.2.0/HexFin-1.2.0.apk` }],
};

function respond(status: number, json: unknown): typeof fetch {
  return (async () => ({ status, ok: status >= 200 && status < 300, json: async () => json })) as unknown as typeof fetch;
}

describe('fetchLatestRelease', () => {
  it('lê a última versão do repositório, sem mandar dados', async () => {
    let calledWith: unknown[] = [];
    const fetcher = (async (...args: unknown[]) => {
      calledWith = args;
      return { status: 200, ok: true, json: async () => body };
    }) as unknown as typeof fetch;
    const result = await fetchLatestRelease(fetcher);
    expect(result).toEqual({ ok: true, release: expect.objectContaining({ version: '1.2.0' }) });
    expect(calledWith[0]).toBe(LATEST_RELEASE_URL);
    expect((calledWith[1] as RequestInit).body).toBeUndefined();
  });

  it('sem nenhuma versão publicada (404) não é erro', async () => {
    expect(await fetchLatestRelease(respond(404, {}))).toEqual({ ok: true, release: null });
  });

  it('erro do servidor e falta de internet viram erro tratado', async () => {
    expect(await fetchLatestRelease(respond(500, {}))).toEqual({ ok: false, error: 'invalid' });
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    expect(await fetchLatestRelease(offline)).toEqual({ ok: false, error: 'offline' });
  });
});
