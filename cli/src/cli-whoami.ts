/**
 * 這台機器是誰。
 *
 * 一個 skill 在做任何事之前要先知道的是「需不需要請人去登入一次」—— 裝置碼那一步
 * 必須有人在瀏覽器按核准，agent 做不到，所以它得問得出來、而且要便宜。原本唯一的
 * 問法是推推看，或拿 `theme list` 當探針。
 *
 * 不連網。答的是「這裡有沒有一份還沒過期的憑證、從哪裡來的」—— 那正是決定要不要
 * 找人的那件事。伺服器那邊是否仍然認得它，要到真的用的時候才知道，這一點說明白。
 */

import { loadCredential } from './credentials.ts';
import { DEFAULT_ENDPOINT } from './defaults.ts';
import { done, line } from './report.ts';

const USAGE = `costaff-workspace whoami — what this machine is signed in as

  costaff-workspace whoami [--endpoint <url>] [--json]

Reads what is stored here; it does not call the workspace. A token that was
revoked on the other side still shows up until something tries to use it.
`;

export type Who = {
  endpoint: string;
  signedIn: boolean;
  /** 憑證是從哪裡來的 —— 決定「要人去登入」是不是有意義的建議。 */
  source: 'flag' | 'env' | 'stored' | 'none';
  account: string | null;
  expiresAt: string | null;
};

export async function whoami(
  endpoint: string,
  bearer: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  /* 測試給自己的檔案。預設是真的那一份，所以呼叫端不必知道它在哪。 */
  file?: string,
): Promise<Who> {
  const base = { endpoint, account: null, expiresAt: null };
  if (bearer !== undefined && bearer !== '') {
    return { ...base, signedIn: true, source: 'flag' };
  }
  const fromEnv = env.COSTAFF_WORKSPACE_TOKEN?.trim();
  if (fromEnv) return { ...base, signedIn: true, source: 'env' };

  const stored = await loadCredential(endpoint, file);
  if (stored === null) return { ...base, signedIn: false, source: 'none' };
  return {
    endpoint,
    signedIn: true,
    source: 'stored',
    account: stored.account ?? null,
    expiresAt: stored.expiresAt ?? null,
  };
}

const WHERE: Record<Who['source'], string> = {
  flag: 'from --bearer',
  env: 'from COSTAFF_WORKSPACE_TOKEN',
  stored: 'signed in on this machine',
  none: '',
};

export async function runWhoami(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  const at = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const endpoint = at('endpoint') ?? process.env.COSTAFF_WORKSPACE_ENDPOINT ?? DEFAULT_ENDPOINT;
  const who = await whoami(endpoint, at('bearer'));

  if (!who.signedIn) {
    line(`not signed in to ${who.endpoint}\n  run  costaff-workspace login\n`);
  } else {
    const as = who.account === null ? '' : ` as ${who.account}`;
    line(`signed in to ${who.endpoint}${as}\n  ${WHERE[who.source]}\n`);
  }
  done({ command: 'whoami', ...who });
}
