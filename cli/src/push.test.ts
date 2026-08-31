import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBundle } from './bundle.ts';
import { formatBytes } from './client.ts';
import {
  credentialKey,
  credentialsPath,
  isExpired,
  loadCredential,
  saveCredential,
} from './credentials.ts';
import { isDiscovery, isPushResult, PUSH_PROTOCOL } from './protocol.ts';
import { newToken, statePath, tokenFor } from './state.ts';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'open-doc-publish-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeSite(dir: string): Promise<void> {
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  await fs.writeFile(path.join(dir, 'assets', 'app.js'), 'export default 1;');
  await fs.writeFile(path.join(dir, 'assets', 'app.css'), 'body{}');
}

const bundleInput = (siteDir: string) => ({
  siteDir,
  pushedAt: '2026-08-26T00:00:00.000Z',
  manifest: {
    workspace: 'simon',
    slug: 'report',
    kind: 'document' as const,
    token: 'd3728nnvh0opwph1',
    title: 'Report',
    route: '/d/report',
    entry: 'index.html',
  },
});

describe('createBundle', () => {
  it('packs the site and describes it in the manifest', async () => {
    const siteDir = path.join(tmp, 'dist');
    await writeSite(siteDir);

    const bundle = await createBundle(bundleInput(siteDir));

    expect(bundle.manifest.protocol).toBe(PUSH_PROTOCOL);
    expect(bundle.manifest.slug).toBe('report');
    expect(bundle.manifest.workspace).toBe('simon');
    expect(bundle.manifest.token).toBe('d3728nnvh0opwph1');
    expect(bundle.bytes.byteLength).toBeGreaterThan(0);
  });

  it('round-trips through the zip with nested directories intact', async () => {
    const siteDir = path.join(tmp, 'dist');
    await writeSite(siteDir);

    const bundle = await createBundle(bundleInput(siteDir));
    const { unzipSync } = await import('fflate');
    const entries = Object.keys(unzipSync(bundle.bytes))
      .filter((name) => !name.endsWith('/'))
      .sort();

    expect(entries).toEqual([
      'manifest.json',
      'site/assets/app.css',
      'site/assets/app.js',
      'site/index.html',
    ]);
  });

  it('refuses a directory that is not an open-doc build', async () => {
    const siteDir = path.join(tmp, 'dist');
    await fs.mkdir(siteDir);
    await fs.writeFile(path.join(siteDir, 'notes.txt'), 'hi');

    await expect(createBundle(bundleInput(siteDir))).rejects.toThrow(/index\.html/i);
  });

  it('refuses a missing directory', async () => {
    await expect(createBundle(bundleInput(path.join(tmp, 'nope')))).rejects.toThrow(
      /build it first/,
    );
  });
});

describe('credentials', () => {
  it('files tokens by origin so a moved publish path keeps the login', () => {
    expect(credentialKey('https://example.dev/v1/publish')).toBe('https://example.dev');
    expect(credentialKey('https://example.dev/other')).toBe('https://example.dev');
  });

  it('honours XDG_CONFIG_HOME', () => {
    expect(credentialsPath({ XDG_CONFIG_HOME: '/xdg' } as NodeJS.ProcessEnv)).toBe(
      '/xdg/costaff-workspace/credentials.json',
    );
  });

  it('round-trips a credential', async () => {
    const file = path.join(tmp, 'credentials.json');
    await saveCredential('https://example.dev', { token: 't1', account: 'simon' }, file);

    expect(await loadCredential('https://example.dev/publish', file)).toMatchObject({
      token: 't1',
      account: 'simon',
    });
  });

  it('writes the store 0600 — it holds a bearer token', async () => {
    const file = path.join(tmp, 'credentials.json');
    await saveCredential('https://example.dev', { token: 't1' }, file);

    expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  });

  it('treats an expired credential as absent', async () => {
    const file = path.join(tmp, 'credentials.json');
    await saveCredential(
      'https://example.dev',
      { token: 't1', expiresAt: '2020-01-01T00:00:00.000Z' },
      file,
    );

    expect(await loadCredential('https://example.dev', file)).toBeNull();
  });

  it('treats a corrupt store as logged out rather than failing', async () => {
    const file = path.join(tmp, 'credentials.json');
    await fs.writeFile(file, 'not json');

    expect(await loadCredential('https://example.dev', file)).toBeNull();
  });

  it('never expires a credential without an expiry', () => {
    expect(isExpired({ token: 't' })).toBe(false);
  });
});

describe('protocol guards', () => {
  const discovery = {
    protocol: 1,
    name: 'Receiver',
    deviceAuthStart: '/v1/device/start',
    deviceAuthPoll: '/v1/device/poll',
    push: '/v1/push',
    maxBytes: 1,
  };

  it('accepts a complete discovery document', () => {
    expect(isDiscovery(discovery)).toBe(true);
  });

  it('rejects one missing a required field', () => {
    const { push: _push, ...partial } = discovery;
    expect(isDiscovery(partial)).toBe(false);
  });

  it('rejects a publish result without a share URL', () => {
    expect(isPushResult({ slug: 'a' })).toBe(false);
    expect(isPushResult({ slug: 'a', url: 'https://x/y' })).toBe(true);
  });
});

describe('formatBytes', () => {
  it('scales the unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 kB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('token state', () => {
  const readState = async () => JSON.parse(await fs.readFile(statePath(tmp), 'utf8'));

  it('mints a path-safe token', () => {
    expect(newToken()).toMatch(/^[a-z0-9]{16,20}$/);
  });

  it('remembers a token so a second push updates the same link', async () => {
    const first = await tokenFor(tmp, 'http://x:8787', 'document', 'report');
    const again = await tokenFor(tmp, 'http://x:8787/v1/push', 'document', 'report');
    expect(again).toBe(first);
  });

  it('keeps separate tokens per receiver', async () => {
    const a = await tokenFor(tmp, 'http://x:8787', 'document', 'report');
    const b = await tokenFor(tmp, 'https://y.app', 'document', 'report');
    expect(b).not.toBe(a);
  });

  it('keeps separate tokens per kind and slug', async () => {
    const doc = await tokenFor(tmp, 'http://x:8787', 'document', 'report');
    const deck = await tokenFor(tmp, 'http://x:8787', 'deck', 'report');
    const other = await tokenFor(tmp, 'http://x:8787', 'document', 'notes');
    expect(new Set([doc, deck, other]).size).toBe(3);
  });

  /*
   * Keys used to carry a workspace name. Those entries point at links that are
   * already published, so the token is adopted rather than replaced — minting a
   * new one would quietly orphan whatever had been shared.
   */
  it('adopts an entry keyed with the old workspace segment', async () => {
    await fs.mkdir(path.dirname(statePath(tmp)), { recursive: true });
    await fs.writeFile(
      statePath(tmp),
      JSON.stringify({
        version: 1,
        endpoints: {
          'http://x:8787': { 'simon/document/report': { token: 'legacytoken00000' } },
        },
      }),
    );

    expect(await tokenFor(tmp, 'http://x:8787', 'document', 'report')).toBe('legacytoken00000');
    const state = await readState();
    expect(state.endpoints['http://x:8787']['document/report'].token).toBe('legacytoken00000');
    expect(state.endpoints['http://x:8787']['simon/document/report']).toBeUndefined();

    // Adopted once, then stable: asking again returns the same address rather
    // than reaching for another old key.
    expect(await tokenFor(tmp, 'http://x:8787', 'document', 'report')).toBe('legacytoken00000');
  });
});
