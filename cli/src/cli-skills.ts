/**
 * 把 skill 裝進使用者的專案。
 *
 * skill 隨套件一起發，所以裝了 CLI 就有了 —— 但 agent 讀的是專案裡的
 * `.claude/skills/`，不是 node_modules。這個指令做的就是那一段複製，並且說得出
 * 哪幾份變了。
 *
 * 覆蓋而不是合併：這些檔案是這個套件的產物，不是使用者的稿子。想改的人應該改自己
 * 的那一份、換個名字，而不是編輯一個下次升級就會被蓋掉的檔案。
 */

import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { done, line } from './report.ts';

const USAGE = `costaff-workspace skills — install the agent skill into this project

  costaff-workspace skills [--dry-run] [--json]

Writes into .claude/skills/ and .agents/skills/, overwriting what is there.
`;

/* 兩個都寫：Claude Code 讀前者，其他工具讀後者，而同一份東西不該要人選邊。 */
const TARGETS = ['.claude/skills', '.agents/skills'];

export type SkillChange = { name: string; status: 'added' | 'updated' | 'unchanged' };

/**
 * 套件裡 skills/ 的位置。
 *
 * 從這個模組往上找，而不是從 cwd —— 執行時 cwd 是使用者的專案。編譯後這個檔案在
 * `dist/`，所以答案是它的上一層。
 */
export function builtinSkillsDir(from = fileURLToPath(import.meta.url)): string {
  return path.resolve(path.dirname(from), '..', 'skills');
}

async function tree(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const walk = async (at: string): Promise<void> => {
    for (const entry of await fs.readdir(at, { withFileTypes: true })) {
      const abs = path.join(at, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else out.set(path.relative(dir, abs), await fs.readFile(abs, 'utf8'));
    }
  };
  await walk(dir);
  return out;
}

async function same(src: string, dst: string): Promise<boolean> {
  if (!existsSync(dst)) return false;
  const [a, b] = await Promise.all([tree(src), tree(dst)]);
  if (a.size !== b.size) return false;
  for (const [file, text] of a) if (b.get(file) !== text) return false;
  return true;
}

export async function skillChanges(builtin: string, cwd: string): Promise<SkillChange[]> {
  if (!existsSync(builtin)) return [];
  const names = (await fs.readdir(builtin, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const changes: SkillChange[] = [];
  for (const name of names) {
    /* 以第一個目標判斷。兩個目標寫的是同一份，分開比對只會report出兩次同一件事。 */
    const dst = path.join(cwd, TARGETS[0] ?? '', name);
    const status = !existsSync(dst)
      ? 'added'
      : (await same(path.join(builtin, name), dst))
        ? 'unchanged'
        : 'updated';
    changes.push({ name, status });
  }
  return changes;
}

export async function installSkills(
  builtin: string,
  cwd: string,
  dryRun: boolean,
): Promise<SkillChange[]> {
  const changes = await skillChanges(builtin, cwd);
  if (dryRun) return changes;
  for (const { name, status } of changes) {
    if (status === 'unchanged') continue;
    for (const target of TARGETS) {
      const dst = path.join(cwd, target, name);
      await fs.rm(dst, { recursive: true, force: true });
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.cp(path.join(builtin, name), dst, { recursive: true });
    }
  }
  return changes;
}

export async function runSkills(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  const dryRun = argv.includes('--dry-run');
  const builtin = builtinSkillsDir();
  const cwd = process.cwd();
  const changes = await installSkills(builtin, cwd, dryRun);

  if (changes.length === 0) {
    line('no skills in this package\n');
  } else {
    for (const { name, status } of changes) {
      line(`  ${name.padEnd(20)} ${dryRun && status !== 'unchanged' ? `would be ${status}` : status}\n`);
    }
    if (!dryRun) line(`\nwritten to ${TARGETS.join(' and ')}\n`);
  }
  done({ command: 'skills', dryRun, targets: TARGETS, skills: changes });
}
