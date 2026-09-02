/**
 * 主題。
 *
 * open-doc、open-slide 和 open-sheet 都把主題放在專案根目錄的 `themes/`，形狀一樣：
 * `<id>.md` 是規格，`<id>.demo.tsx` 是可選的示範。這裡就是把那個資料夾推上去、
 * 再從別台機器拉回來。
 *
 * 主題屬於帳號，不是屬於某一份文件 —— 所以它不走 push/pull 那條以 token 定址的路，
 * 而是以 (框架, id) 定址。同一個 id 在不同框架是兩份主題：open-doc 和 open-sheet
 * 的示範主題都叫 corporate-neutral。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, zipSync } from 'fflate';
import os from 'node:os';
import { DEFAULT_ENDPOINT, kindFromManifest, readManifest } from './defaults.ts';
import { SURFACES } from './integration.ts';
import type { FileKind } from './protocol.ts';
import { ensureBearer } from './push.ts';
import { buildThemeDemo } from './stage.ts';
import { tokenFor } from './state.ts';

const USAGE = `costaff-workspace theme — the themes/ folder, kept in your workspace

  costaff-workspace theme push          push every theme in ./themes
  costaff-workspace theme list          what is up there
  costaff-workspace theme pull <id>     write one back into ./themes
  costaff-workspace theme rm <id>       remove one from the workspace

  --endpoint <url>   receiver (default ${DEFAULT_ENDPOINT})
  --kind <kind>      document | deck | workbook — which framework the theme is
                     for. Read from package.json; pass it when that is wrong.
  --dir <dir>        the themes folder (default themes)
  --bearer <token>   auth token instead of a stored login
  --no-demo          push the specs only; skip building the demos

A theme is <id>.md, and optionally <id>.demo.tsx beside it. The name and
description in the listing come from the .md's own frontmatter, so editing the
file and pushing again is all it takes to change them.
`;

type Options = {
  endpoint: string;
  kind?: FileKind;
  dir: string;
  bearer?: string;
  demo: boolean;
};

const KINDS = new Set<FileKind>(['document', 'deck', 'workbook']);

function parse(argv: string[]): { rest: string[]; opts: Options } {
  const opts: Options = {
    endpoint: process.env.COSTAFF_WORKSPACE_ENDPOINT ?? DEFAULT_ENDPOINT,
    dir: 'themes',
    demo: true,
  };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    const take = (): string => argv[++i] ?? '';
    if (arg === '--endpoint') opts.endpoint = take();
    else if (arg === '--dir') opts.dir = take();
    else if (arg === '--bearer') opts.bearer = take();
    else if (arg === '--no-demo') opts.demo = false;
    else if (arg === '--kind') {
      const value = take();
      if (!KINDS.has(value as FileKind)) throw new Error(`--kind must be document, deck or workbook`);
      opts.kind = value as FileKind;
    } else if (arg.startsWith('-')) throw new Error(`unknown option '${arg}'`);
    else rest.push(arg);
  }
  return { rest, opts };
}

/**
 * 主題是給哪個框架用的。
 *
 * `.md` 本身不說 —— open-doc 的 frontmatter 有 pageSize 和 mode，另外兩個沒有，
 * 但那是「有沒有寫」而不是「是哪一個」，拿來推斷會在第一個沒寫 pageSize 的
 * open-doc 主題上出錯。所以看 package.json 的相依，跟 push 認 kind 是同一套。
 */
async function resolveKind(root: string, given?: FileKind): Promise<FileKind> {
  if (given !== undefined) return given;
  const kind = kindFromManifest(await readManifest(root));
  if (kind === null) {
    throw new Error(
      'could not tell which framework these themes are for — pass --kind document|deck|workbook',
    );
  }
  return kind;
}

async function call(
  opts: Options,
  route: string,
  init: RequestInit & { bearer: string },
): Promise<Response> {
  const { bearer, ...rest } = init;
  const url = new URL(route, opts.endpoint).toString();
  const res = await fetch(url, {
    ...rest,
    headers: { ...(rest.headers ?? {}), authorization: `Bearer ${bearer}` },
  });
  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => (b as { message?: string }).message)
      .catch(() => undefined);
    throw new Error(message ?? `${res.status} from ${url}`);
  }
  return res;
}

/** `<id>.md` 或 `<id>.demo.tsx`，同一份主題的兩個檔案。 */
const THEME_FILE = /^([a-z0-9]+(?:-[a-z0-9]+)*)(\.demo\.tsx|\.md)$/;

async function runPushThemes(opts: Options, out: (s: string) => void): Promise<void> {
  const root = process.cwd();
  const dir = path.resolve(root, opts.dir);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    throw new Error(`no ${opts.dir}/ folder here — nothing to push`);
  }
  const wanted = names.filter((n) => THEME_FILE.test(n)).sort();
  if (wanted.length === 0) throw new Error(`no themes in ${opts.dir}/`);

  const kind = await resolveKind(root, opts.kind);
  const tree: Record<string, Uint8Array> = {};
  for (const name of wanted) tree[name] = new Uint8Array(await fs.readFile(path.join(dir, name)));

  const bearer = opts.bearer ?? (await ensureBearer({ endpoint: opts.endpoint, out }));
  const res = await call(opts, `/v1/themes?kind=${kind}`, {
    bearer,
    method: 'POST',
    body: zipSync(tree),
  });
  const body = (await res.json()) as { themes: string[]; skipped: { id: string; reason: string }[] };

  out(`  ${body.themes.length} ${body.themes.length === 1 ? 'theme' : 'themes'} — ${kind}`);
  for (const id of body.themes) out(`  ${id}`);

  /*
   * 示範。這是慢的那一半 —— 每份約兩秒，因為它是一次真的框架建置。所以規格先推完
   * 再做，一份壞掉不會擋住其餘的，也不會擋住已經上去的規格。
   */
  if (opts.demo) {
    const surface = SURFACES.find((s) => s.kindLabel.toLowerCase() === kindLabelOf(kind));
    for (const id of body.themes) {
      if (!wanted.includes(`${id}.demo.tsx`)) continue;
      if (surface?.itemConfig === undefined) continue;
      try {
        const token = await tokenFor(root, opts.endpoint, `theme-${kind}`, id);
        const outDir = path.join(os.tmpdir(), `costaff-theme-${id}-${Date.now()}`);
        /* 有裸模式就用裸模式，沒有就退回一般的項目設定。 */
        const cfg = surface.demoConfig ?? surface.itemConfig;
        await buildThemeDemo({
          root,
          surface,
          id,
          title: id,
          outDir,
          config: { file: cfg.file, body: cfg.body(token) },
        });
        const tree: Record<string, Uint8Array> = {};
        await collect(outDir, '', tree);
        await fs.rm(outDir, { recursive: true, force: true });
        const route = surface.itemRoute(id);
        /*
         * 頁數。示範檔的 `export default [A, B, C]` 是一串識別字，數得出來 ——
         * 用正規式讀而不求值，跟框架自己讀 meta 是同一套做法。數不出來就不送，
         * 頁面上就不顯示總數，而不是顯示一個編出來的數字。
         */
        const source = await fs.readFile(path.join(dir, `${id}.demo.tsx`), 'utf8');
        const listed = /export\s+default\s+\[([^\]]*)\]/.exec(source)?.[1] ?? '';
        const pages = listed
          .split(',')
          .map((x) => x.trim())
          .filter((x) => /^[A-Za-z_$][\w$]*$/.test(x)).length;
        const q = new URLSearchParams({ token, route });
        if (pages > 0) q.set('pages', String(pages));
        await call(opts, `/v1/themes/${kind}/${id}/demo?${q}`, {
          bearer,
          method: 'POST',
          body: zipSync(tree),
        });
        out(`  ${id} — demo built`);
      } catch (err) {
        /* 說出來。安靜跳過會讓人以為示範上去了，而詳細頁上就是少一塊。 */
        out(`  ${id} — demo skipped: ${String(err instanceof Error ? err.message : err).slice(0, 80)}`);
      }
    }
  }
  /* 被跳過的要說出來。安靜跳過等於讓人以為推上去了。 */
  for (const s of body.skipped) {
    out(`  ${s.id} — skipped, ${s.reason === 'no_spec' ? `no ${s.id}.md beside the demo` : s.reason}`);
  }
}

/** SURFACES 用 kindLabel 說明自己，push 用 kind；這裡把兩邊接起來。 */
function kindLabelOf(kind: FileKind): string {
  return kind === 'document' ? 'document' : kind === 'deck' ? 'deck' : 'workbook';
}

async function collect(dir: string, prefix: string, into: Record<string, Uint8Array>): Promise<void> {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const name = prefix === '' ? e.name : `${prefix}/${e.name}`;
    if (e.isDirectory()) await collect(full, name, into);
    else into[name] = new Uint8Array(await fs.readFile(full));
  }
}

async function runList(opts: Options, out: (s: string) => void): Promise<void> {
  const bearer = opts.bearer ?? (await ensureBearer({ endpoint: opts.endpoint, out }));
  const res = await call(opts, '/v1/themes', { bearer });
  const { themes } = (await res.json()) as {
    themes: { id: string; kind: string; name: string; description: string; hasDemo: boolean }[];
  };
  if (themes.length === 0) {
    out('  no themes yet — run `costaff-workspace theme push` in a project that has some');
    return;
  }
  const width = Math.max(...themes.map((t) => t.id.length));
  for (const t of themes) {
    out(`  ${t.id.padEnd(width)}  ${t.kind.padEnd(9)}${t.name}${t.hasDemo ? '' : '  (no demo)'}`);
  }
}

async function runPullTheme(opts: Options, id: string, out: (s: string) => void): Promise<void> {
  const root = process.cwd();
  const kind = await resolveKind(root, opts.kind);
  const bearer = opts.bearer ?? (await ensureBearer({ endpoint: opts.endpoint, out }));
  const res = await call(opts, `/v1/themes/${kind}/${id}`, { bearer });
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));

  const dir = path.resolve(root, opts.dir);
  await fs.mkdir(dir, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    /* 伺服器不該送出這種名字，但寫檔的是這裡，所以檢查也在這裡。 */
    if (!THEME_FILE.test(name)) throw new Error(`refusing to write '${name}'`);
    await fs.writeFile(path.join(dir, name), bytes);
    out(`  ${path.join(opts.dir, name)}`);
  }
}

async function runRemove(opts: Options, id: string, out: (s: string) => void): Promise<void> {
  const kind = await resolveKind(process.cwd(), opts.kind);
  const bearer = opts.bearer ?? (await ensureBearer({ endpoint: opts.endpoint, out }));
  await call(opts, `/v1/themes/${kind}/${id}`, { bearer, method: 'DELETE' });
  out(`  removed ${id} (${kind})`);
}

export async function runTheme(argv: string[]): Promise<void> {
  if (argv[0] === '--help' || argv[0] === '-h' || argv.length === 0) {
    process.stdout.write(USAGE);
    return;
  }
  const out = (line: string): void => {
    process.stdout.write(`${line}\n`);
  };
  const { rest, opts } = parse(argv.slice(1));
  const action = argv[0];

  switch (action) {
    case 'push':
      return runPushThemes(opts, out);
    case 'list':
    case 'ls':
      return runList(opts, out);
    case 'pull': {
      const id = rest[0];
      if (id === undefined) throw new Error('theme pull needs an id — see `theme list`');
      return runPullTheme(opts, id, out);
    }
    case 'rm':
    case 'remove': {
      const id = rest[0];
      if (id === undefined) throw new Error('theme rm needs an id — see `theme list`');
      return runRemove(opts, id, out);
    }
    default:
      process.stderr.write(`error: unknown theme action '${action}'\n\n${USAGE}`);
      process.exit(1);
  }
}
