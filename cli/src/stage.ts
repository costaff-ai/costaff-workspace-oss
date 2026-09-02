import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Surface } from './integration.ts';

/**
 * Builds one item into a bundle of its own.
 *
 * Per-item isolation cannot be enforced inside a shared bundle: every document
 * in a `docs/` build shares the same asset directory, so anyone holding a link
 * to one can fetch the chunks of the others. The only way a share can actually
 * withhold the rest of a workspace is for the rest of the workspace not to be
 * in the bundle — hence one staged project, and one build, per item.
 *
 * The cost is real: N builds instead of one, and assets repeated across them.
 */
export async function buildItem({
  root,
  surface,
  id,
  outDir,
  config,
}: {
  root: string;
  surface: Surface;
  id: string;
  outDir: string;
  config?: { file: string; body: string };
}): Promise<void> {
  const stage = path.join(root, '.build', 'stage', id);
  await fs.rm(stage, { recursive: true, force: true });
  await fs.mkdir(path.join(stage, surface.dir), { recursive: true });

  await fs.cp(path.join(root, surface.dir, id), path.join(stage, surface.dir, id), {
    recursive: true,
  });

  // Shared inputs a single item may still reference.
  for (const shared of ['themes', 'assets']) {
    const from = path.join(root, shared);
    if (await exists(from)) await fs.cp(from, path.join(stage, shared), { recursive: true });
  }

  // The staged project resolves the same packages as the workspace, so a build
  // here is the same build the workspace would have produced.
  await fs.symlink(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
  await fs.writeFile(
    path.join(stage, 'package.json'),
    `${JSON.stringify({ name: `stage-${id}`, private: true, type: 'module' }, null, 2)}\n`,
  );
  if (config !== undefined) {
    await fs.writeFile(path.join(stage, config.file), config.body);
  }

  execFileSync('npx', [surface.cli, ...surface.buildArgs(path.resolve(outDir))], {
    cwd: stage,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await fs.rm(stage, { recursive: true, force: true });
}

/**
 * 把一份主題的示範建成 bundle。
 *
 * 示範檔是 `themes/<id>.demo.tsx`，不是一個項目資料夾，所以不能直接餵給 buildItem
 * —— 它被搬到 `<surface.dir>/<id>/index.tsx`，成為一個只有一份東西的專案。
 *
 * 示範檔沒有 `meta`（框架的畫廊不需要），但建置需要一個標題，所以補一個。附加在
 * 檔案尾端而不是插在前面：前面是 import，中間插東西會改到行號，出錯時對不上。
 */
export async function buildThemeDemo({
  root,
  surface,
  id,
  title,
  outDir,
  config,
}: {
  root: string;
  surface: Surface;
  id: string;
  title: string;
  outDir: string;
  config: { file: string; body: string };
}): Promise<void> {
  const stage = path.join(root, '.build', 'stage', `theme-${id}`);
  await fs.rm(stage, { recursive: true, force: true });
  const item = path.join(stage, surface.dir, id);
  await fs.mkdir(item, { recursive: true });

  const source = await fs.readFile(path.join(root, 'themes', `${id}.demo.tsx`), 'utf8');
  const meta = /export\s+const\s+meta\b/.test(source)
    ? ''
    : `\nexport const meta = ${JSON.stringify({ title })};\n`;
  await fs.writeFile(path.join(item, 'index.tsx'), source + meta);

  /* 示範會參照主題自己的資產，themes/ 也要跟著進來。 */
  for (const shared of ['themes', 'assets']) {
    const from = path.join(root, shared);
    if (await exists(from)) await fs.cp(from, path.join(stage, shared), { recursive: true });
  }

  await fs.symlink(path.join(root, 'node_modules'), path.join(stage, 'node_modules'), 'dir');
  await fs.writeFile(
    path.join(stage, 'package.json'),
    `${JSON.stringify({ name: `stage-theme-${id}`, private: true, type: 'module' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(stage, config.file), config.body);

  execFileSync('npx', [surface.cli, ...surface.buildArgs(path.resolve(outDir))], {
    cwd: stage,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await fs.rm(stage, { recursive: true, force: true });
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
