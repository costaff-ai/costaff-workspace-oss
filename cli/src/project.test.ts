/**
 * 專案模式：一個資料夾裡有幾份文件，就推幾份。
 *
 * 這裡守的是那條會安靜壞掉的性質 —— 每一份文件必須建進自己的目錄。共用一個
 * bundle 的話，分享其中一份就等於把其餘的 chunk 一起給出去，而且從外面完全看不
 * 出來。所以測的是「buildItem 被叫了幾次、輸出目錄各是什麼」，不是「有沒有跑完」。
 *
 * 建置器是換掉的：真的去跑四次 vite 建置的測試，慢到沒有人會跑它。
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type BuildItem, pushProject, scanProject } from './project.ts';

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'costaff-project-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function writeDoc(id: string, title: string): Promise<void> {
  const dir = path.join(root, 'docs', id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.tsx'), `export const meta = { title: '${title}' };\n`);
}

describe('scanProject', () => {
  it('找出 docs/ 底下的每一份文件，連同它自己寫的標題', async () => {
    await writeDoc('getting-started', '開始使用');
    await writeDoc('nye-2027', '跨年會議');

    const items = await scanProject(root);
    expect(items.map((i) => i.entry.id)).toEqual(['getting-started', 'nye-2027']);
    expect(items.map((i) => i.entry.title)).toEqual(['開始使用', '跨年會議']);
    expect(items.every((i) => i.surface.dir === 'docs')).toBe(true);
  });

  /* 沒有 docs/ 的資料夾是單一 bundle 的專案，不該被當成多文件專案。 */
  it('不是多文件專案就回空陣列', async () => {
    await fs.mkdir(path.join(root, 'dist'), { recursive: true });
    expect(await scanProject(root)).toEqual([]);
  });

  /* 沒有 index.* 的子目錄不是一份文件 —— 例如放圖的資料夾。 */
  it('略過沒有進入點的子目錄', async () => {
    await writeDoc('real-doc', '真的');
    await fs.mkdir(path.join(root, 'docs', 'images'), { recursive: true });
    await fs.writeFile(path.join(root, 'docs', 'images', 'a.png'), 'x');

    const items = await scanProject(root);
    expect(items.map((i) => i.entry.id)).toEqual(['real-doc']);
  });
});

describe('pushProject', () => {
  /*
   * 這是整組測試的重點：兩份文件必須建進兩個不同的目錄。有人把它「最佳化」成
   * 一次建置的時候，壞掉的是分享隔離，而不是任何看得見的東西。
   */
  it('每一份文件建進自己的目錄', async () => {
    await writeDoc('alpha', 'Alpha');
    await writeDoc('beta', 'Beta');

    const built: { id: string; outDir: string }[] = [];
    const buildItem: BuildItem = async (o) => {
      built.push({ id: o.id, outDir: o.outDir });
      await fs.mkdir(o.outDir, { recursive: true });
      await fs.writeFile(path.join(o.outDir, 'index.html'), '<!doctype html>');
    };

    await pushProject({
      root,
      endpoint: 'https://example.test',
      items: await scanProject(root),
      dryRun: true,
      buildItem,
      out: () => {},
    });

    expect(built.map((b) => b.id)).toEqual(['alpha', 'beta']);
    expect(built[0]?.outDir).toBe(path.join(root, 'dist', 'alpha'));
    expect(built[1]?.outDir).toBe(path.join(root, 'dist', 'beta'));
    expect(new Set(built.map((b) => b.outDir)).size).toBe(2);
  });

  /*
   * token 在建置之前就要決定，而且要烘進那一份的設定裡：bundle 的資產路徑照著它
   * 產生，晚一步決定就是決定錯。所以檢查傳給建置器的設定內容，而不只是有沒有傳。
   */
  it('把每一份自己的 token 烘進建置設定', async () => {
    await writeDoc('alpha', 'Alpha');
    await writeDoc('beta', 'Beta');

    const bodies: string[] = [];
    const buildItem: BuildItem = async (o) => {
      if (o.config !== undefined) bodies.push(o.config.body);
      await fs.mkdir(o.outDir, { recursive: true });
      await fs.writeFile(path.join(o.outDir, 'index.html'), '<!doctype html>');
    };

    await pushProject({
      root,
      endpoint: 'https://example.test',
      items: await scanProject(root),
      dryRun: true,
      buildItem,
      out: () => {},
    });

    expect(bodies).toHaveLength(2);
    const tokens = bodies.map((b) => /base: '\/([a-z0-9]+)\//.exec(b)?.[1]);
    expect(tokens.every((t) => t !== undefined)).toBe(true);
    /* 兩份文件不能共用一個位址。 */
    expect(new Set(tokens).size).toBe(2);
  });

  /* 暫存目錄是自己的，跑完不該留在人家的專案裡。 */
  it('收拾掉 .build', async () => {
    await writeDoc('alpha', 'Alpha');
    const buildItem: BuildItem = async (o) => {
      await fs.mkdir(o.outDir, { recursive: true });
      await fs.writeFile(path.join(o.outDir, 'index.html'), '<!doctype html>');
    };
    await pushProject({
      root,
      endpoint: 'https://example.test',
      items: await scanProject(root),
      dryRun: true,
      buildItem,
      out: () => {},
    });
    await expect(fs.stat(path.join(root, '.build'))).rejects.toThrow();
  });
});
