/**
 * 猜得出來的東西就不要叫人打。
 *
 * 一行 `costaff-workspace push` 應該就能把當前資料夾推上去。每一個猜測都必須是可以被旗標
 * 蓋掉的，而且猜錯的時候要說出它猜了什麼 —— 一個安靜猜錯的預設值，比要求人打
 * 完整指令更糟。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileKind } from './protocol.ts';

/** 正式站。--endpoint 和 COSTAFF_WORKSPACE_ENDPOINT 蓋得掉，開發時指向本機用。 */
export const DEFAULT_ENDPOINT = 'https://workspace.costaffs.app';

/** 伺服器認的 slug：小寫英數與連字號，開頭必須是英數，最長 63。 */
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * 資料夾名字就是這份檔案的身分。
 *
 * 正規化到伺服器認得的形狀，正規化不出東西就回 null 而不是硬湊一個 —— 中文
 * 資料夾名會被清成空字串，這時候該讓人自己給 --slug，而不是推上一份叫「-」的檔案。
 */
export function slugFromDir(dir: string): string | null {
  const slug = path
    .basename(path.resolve(dir))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
  return SLUG.test(slug) ? slug : null;
}

type Manifest = { name?: unknown; description?: unknown } & Record<string, unknown>;

/** 讀 package.json，沒有或壞掉都當作沒有 —— 這只是猜測的材料，不是必要條件。 */
export async function readManifest(root: string): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(path.join(root, 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Manifest) : null;
  } catch {
    return null;
  }
}

/*
 * 三個框架各自的套件前綴。相依套件是專案自己寫下的事實，比副檔名或資料夾名可靠。
 */
const BY_PREFIX: [string, FileKind][] = [
  ['@open-document/', 'document'],
  ['@open-slide/', 'deck'],
  ['@open-sheet/', 'workbook'],
];

/** 從相依套件認出這是哪一種檔案；認不出來回 null，由呼叫端決定要不要退回預設。 */
export function kindFromManifest(manifest: Manifest | null): FileKind | null {
  if (manifest === null) return null;
  const names = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = manifest[field];
    if (typeof deps === 'object' && deps !== null) {
      for (const name of Object.keys(deps)) names.add(name);
    }
  }
  for (const [prefix, kind] of BY_PREFIX) {
    for (const name of names) if (name.startsWith(prefix)) return kind;
  }
  return null;
}

/**
 * 顯示名稱。package.json 的 description 是作者寫給人看的一句話，比 slug 好；
 * 沒有就退回 slug，而不是退回套件名 —— 套件名通常和 slug 一樣，多一層沒有意義。
 */
export function titleFromManifest(manifest: Manifest | null, slug: string): string {
  const description = manifest?.description;
  if (typeof description === 'string' && description.trim() !== '') return description.trim();
  return slug;
}
