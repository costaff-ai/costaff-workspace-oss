import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectSource } from './source.ts';

let root: string;

const write = async (rel: string, body: string): Promise<void> => {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, body);
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'costaff-source-'));
  await write('docs/brief/index.tsx', 'export default () => null;\n');
  await write('docs/brief/diagram.mmd', 'graph TD;\n');
  await write('scripts/sync.mjs', '// build\n');
  await write('open-doc.config.ts', 'export default {};\n');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const collect = (): ReturnType<typeof collectSource> =>
  collectSource({ root, dir: 'docs/brief', entry: 'index.tsx' });

describe('collectSource', () => {
  it('carries the item and the scaffolding that builds it', async () => {
    await write('package.json', JSON.stringify({ dependencies: { react: '^18.3.1' } }));
    const source = await collect();
    expect([...source.files.keys()].sort()).toEqual([
      'item/diagram.mmd',
      'item/index.tsx',
      'scaffold/open-doc.config.ts',
      'scaffold/scripts/sync.mjs',
    ]);
  });

  /*
   * The case this whole module exists for: the author develops the framework
   * next door, and that path is meaningless on the machine doing the rebuild.
   */
  it('rewrites a local dependency to the version actually installed', async () => {
    await write('package.json', JSON.stringify({ dependencies: { '@open-document/core': 'link:../../open-doc/packages/core' } }));
    await write('node_modules/@open-document/core/package.json', JSON.stringify({ version: '0.3.0' }));
    const source = await collect();
    expect(source.dependencies['@open-document/core']).toBe('^0.3.0');
  });

  it('leaves a published spec alone', async () => {
    await write('package.json', JSON.stringify({ dependencies: { '@open-slide/core': '1.19.1' } }));
    const source = await collect();
    expect(source.dependencies['@open-slide/core']).toBe('1.19.1');
  });

  /*
   * Publishing a path nobody else can resolve produces an install failure that
   * names a directory, not a dependency — so it is refused here, where the
   * message can say what to do.
   */
  it('refuses a local dependency that is not installed', async () => {
    await write('package.json', JSON.stringify({ dependencies: { '@open-document/core': 'link:../elsewhere' } }));
    await expect(collect()).rejects.toThrow(/not installed/);
  });

  it('does not carry node_modules or dotfiles', async () => {
    await write('package.json', '{}');
    await write('docs/brief/node_modules/dep/index.js', 'x');
    await write('docs/brief/.env', 'SECRET=1');
    const source = await collect();
    expect([...source.files.keys()]).not.toContain('item/node_modules/dep/index.js');
    expect([...source.files.keys()]).not.toContain('item/.env');
  });

  it('refuses when the entry the manifest promises is missing', async () => {
    await write('package.json', '{}');
    await expect(
      collectSource({ root, dir: 'docs/brief', entry: 'main.tsx' }),
    ).rejects.toThrow(/has no main\.tsx/);
  });
});
