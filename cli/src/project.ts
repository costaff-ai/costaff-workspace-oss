/**
 * 一個專案裡的每一份文件，各自一個 bundle。
 *
 * 這是整份程式碼裡最容易被「簡化」掉的地方，所以說清楚為什麼不能：一個
 * open-doc 專案是一個站台含多份文件，`open-doc build` 產出的 dist/ 裡四份文件
 * 共用同一個 assets/ 目錄。把那個 dist/ 當成一份檔案推上去，分享其中一份，拿到
 * 連結的人就能抓到另外三份的 chunk —— 分享設定要能擋住其餘的東西，唯一的辦法
 * 是其餘的東西根本不在那個 bundle 裡。
 *
 * 代價是真的：N 次建置而不是一次，資產在各個 bundle 之間重複。
 *
 * token 必須在建置之前決定，不是之後：它是檔案的公開位址，而 bundle 的資產路徑
 * 是照著它烘進去的，晚一步決定就是決定錯。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { readEntries } from './entries.ts';
import { type Entry, SURFACES, type Surface } from './integration.ts';
import type { FileKind } from './protocol.ts';
import { ensureBearer, type PushOptions, push } from './push.ts';
import { tokenFor } from './state.ts';

export type ProjectItem = { surface: Surface; entry: Entry };

/** 這個資料夾裡有哪些可以推的東西。空陣列表示它不是多文件專案。 */
export async function scanProject(root: string): Promise<ProjectItem[]> {
  const items: ProjectItem[] = [];
  for (const surface of SURFACES) {
    for (const entry of await readEntries(root, surface)) items.push({ surface, entry });
  }
  return items;
}

/** open-sheet 產出的是匯出檔不是網頁，所以 bundle 需要一個入口頁。 */
function sheetPage(entry: Entry, token: string): string {
  const esc = (s: unknown): string =>
    String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const title = entry.title ?? entry.id;
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
  html,body{height:100%;margin:0;display:flex;flex-direction:column;
    font:14px/1.6 -apple-system,"PingFang TC",system-ui,sans-serif;background:#fff;color:#14171f}
  header{display:flex;height:48px;flex:none;align-items:center;gap:12px;padding:0 16px;
    border-bottom:1px solid #e3e6ec}
  h1{margin:0;font-size:14px;font-weight:500}
  a.dl{margin-left:auto;font-size:13px;color:#1e4fd8;text-decoration:none}
  main{flex:1;min-height:0;background:#f1f5f9}
  iframe{display:block;width:100%;height:100%;border:0;color-scheme:light}
</style></head><body>
<header><h1>${esc(title)}</h1><a class="dl" href="/${esc(token)}/${esc(entry.id)}.xlsx" download>下載 xlsx</a></header>
<main><iframe src="/${esc(token)}/${esc(entry.id)}.html" title="${esc(title)}"></iframe></main>
</body></html>`;
}

/*
 * buildItem 住在 stage.ts，用 execFileSync 呼叫框架自己的 CLI。這裡重新宣告它的
 * 型別而不是直接匯入，是為了讓建置可以在測試裡被換掉 —— 真的去跑一次 vite 建置
 * 的測試會慢到沒有人願意跑它。
 */
export type BuildItem = (opts: {
  root: string;
  surface: Surface;
  id: string;
  outDir: string;
  config?: { file: string; body: string };
}) => Promise<void>;

export async function pushProject(opts: {
  root: string;
  endpoint: string;
  items: ProjectItem[];
  dryRun?: boolean;
  buildItem: BuildItem;
  base?: Partial<PushOptions>;
  out?: (line: string) => void;
}): Promise<void> {
  const { root, endpoint, items, buildItem } = opts;
  const write = opts.out ?? ((line: string) => process.stdout.write(line));
  const dist = path.join(root, 'dist');
  const scratch = path.join(root, '.build');

  await fs.rm(scratch, { recursive: true, force: true });

  /*
   * 一次登入，不是每一份各登一次。裝置授權碼是印給人看的，而每一份推送的輸出是
   * 靜音的（否則四份的進度會蓋掉彼此）—— 靜音的 out 也會把授權碼吞掉，然後整件事
   * 停在那裡輪詢到過期。乾跑不需要憑證，所以也不必連線。
   */
  const bearer =
    opts.dryRun === true ? undefined : (opts.base?.bearer ?? (await ensureBearer({ endpoint, out: write })));

  for (const { surface, entry } of items) {
    const kind = surface.kindLabel.toLowerCase() as FileKind;
    const token = await tokenFor(root, endpoint, kind, entry.id);
    const dir = path.join(dist, entry.id);
    write(`  ${entry.id.padEnd(28)} `);

    if (surface.type === 'files') {
      const staged = path.join(scratch, surface.stage, entry.id);
      await buildItem({ root, surface, id: entry.id, outDir: staged });
      await fs.mkdir(dir, { recursive: true });
      for (const f of await fs.readdir(staged)) {
        if (f.startsWith(`${entry.id}.`)) await fs.cp(path.join(staged, f), path.join(dir, f));
      }
      await fs.rm(path.join(scratch, surface.stage), { recursive: true, force: true });
      await fs.writeFile(path.join(dir, 'index.html'), sheetPage(entry, token));
    } else {
      const itemConfig = surface.itemConfig;
      await buildItem({
        root,
        surface,
        id: entry.id,
        outDir: dir,
        config:
          itemConfig === undefined
            ? undefined
            : { file: itemConfig.file, body: itemConfig.body(token) },
      });
    }

    await push({
      ...opts.base,
      bearer,
      endpoint,
      slug: entry.id,
      kind,
      title: entry.title ?? entry.id,
      subtitle: entry.subtitle ?? entry.description,
      route: surface.itemRoute(entry.id),
      siteDir: dir,
      /* 原始碼跟著走，否則推上去的只有產物，沒有人能在上面繼續工作。 */
      sourceRoot: root,
      sourceDir: path.join(surface.dir, entry.id),
      token,
      dryRun: opts.dryRun,
      cwd: root,
      out: () => {},
    });
    write(`→ ${new URL(endpoint).origin}/${token}\n`);
  }

  await fs.rm(scratch, { recursive: true, force: true });
}

/** 預設的建置器：呼叫框架自己的 CLI。測試會換掉它。 */
export const realBuildItem: BuildItem = async (o) => {
  const { buildItem } = await import('./stage.ts');
  await buildItem(o);
};
