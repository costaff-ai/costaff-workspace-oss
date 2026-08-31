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

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
