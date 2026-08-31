import fs from 'node:fs/promises';
import path from 'node:path';
import { PUSH_PROTOCOL, type PushManifest } from './protocol.ts';
import type { CollectedSource } from './source.ts';

export type BundleInput = {
  siteDir: string;
  pushedAt: string;
  manifest: Omit<PushManifest, 'protocol' | 'pushedAt' | 'source'>;
  /** Omitted for a push that only publishes; present for one that can be pulled back. */
  source?: CollectedSource;
};

export type Bundle = { bytes: Uint8Array; manifest: PushManifest };

interface FileTree {
  [name: string]: Uint8Array | FileTree;
}

async function collect(dir: string, rel = ''): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const key = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const [k, v] of await collect(abs, key)) out.set(k, v);
    } else if (entry.isFile()) {
      out.set(key, new Uint8Array(await fs.readFile(abs)));
    }
  }
  return out;
}

function nest(files: Map<string, Uint8Array>): FileTree {
  const tree: FileTree = {};
  for (const [key, bytes] of files) {
    const parts = key.split('/');
    let node = tree;
    for (const part of parts.slice(0, -1)) {
      const next = node[part];
      if (next === undefined || next instanceof Uint8Array) {
        const created: FileTree = {};
        node[part] = created;
        node = created;
      } else {
        node = next;
      }
    }
    node[parts[parts.length - 1]] = bytes;
  }
  return tree;
}

/**
 * Zips one file's built site plus its manifest.
 *
 * The manifest travels inside the zip rather than in a header so a receiver
 * never has to parse metadata out of a size-capped header, and so the archive
 * is self-describing once it lands in storage.
 *
 * Nothing here inspects the site: what the manifest says is what the caller
 * stated. A publisher that guessed would sooner or later name something the
 * recipient was never given.
 */
export async function createBundle(input: BundleInput): Promise<Bundle> {
  const stat = await fs.stat(input.siteDir).catch(() => null);
  if (stat === null || !stat.isDirectory()) {
    throw new Error(`No site at ${input.siteDir} — build it first.`);
  }

  const files = await collect(input.siteDir);
  const entry = input.manifest.entry;
  if (!files.has(entry)) {
    throw new Error(`${input.siteDir} has no ${entry} — it is not a publishable site.`);
  }

  const manifest: PushManifest = {
    ...input.manifest,
    protocol: PUSH_PROTOCOL,
    pushedAt: input.pushedAt,
    ...(input.source === undefined
      ? {}
      : {
          source: {
            dir: input.source.dir,
            entry: input.source.entry,
            dependencies: input.source.dependencies,
            devDependencies: input.source.devDependencies,
          },
        }),
  };

  const { zipSync } = await import('fflate');
  const tree: FileTree = {
    'manifest.json': new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
    site: nest(files),
    ...(input.source === undefined ? {} : { source: nest(input.source.files) }),
  };
  return { bytes: zipSync(tree as Parameters<typeof zipSync>[0]), manifest };
}
