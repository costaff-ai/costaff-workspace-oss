/**
 * 專案裡那份 skill 跟得上嗎。
 *
 * skill 是 agent 對這個服務的全部認識。專案裡的副本一旦落後，agent 就照著舊的
 * 說明操作 —— 不會出錯訊息，只會做錯事。所以版本寫在 skill 自己身上
 * （frontmatter 的 `metadata.version`，跟套件同一個號碼），而會碰到它的指令順手
 * 比一下：專案裡的、這個 CLI 帶的、伺服器說它需要的。
 */

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const SKILL_NAME = 'costaff-workspace';

/** `metadata:` 底下的 `version:`，或頂層的 `version:`。沒有 frontmatter、沒寫版本都是 null。 */
export function skillVersionOf(text: string): string | null {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  const head = end === -1 ? '' : text.slice(4, end);
  const m = /^(?:metadata:\n(?:[ \t]+.*\n)*?)?[ \t]*version:[ \t]*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?[ \t]*$/m.exec(`${head}\n`);
  return m === null ? null : m[1];
}

export async function readSkillVersion(dir: string): Promise<string | null> {
  const file = path.join(dir, 'SKILL.md');
  if (!existsSync(file)) return null;
  return skillVersionOf(await fs.readFile(file, 'utf8'));
}

/** 只比 x.y.z。比不出來（有一邊不是版本號）的當作一樣，不擋人。 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  if (pa.length !== 3 || pb.length !== 3 || [...pa, ...pb].some(Number.isNaN)) return 0;
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

export type SkillStatus = {
  name: string;
  /** 專案裡那一份的版本；沒裝是 null，裝了但沒寫版本是 'unversioned'。 */
  installed: string | null;
  bundled: string | null;
  /** 伺服器說它是照哪一版寫的；沒問伺服器是 undefined。 */
  server?: string | null;
  /** 專案裡的落後於這個 CLI 帶的或伺服器要的。沒裝不算 —— 那是另一件事。 */
  behind: boolean;
  /** 伺服器要的比這個 CLI 帶的還新：要換的是 CLI 本身。 */
  cliBehind: boolean;
};

export async function skillStatus(cwd: string, bundledDir: string, server?: string | null): Promise<SkillStatus> {
  const dst = path.join(cwd, '.claude', 'skills', SKILL_NAME);
  const installed = existsSync(dst) ? ((await readSkillVersion(dst)) ?? 'unversioned') : null;
  const bundled = await readSkillVersion(path.join(bundledDir, SKILL_NAME));
  const wanted = [bundled, server ?? null].filter((v): v is string => v !== null).sort(compareVersions).at(-1) ?? null;
  return {
    name: SKILL_NAME,
    installed,
    bundled,
    ...(server === undefined ? {} : { server }),
    behind: installed !== null && wanted !== null && (installed === 'unversioned' || compareVersions(installed, wanted) < 0),
    cliBehind: bundled !== null && server !== undefined && server !== null && compareVersions(bundled, server) < 0,
  };
}

/** 給人看的提醒，一句話加一行指令；沒有要提醒的是 null。 */
export function skillNotice(s: SkillStatus): string | null {
  if (s.cliBehind) {
    return `the workspace expects the ${s.name} skill ${s.server}; this CLI carries ${s.bundled}\n  run  npx costaff-workspace@latest skills\n`;
  }
  if (s.behind) {
    const have = s.installed === 'unversioned' ? 'an unversioned copy' : s.installed;
    return `this project's ${s.name} skill is ${have}; ${s.bundled} is current\n  run  costaff-workspace skills\n`;
  }
  return null;
}
