import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

type Entry = { token: string; url?: string };
type State = { version: 1; endpoints: Record<string, Record<string, Entry>> };

/**
 * Remembers each file's public address.
 *
 * The token is generated here, before the build, because the bundle's asset
 * paths are baked against it — and it is remembered so a second push updates
 * the same link instead of scattering a new one. It holds no secret: committing
 * this file is the supported way for a team to keep one set of links.
 */
export function statePath(userCwd: string): string {
  return path.join(userCwd, '.costaff-workspace', 'files.json');
}

const originOf = (endpoint: string): string => new URL(endpoint).origin;

/**
 * Keyed by kind and slug within an endpoint.
 *
 * It used to carry a workspace name too, because one project could be pushed
 * into two of them and a shared token would collide. An account now has exactly
 * one workspace, decided by the receiver from the credentials — so within an
 * endpoint there is nothing left for a workspace segment to disambiguate.
 */
const keyOf = (kind: string, slug: string): string => `${kind}/${slug}`;

async function read(file: string): Promise<State> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as State;
    if (typeof parsed.endpoints === 'object' && parsed.endpoints !== null) return parsed;
  } catch {
    // No state yet, or it was hand-edited into something unreadable.
  }
  return { version: 1, endpoints: {} };
}

/** Lowercase alphanumerics only: the token is a path segment in every link. */
export function newToken(): string {
  return randomBytes(16).toString('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20);
}

export async function tokenFor(
  userCwd: string,
  endpoint: string,
  kind: string,
  slug: string,
): Promise<string> {
  const file = statePath(userCwd);
  const state = await read(file);
  const origin = originOf(endpoint);
  const key = keyOf(kind, slug);
  const forOrigin = state.endpoints[origin] ?? {};

  const existing = forOrigin[key]?.token;
  if (existing !== undefined) return existing;

  /*
   * An entry written when the key carried a workspace still points at a live
   * link, so it is adopted rather than replaced — the first one found wins and
   * the old key is dropped. Losing it would mint a new token and quietly orphan
   * whatever had already been shared.
   */
  const rest: Record<string, Entry> = {};
  let adopted: Entry | undefined;
  const suffix = `/${kind}/${slug}`;
  for (const [k, v] of Object.entries(forOrigin)) {
    if (adopted === undefined && k.endsWith(suffix) && k !== key) adopted = v;
    else rest[k] = v;
  }
  const entry = adopted ?? { token: newToken() };

  state.endpoints[origin] = { ...rest, [key]: entry };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
  return entry.token;
}

export async function rememberUrl(
  userCwd: string,
  endpoint: string,
  kind: string,
  slug: string,
  token: string,
  url: string,
): Promise<void> {
  const file = statePath(userCwd);
  const state = await read(file);
  const origin = originOf(endpoint);
  state.endpoints[origin] = {
    ...state.endpoints[origin],
    [keyOf(kind, slug)]: { token, url },
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Drops a remembered token the receiver has refused, so the next run mints a
 * fresh one. Only the entry that actually holds `token` is removed: a caller
 * may pass an address of its own, and that must not clear an unrelated one.
 */
export async function forgetToken(
  userCwd: string,
  endpoint: string,
  kind: string,
  slug: string,
  token: string,
): Promise<boolean> {
  const file = statePath(userCwd);
  const state = await read(file);
  const origin = originOf(endpoint);
  const forOrigin = state.endpoints[origin];
  if (forOrigin === undefined) return false;
  const key = keyOf(kind, slug);
  if (forOrigin[key]?.token !== token) return false;
  const { [key]: _dropped, ...rest } = forOrigin;
  state.endpoints[origin] = rest;
  await fs.writeFile(file, `${JSON.stringify(state, null, 2)}\n`);
  return true;
}
