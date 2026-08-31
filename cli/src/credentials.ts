import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type StoredCredential = {
  token: string;
  expiresAt?: string;
  account?: string;
};

type Store = { version: 1; endpoints: Record<string, StoredCredential> };

export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), '.config');
  return path.join(base, 'costaff-workspace', 'credentials.json');
}

/**
 * Tokens are filed per endpoint origin, not per full URL: a receiver that moves
 * its publish path must not orphan a valid login, and two endpoints on one host
 * would share a session anyway.
 */
export function credentialKey(endpoint: string): string {
  return new URL(endpoint).origin;
}

async function readStore(file: string): Promise<Store> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Store).endpoints === 'object'
    ) {
      return parsed as Store;
    }
  } catch {
    // A missing or corrupt store is a logged-out state, not a failure.
  }
  return { version: 1, endpoints: {} };
}

export function isExpired(cred: StoredCredential, now = Date.now()): boolean {
  if (cred.expiresAt === undefined) return false;
  const at = Date.parse(cred.expiresAt);
  return Number.isFinite(at) && at <= now;
}

export async function loadCredential(
  endpoint: string,
  file = credentialsPath(),
): Promise<StoredCredential | null> {
  const store = await readStore(file);
  const cred = store.endpoints[credentialKey(endpoint)];
  if (cred === undefined || isExpired(cred)) return null;
  return cred;
}

export async function saveCredential(
  endpoint: string,
  cred: StoredCredential,
  file = credentialsPath(),
): Promise<void> {
  const store = await readStore(file);
  store.endpoints[credentialKey(endpoint)] = cred;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600).catch(() => {});
}

export async function clearCredential(endpoint: string, file = credentialsPath()): Promise<void> {
  const store = await readStore(file);
  delete store.endpoints[credentialKey(endpoint)];
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}
