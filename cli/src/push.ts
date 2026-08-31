import { createBundle } from './bundle.ts';
import { PublishError, discover, formatBytes, pollDeviceAuth, startDeviceAuth, upload } from './client.ts';
import { clearCredential, loadCredential, saveCredential } from './credentials.ts';
import type { FileKind, PushResult } from './protocol.ts';
import { collectSource } from './source.ts';
import { forgetToken, rememberUrl, tokenFor } from './state.ts';

export type PushOptions = {
  endpoint: string;
  siteDir: string;
  slug: string;
  kind: FileKind;
  title: string;
  route: string;
  entry?: string;
  subtitle?: string;
  folder?: string | null;
  token?: string;
  /*
   * Set these three together to publish a file that can be pulled back and
   * edited. Leaving them unset publishes the site alone, exactly as before.
   */
  sourceRoot?: string;
  sourceDir?: string;
  sourceEntry?: string;
  bearer?: string;
  login?: boolean;
  logout?: boolean;
  dryRun?: boolean;
  cwd?: string;
  out?: (line: string) => void;
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Exported so `pull` runs the same device flow rather than its own. */
export async function login(
  opts: { endpoint: string; out?: (line: string) => void },
  name: string,
): Promise<string> {
  const write = opts.out ?? (() => {});
  const discovery = await discover(opts.endpoint);
  const start = await startDeviceAuth(opts.endpoint, discovery);
  write(`\n  Sign in to ${name}\n  open  ${start.verificationUri}\n  code  ${start.userCode}\n\n`);

  const deadline = Date.now() + start.expiresIn * 1000;
  let interval = Math.max(1, start.interval) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval);
    const result = await pollDeviceAuth(opts.endpoint, discovery, start.deviceCode);
    if (result.status === 'ok') {
      await saveCredential(opts.endpoint, {
        token: result.token,
        expiresAt: result.expiresAt,
        account: result.account,
      });
      write(`  signed in${result.account === undefined ? '' : ` as ${result.account}`}\n\n`);
      return result.token;
    }
    if (result.status === 'slow_down') {
      interval = Math.max(interval, result.interval * 1000);
      continue;
    }
    if (result.status === 'denied') throw new PublishError('Sign-in was denied.');
    if (result.status === 'expired') throw new PublishError('Sign-in code expired.');
  }
  throw new PublishError('Sign-in timed out.');
}

/**
 * 取得憑證，需要的話走裝置流程。
 *
 * 匯出是為了讓一次推很多份的呼叫端可以先登入一次 —— 裝置授權碼是印給人看的，
 * 而印它的 out 和推送進度的 out 是同一個。把進度靜音就等於把授權碼靜音，然後
 * 它會安靜地輪詢到過期。先登入，就沒有那個機會。
 */
export async function ensureBearer(opts: {
  endpoint: string;
  bearer?: string;
  out?: (line: string) => void;
}): Promise<string> {
  const endpoint = new URL(opts.endpoint).toString();
  return resolveBearer({ ...opts, endpoint, slug: '', kind: 'document', title: '', route: '/', siteDir: '' },
    (await discover(endpoint)).name);
}

async function resolveBearer(opts: PushOptions, name: string): Promise<string> {
  if (opts.bearer !== undefined) return opts.bearer;
  const fromEnv = process.env.COSTAFF_WORKSPACE_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (opts.login !== true) {
    const stored = await loadCredential(opts.endpoint);
    if (stored !== null) return stored.token;
  }
  return login(opts, name);
}

export async function push(opts: PushOptions): Promise<PushResult | null> {
  const write = opts.out ?? (() => {});
  const cwd = opts.cwd ?? process.cwd();
  const endpoint = new URL(opts.endpoint).toString();

  if (opts.logout === true) {
    await clearCredential(endpoint);
    write(`signed out of ${endpoint}\n`);
    return null;
  }

  // Signing in is useful on its own — a scripted push runs non-interactively
  // and cannot show a device code, so the login is done once up front.
  if (opts.login === true && opts.slug === '') {
    await resolveBearer(opts, (await discover(endpoint)).name);
    return null;
  }

  // The token is settled before anything is packed: the bundle's asset paths
  // were baked against it at build time, so discovering it late would mean
  // discovering it wrong.
  const token = opts.token ?? (await tokenFor(cwd, endpoint, opts.kind, opts.slug));

  const source =
    opts.sourceRoot === undefined || opts.sourceDir === undefined
      ? undefined
      : await collectSource({
          root: opts.sourceRoot,
          dir: opts.sourceDir,
          entry: opts.sourceEntry ?? 'index.tsx',
        });

  const bundle = await createBundle({
    source,
    siteDir: opts.siteDir,
    pushedAt: new Date().toISOString(),
    manifest: {
      slug: opts.slug,
      kind: opts.kind,
      token,
      title: opts.title,
      subtitle: opts.subtitle,
      folder: opts.folder,
      route: opts.route,
      entry: opts.entry ?? 'index.html',
    },
  });

  const summary =
    `${bundle.manifest.entry} + ${formatBytes(bundle.bytes.byteLength)}` +
    (source === undefined ? '' : `, source included (${source.files.size} files)`);
  /*
   * 乾跑到此為止，而且刻意在 discover 之前 —— 它的工作是打包並回報，那件事不需要
   * 網路。要它先連上伺服器，等於在飛機上、或伺服器還沒上線時就不能檢查自己的設定。
   */
  if (opts.dryRun === true) {
    write(`would push ${opts.slug} to ${endpoint}\n  ${summary}\n`);
    return null;
  }

  const discovery = await discover(endpoint);
  let bearer = await resolveBearer(opts, discovery.name);
  let result: PushResult;
  try {
    result = await upload(endpoint, discovery, bearer, bundle.bytes);
  } catch (err) {
    /*
     * Push credentials expire, and the receiver may end one early from the
     * devices page. Either way the stored copy is worthless, so it is dropped
     * and the device flow runs again rather than telling someone to pass a flag
     * they would only ever answer with "yes".
     */
    if (err instanceof PublishError && (err.status === 401 || err.status === 403)) {
      await clearCredential(endpoint);
      bearer = await login(opts, discovery.name);
      result = await upload(endpoint, discovery, bearer, bundle.bytes);
      await rememberUrl(cwd, endpoint, opts.kind, opts.slug, token, result.url);
      write(`${result.updated ? 'updated' : 'pushed'} ${result.workspace}/${opts.slug}\n  ${result.url}\n`);
      return result;
    }
    // The remembered address is spoken for by another file, so it can never
    // work for this one. Forgetting it lets the next run mint a fresh token —
    // the bundle cannot be re-baked here, since its asset paths carry the old
    // one, so recovery has to be the next build rather than a retry.
    if (err instanceof PublishError && err.code === 'token_taken') {
      const forgot = await forgetToken(cwd, endpoint, opts.kind, opts.slug, token);
      if (forgot) {
        throw new PublishError(`${err.message} Forgot it — build and push again.`, err.status);
      }
    }
    throw err;
  }
  await rememberUrl(cwd, endpoint, opts.kind, opts.slug, token, result.url);

  write(`${result.updated ? 'updated' : 'pushed'} ${result.workspace}/${opts.slug}\n  ${result.url}\n`);
  if (!result.updated) write('  只有你看得到 — 在網頁上開這份檔案，用「分享」決定誰能看\n');
  return result;
}
