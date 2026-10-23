/**
 * 隨套件一起發的 skill。
 *
 * 兩件會安靜壞掉的事。一是路徑：skills/ 的位置是從編譯後的 `dist/` 往上推的，
 * 推錯了在原始碼上跑仍然對，直到有人從 npm 裝了才發現指令找不到東西。二是
 * `files`：漏掉 skills/ 的話套件裡根本沒有那個資料夾，而本機測試永遠看不到。
 */

import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { builtinSkillsDir, installSkills, skillChanges } from './cli-skills.ts';
import { compareVersions, skillNotice, skillStatus, skillVersionOf } from './skill-version.ts';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(PKG, 'skills');
const SPEC = path.join(SKILLS, 'costaff-workspace', 'SKILL.md');
const VERSION = (JSON.parse(readFileSync(path.join(PKG, 'package.json'), 'utf8')) as { version: string }).version;

let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'costaff-skills-'));
});

afterEach(async () => {
  await fs.rm(cwd, { recursive: true, force: true });
});

describe('the shipped skill', () => {
  it('is found from where the compiled entry sits, not from the cwd', () => {
    expect(builtinSkillsDir(path.join(PKG, 'dist', 'cli-skills.js'))).toBe(SKILLS);
  });

  it('travels with the package', async () => {
    const pkg = JSON.parse(await fs.readFile(path.join(PKG, 'package.json'), 'utf8')) as {
      files: string[];
    };
    expect(pkg.files).toContain('skills');
  });

  /* 沒有 frontmatter 的 SKILL.md 不會被載入 —— 而它會安靜地不載入。 */
  it('declares a name and a description an agent can match on', async () => {
    const text = await fs.readFile(SPEC, 'utf8');
    expect(text.startsWith('---\n')).toBe(true);
    expect(text).toMatch(/\nname: costaff-workspace\n/);
    expect(text).toMatch(/\ndescription: \S/);
  });

  /*
   * skill 存在的理由。agent 按不了瀏覽器裡的核准，所以它必須先問、再停下來找人
   * —— 這條規則不在文件裡，這份 skill 就沒有用。
   */
  it('tells the agent to stop rather than attempt an interactive sign-in', async () => {
    const text = await fs.readFile(SPEC, 'utf8');
    expect(text).toContain('whoami --json');
    expect(text).toMatch(/stop and ask the user to run `costaff-workspace login`/);
    expect(text).toMatch(/Do not open a browser/);
  });
});

describe('installing it', () => {
  const skill = (dir: string): string => path.join(cwd, dir, 'costaff-workspace', 'SKILL.md');

  it('writes both target folders', async () => {
    await installSkills(SKILLS, cwd, false);
    expect(existsSync(skill('.claude/skills'))).toBe(true);
    expect(existsSync(skill('.agents/skills'))).toBe(true);
  });

  it('reports without writing on a dry run', async () => {
    expect(await installSkills(SKILLS, cwd, true)).toEqual([
      { name: 'costaff-workspace', status: 'added', from: null, to: VERSION },
    ]);
    expect(existsSync(skill('.claude/skills'))).toBe(false);
  });

  it('is unchanged the second time', async () => {
    await installSkills(SKILLS, cwd, false);
    expect(await skillChanges(SKILLS, cwd)).toEqual([
      { name: 'costaff-workspace', status: 'unchanged', from: VERSION, to: VERSION },
    ]);
  });

  /* 這些檔案是套件的產物。編輯它們的人下次升級會被蓋掉，所以升級要真的蓋掉。 */
  it('replaces a copy that drifted', async () => {
    await installSkills(SKILLS, cwd, false);
    await fs.appendFile(skill('.claude/skills'), '\nedited by hand\n');
    expect(await skillChanges(SKILLS, cwd)).toEqual([
      { name: 'costaff-workspace', status: 'updated', from: VERSION, to: VERSION },
    ]);
    await installSkills(SKILLS, cwd, false);
    expect(await fs.readFile(skill('.claude/skills'), 'utf8')).not.toContain('edited by hand');
  });
});

/*
 * 版本寫在 skill 自己身上，跟套件同號：發一版 CLI 就是發一版 skill，兩個號碼
 * 分開管只會有一天對不上。
 */
describe('the skill version', () => {
  it('is the package version', async () => {
    expect(skillVersionOf(await fs.readFile(SPEC, 'utf8'))).toBe(VERSION);
  });

  it('is read from metadata or the top level, and is null when absent', () => {
    expect(skillVersionOf('---\nname: x\nmetadata:\n  version: "1.2.3"\n---\nbody')).toBe('1.2.3');
    expect(skillVersionOf('---\nname: x\nversion: 0.9.0\n---\n')).toBe('0.9.0');
    expect(skillVersionOf('---\nname: x\n---\n')).toBeNull();
    expect(skillVersionOf('no frontmatter')).toBeNull();
  });

  it('compares x.y.z numerically', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.9', '0.2.0')).toBeLessThan(0);
  });
});

describe('a project behind or ahead', () => {
  const skill = (dir: string): string => path.join(cwd, dir, 'costaff-workspace', 'SKILL.md');
  const setInstalled = async (version: string | null) => {
    await installSkills(SKILLS, cwd, false);
    const text = await fs.readFile(skill('.claude/skills'), 'utf8');
    const next = version === null
      ? text.replace(/\nmetadata:\n  version: "[^"]*"/, '')
      : text.replace(/version: "[^"]*"/, `version: "${version}"`);
    await fs.writeFile(skill('.claude/skills'), next);
  };

  it('updates an older copy and says from what', async () => {
    await setInstalled('0.1.0');
    expect(await skillChanges(SKILLS, cwd)).toEqual([
      { name: 'costaff-workspace', status: 'updated', from: '0.1.0', to: VERSION },
    ]);
  });

  it('treats a copy with no version as behind', async () => {
    await setInstalled(null);
    expect((await skillChanges(SKILLS, cwd))[0]).toMatchObject({ status: 'updated', from: 'unversioned' });
    expect((await skillStatus(cwd, SKILLS)).behind).toBe(true);
  });

  /* 裝過更新的 CLI 的專案，被舊的 CLI 跑一次 skills 不該降版。 */
  it('leaves a newer copy alone', async () => {
    await setInstalled('99.0.0');
    expect((await skillChanges(SKILLS, cwd))[0]).toMatchObject({ status: 'newer', from: '99.0.0' });
    await installSkills(SKILLS, cwd, false);
    expect(await fs.readFile(skill('.claude/skills'), 'utf8')).toContain('version: "99.0.0"');
  });

  it('is not behind before it is installed, and says nothing', async () => {
    const s = await skillStatus(cwd, SKILLS);
    expect(s).toMatchObject({ installed: null, behind: false, cliBehind: false });
    expect(skillNotice(s)).toBeNull();
  });

  it('says to run skills when the project is behind', async () => {
    await setInstalled('0.1.0');
    expect(skillNotice(await skillStatus(cwd, SKILLS))).toContain('costaff-workspace skills');
  });

  it('says to update the CLI when the workspace expects a newer skill than it carries', async () => {
    await installSkills(SKILLS, cwd, false);
    const s = await skillStatus(cwd, SKILLS, '99.0.0');
    expect(s).toMatchObject({ behind: true, cliBehind: true });
    expect(skillNotice(s)).toContain('npx costaff-workspace@latest skills');
  });
});
