import fs from 'node:fs/promises';
import path from 'node:path';
import type { Entry, Surface } from './integration.ts';

/** Same technique the frameworks use to read their own `meta` — never evaluate the module. */
function metaField(source: string, field: string): string | undefined {
  const m = source.match(new RegExp(`${field}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`));
  return m === null ? undefined : m[2];
}

export async function readEntries(root: string, surface: Surface): Promise<Entry[]> {
  const base = path.join(root, surface.dir);
  let ids: string[];
  try {
    ids = (await fs.readdir(base, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
  const entries: Entry[] = [];
  for (const id of ids) {
    let source = '';
    for (const ext of ['tsx', 'jsx', 'ts', 'js']) {
      try {
        source = await fs.readFile(path.join(base, id, `index.${ext}`), 'utf8');
        break;
      } catch {
        // Try the next extension.
      }
    }
    if (source === '') continue;
    const entry: Entry = { id };
    for (const f of surface.metaFields) {
      (entry as Record<string, unknown>)[f] = metaField(source, f);
    }
    entries.push(entry);
  }
  return entries;
}
