import fs from 'node:fs/promises';
import path from 'node:path';
import type { Entry, Surface } from './integration.ts';

const DEFAULT_ENTRIES = ['index.tsx', 'index.jsx', 'index.ts', 'index.js'];

/** Same technique the frameworks use to read their own `meta` — never evaluate the module. */
function metaField(source: string, field: string): string | undefined {
  const m = source.match(new RegExp(`['"]?${field}['"]?\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`));
  return m === null ? undefined : m[2];
}

/** Supports SQL-based items like open-dashboard queries.sql (`-- @title: ...` or `-- title: ...`). */
function sqlCommentMeta(source: string, field: string): string | undefined {
  const m = source.match(new RegExp(`^\\s*--\\s*@?${field}\\s*:\\s*(.+)$`, 'im'));
  return m === null ? undefined : m[1]?.trim();
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
  const candidates = surface.entryFiles ?? DEFAULT_ENTRIES;
  const entries: Entry[] = [];
  for (const id of ids) {
    const sources: string[] = [];
    let entryFile = '';
    for (const candidate of candidates) {
      try {
        const content = await fs.readFile(path.join(base, id, candidate), 'utf8');
        sources.push(content);
        if (entryFile === '') entryFile = candidate;
      } catch {
        // Try the next candidate.
      }
    }
    if (entryFile === '') continue;
    const entry: Entry = { id, entryFile };
    for (const f of surface.metaFields) {
      for (const source of sources) {
        const val = metaField(source, f) ?? sqlCommentMeta(source, f);
        if (val !== undefined) {
          (entry as Record<string, unknown>)[f] = val;
          break;
        }
      }
    }
    entries.push(entry);
  }
  return entries;
}
