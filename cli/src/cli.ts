import { PublishError } from './client.ts';
import {
  DEFAULT_ENDPOINT,
  kindFromManifest,
  readManifest,
  slugFromDir,
  titleFromManifest,
} from './defaults.ts';
import { pushProject, realBuildItem, scanProject } from './project.ts';
import type { FileKind } from './protocol.ts';
import { type PushOptions, push } from './push.ts';

const USAGE = `costaff-workspace push — push one built file into your workspace

  costaff-workspace push [options]

Run it in the project folder with nothing else and it works out the rest:
the folder name is the slug, package.json says which kind, dist/ is the
bundle, and the source travels with it so it can be pulled back and edited.

  --endpoint <url>     receiver (default ${DEFAULT_ENDPOINT},
                       or COSTAFF_WORKSPACE_ENDPOINT)
  --slug <slug>        the file's identity (default: the folder's name)
  --kind <kind>        document | workbook | deck (default: read from
                       package.json, else document)
  --site-dir <dir>     built bundle to upload (default dist)
  --title <text>       display name (default: package.json description,
                       else the slug)
  --subtitle <text>
  --folder <name>      folder in the file manager
  --route <path>       route inside the bundle (default /)
  --entry <file>       entry file inside the bundle (default index.html)
  --source-dir <dir>   the item's source, relative to --source-root
                       (default: the whole project)
  --source-root <dir>  workspace root the source and its build setup live in
                       (default: the current directory)
  --no-source          publish the built bundle alone; nothing can be pulled
                       back out of it afterwards
  --source-entry <f>   file a rebuild starts from (default index.tsx)
  --token <token>      override the remembered public address
  --bearer <token>     auth token instead of a stored login
  --login              sign in again even if a token is stored;
                       on its own (with --endpoint) it just signs in
  --logout             forget the stored login for this endpoint
  --dry-run            package and report, do not upload
`;

const KINDS = new Set<FileKind>(['document', 'workbook', 'deck']);

type Parsed = PushOptions & {
  help: boolean;
  given: { slug: boolean; kind: boolean; title: boolean };
  noSource: boolean;
};

function parse(argv: string[]): Parsed {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[name] = next;
      i += 1;
    } else {
      flags[name] = true;
    }
  }
  const str = (k: string): string | undefined =>
    typeof flags[k] === 'string' ? (flags[k] as string) : undefined;

  const kind = (str('kind') ?? 'document') as FileKind;
  if (!KINDS.has(kind)) throw new PublishError(`--kind must be one of ${[...KINDS].join(', ')}`);

  const slug = str('slug') ?? '';
  return {
    help: flags.help === true || flags.h === true,
    /* 猜測要能被說出來，所以記下哪些是使用者自己給的。 */
    given: {
      slug: str('slug') !== undefined,
      kind: str('kind') !== undefined,
      title: str('title') !== undefined,
    },
    noSource: flags['no-source'] === true,
    endpoint: str('endpoint') ?? process.env.COSTAFF_WORKSPACE_ENDPOINT ?? DEFAULT_ENDPOINT,
    slug,
    kind,
    title: str('title') ?? slug,
    subtitle: str('subtitle'),
    folder: str('folder') ?? null,
    route: str('route') ?? '/',
    entry: str('entry'),
    siteDir: str('site-dir') ?? 'dist',
    sourceRoot: str('source-root') ?? process.cwd(),
    sourceDir: str('source-dir'),
    sourceEntry: str('source-entry'),
    token: str('token'),
    bearer: str('bearer'),
    login: flags.login === true,
    logout: flags.logout === true,
    dryRun: flags['dry-run'] === true,
    out: (line) => process.stdout.write(line),
  };
}

/*
 * 補上沒給的值，並且把每一個猜測印出來。安靜猜錯比要求人打完整指令更糟 —— 推錯
 * 位置的人得看得出來是哪一個猜測害的。
 */
async function fill(opts: Parsed): Promise<void> {
  const root = opts.sourceRoot ?? process.cwd();
  const guessed: string[] = [];

  if (!opts.given.slug) {
    const slug = slugFromDir(root);
    if (slug === null) {
      throw new PublishError(
        `cannot make a slug out of the folder name — pass --slug (lowercase letters, digits and dashes)`,
      );
    }
    opts.slug = slug;
    guessed.push(`--slug ${slug}`);
  }

  const manifest = await readManifest(root);

  if (!opts.given.kind) {
    const kind = kindFromManifest(manifest);
    if (kind !== null) {
      opts.kind = kind;
      guessed.push(`--kind ${kind}`);
    }
  }

  if (!opts.given.title) {
    opts.title = titleFromManifest(manifest, opts.slug);
  }

  /*
   * 原始碼預設跟著走：沒有它，推上去的東西之後拉不回來改，而那正是這個服務
   * 存在的理由。--no-source 是明確的退出方式。
   */
  if (opts.noSource) {
    opts.sourceRoot = undefined;
    opts.sourceDir = undefined;
  } else if (opts.sourceDir === undefined) {
    opts.sourceDir = '.';
    guessed.push('--source-dir .');
  }

  if (guessed.length > 0) opts.out?.(`  guessed ${guessed.join('  ')}\n`);
}

export async function runPush(argv: string[]): Promise<void> {
  const opts = parse(argv);
  if (opts.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (!opts.logout && opts.endpoint === '') {
    process.stderr.write(`error: missing --endpoint\n\n${USAGE}`);
    process.exit(1);
  }
  if (opts.logout || opts.login) {
    await push(opts);
    return;
  }

  /*
   * 一個 open-doc／open-slide／open-sheet 專案是一個站台含多份文件，不是一份
   * 檔案。每一份各自建置、各自推 —— 共用的 bundle 裡，拿到其中一份連結的人就能
   * 抓到其餘的 chunk，那樣分享設定擋不住任何東西。
   *
   * 明確給了 --slug 的人是在手動推某一份，照他說的做。
   */
  const root = opts.sourceRoot ?? process.cwd();
  const items = opts.given.slug ? [] : await scanProject(root);
  if (items.length > 0) {
    /* kindLabel, not label: label is the workspace shell's Chinese wording, and
       every other line this command prints is English. */
    const by = new Map<string, number>();
    for (const it of items) {
      const kind = it.surface.kindLabel.toLowerCase();
      by.set(kind, (by.get(kind) ?? 0) + 1);
    }
    const shape = [...by].map(([kind, n]) => `${n} ${kind}${n === 1 ? '' : 's'}`).join(', ');
    process.stdout.write(`  ${shape} — one bundle each\n`);
    await pushProject({
      root,
      endpoint: opts.endpoint,
      items,
      dryRun: opts.dryRun,
      buildItem: realBuildItem,
      base: { bearer: opts.bearer, folder: opts.folder },
    });
    return;
  }

  await fill(opts);
  await push(opts);
}
