/**
 * Fetching a published file's source back out, so it can be worked on again.
 *
 * The receiver decides what comes back: an owner gets the state file that makes
 * the next push update the same link, anyone else gets a copy that cannot
 * address it. Nothing here has to know which case it is — asking would mean two
 * clients could disagree about who owns what.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { PublishError, discover, formatBytes } from './client.ts';
import { loadCredential } from './credentials.ts';

export type PullOptions = {
  endpoint: string;
  token: string;
  /** Where to write. Defaults to a new directory named after the file. */
  dir?: string;
  force?: boolean;
  bearer?: string;
  out?: (line: string) => void;
  /** Supplied by the CLI so the device flow is not duplicated here. */
  signIn?: () => Promise<string>;
};

export type PullResult = { dir: string; files: number; bytes: number };

async function isEmpty(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir).catch(() => null);
  return entries === null || entries.length === 0;
}

export async function pull(opts: PullOptions): Promise<PullResult> {
  const write = opts.out ?? ((): void => {});
  const endpoint = new URL(opts.endpoint).toString().replace(/\/$/, '');
  const discovery = await discover(endpoint);
  if (discovery.pull === undefined) {
    throw new PublishError(`${discovery.name} does not hand source back.`);
  }

  let bearer = opts.bearer ?? (await loadCredential(endpoint))?.token;
  if (bearer === undefined) {
    if (opts.signIn === undefined) throw new PublishError('Sign in first — run with --login.');
    bearer = await opts.signIn();
  }

  const url = `${endpoint}${discovery.pull}/${opts.token}`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${bearer}` } });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new PublishError(body.message ?? `Pull failed (${response.status}).`, response.status);
  }

  const zip = new Uint8Array(await response.arrayBuffer());
  const { unzipSync } = await import('fflate');
  const entries = unzipSync(zip);

  const target = path.resolve(opts.dir ?? opts.token);
  if (opts.force !== true && !(await isEmpty(target))) {
    throw new PublishError(
      `${target} is not empty. Pass --force to write into it anyway, or name another directory.`,
    );
  }

  let bytes = 0;
  let files = 0;
  for (const [name, content] of Object.entries(entries)) {
    if (name.endsWith('/')) continue;
    /*
     * The archive comes from a server, so its names are input: a "../" here
     * would write outside the directory the user named.
     */
    const abs = path.resolve(target, name);
    if (abs !== target && !abs.startsWith(target + path.sep)) {
      throw new PublishError(`Refusing an archive entry that escapes the directory: ${name}`);
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
    bytes += content.byteLength;
    files += 1;
  }

  write(`pulled ${files} files (${formatBytes(bytes)}) into ${target}\n`);
  return { dir: target, files, bytes };
}
