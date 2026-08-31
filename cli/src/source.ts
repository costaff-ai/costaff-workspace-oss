/**
 * Collecting what a rebuild needs, so a pushed file can be worked on again.
 *
 * The receiver only ever held build output: 360 KB of hashed assets for an 8 KB
 * `index.tsx`. Nothing in that is editable, so "download the file" could not
 * mean "edit the file" until the source travelled with it.
 *
 * What travels is the item's own directory plus the workspace scaffolding that
 * built it — not a curated subset. A guessed subset is a rebuild that fails on
 * someone else's machine for a reason neither of us can see.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** Workspace-level files a single-item rebuild needs, when they exist. */
const SCAFFOLD = [
  'open-doc.config.ts',
  'open-slide.config.ts',
  'open-sheet.config.ts',
  'pnpm-workspace.yaml',
  'scripts',
];

/** Local specs name a path on the publisher's disk and mean nothing elsewhere. */
const LOCAL_SPEC = /^(link:|file:|workspace:|portal:)/;

export type SourceInput = {
  /** Workspace root — scaffolding is read relative to this. */
  root: string;
  /** The item's own directory, relative to root, e.g. "docs/publish-protocol". */
  dir: string;
  /** The file a rebuild starts from, relative to `dir`. */
  entry: string;
};

export type CollectedSource = {
  dir: string;
  entry: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  /** Keys are paths inside the zip's `source/`. */
  files: Map<string, Uint8Array>;
};

async function collect(dir: string, rel: string): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
  if (entries === null) return out;
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    const key = `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const [k, v] of await collect(abs, key)) out.set(k, v);
    } else if (entry.isFile()) {
      out.set(key, new Uint8Array(await fs.readFile(abs)));
    }
  }
  return out;
}

/**
 * Rewrites a local dependency to the version actually installed.
 *
 * `link:../../open-doc/packages/core` is how the author develops the framework
 * and their own documents side by side. Shipped as-is it is a path that does
 * not exist for anyone else, so the rebuild dies at install with an error about
 * a directory rather than about the dependency.
 */
async function resolveSpecs(
  root: string,
  specs: Record<string, string>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [name, spec] of Object.entries(specs)) {
    if (!LOCAL_SPEC.test(spec)) {
      out[name] = spec;
      continue;
    }
    const installed = path.join(root, 'node_modules', name, 'package.json');
    const raw = await fs.readFile(installed, 'utf8').catch(() => null);
    if (raw === null) {
      throw new Error(
        `${name} is "${spec}" but is not installed, so there is no version to publish it as. ` +
          'Install the workspace before pushing.',
      );
    }
    const version = (JSON.parse(raw) as { version?: string }).version;
    if (typeof version !== 'string') {
      throw new Error(`${name} has no version in its package.json.`);
    }
    out[name] = `^${version}`;
  }
  return out;
}

export async function collectSource(input: SourceInput): Promise<CollectedSource> {
  const itemDir = path.join(input.root, input.dir);
  const files = await collect(itemDir, 'item');
  if (files.size === 0) {
    throw new Error(`No source at ${itemDir} — nothing to publish for editing.`);
  }
  if (!files.has(`item/${input.entry}`)) {
    throw new Error(`${itemDir} has no ${input.entry}.`);
  }

  for (const name of SCAFFOLD) {
    const abs = path.join(input.root, name);
    const stat = await fs.stat(abs).catch(() => null);
    if (stat === null) continue;
    if (stat.isDirectory()) {
      for (const [k, v] of await collect(abs, `scaffold/${name}`)) files.set(k, v);
    } else {
      files.set(`scaffold/${name}`, new Uint8Array(await fs.readFile(abs)));
    }
  }

  const pkgRaw = await fs.readFile(path.join(input.root, 'package.json'), 'utf8').catch(() => null);
  const pkg =
    pkgRaw === null
      ? {}
      : (JSON.parse(pkgRaw) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        });

  return {
    dir: input.dir,
    entry: input.entry,
    dependencies: await resolveSpecs(input.root, pkg.dependencies ?? {}),
    devDependencies: await resolveSpecs(input.root, pkg.devDependencies ?? {}),
    files,
  };
}
