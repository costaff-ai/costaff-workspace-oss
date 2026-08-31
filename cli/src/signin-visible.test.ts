/**
 * 登入的提示一定要看得見。
 *
 * 真實的失敗長這樣：一次推很多份的時候，每一份的推送輸出被靜音（否則四份的進度
 * 互相蓋掉），而裝置授權碼走的是同一個 out —— 於是它安靜地輪詢到過期，畫面停在
 * 第一份的名字上，看起來像當掉。
 *
 * 所以測的是「授權碼有沒有出現在使用者看得到的地方」，以及「四份只登入一次」。
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type BuildItem, pushProject, scanProject } from './project.ts';

let root: string;
let server: { url: string; close: () => Promise<void>; deviceStarts: number };

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'costaff-signin-'));
  server = await fakeReceiver();
});

afterEach(async () => {
  await server.close();
  await fs.rm(root, { recursive: true, force: true });
  delete process.env.COSTAFF_WORKSPACE_TOKEN;
});

/** 只回答裝置流程需要的那幾個端點，其餘一律 404。 */
async function fakeReceiver(): Promise<{
  url: string;
  close: () => Promise<void>;
  deviceStarts: number;
}> {
  const http = await import('node:http');
  const state = { deviceStarts: 0 };
  const srv = http.createServer((req, res) => {
    const url = req.url ?? '';
    const send = (body: unknown): void => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.includes('well-known')) {
      return send({
        protocol: 1,
        name: 'Fake Receiver',
        deviceAuthStart: '/v1/device/start',
        deviceAuthPoll: '/v1/device/poll',
        push: '/v1/push',
        maxBytes: 50 * 1024 * 1024,
      });
    }
    if (url.includes('/device/start')) {
      state.deviceStarts += 1;
      return send({
        verificationUri: 'https://example.test/activate',
        userCode: 'WXYZ-1234',
        deviceCode: 'dev',
        expiresIn: 60,
        interval: 0,
      });
    }
    if (url.includes('/device/poll')) {
      return send({ status: 'ok', token: 'tok-abc', expiresAt: new Date(Date.now() + 864e5).toISOString(), account: 'me@example.test' });
    }
    if (url.includes('/push')) return send({ url: 'https://example.test/x', slug: 'x' });
    res.writeHead(404).end('{}');
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => srv.close(() => r())),
    get deviceStarts() {
      return state.deviceStarts;
    },
  };
}

const stubBuild: BuildItem = async (o) => {
  await fs.mkdir(o.outDir, { recursive: true });
  await fs.writeFile(path.join(o.outDir, 'index.html'), '<!doctype html>');
};

async function writeDoc(id: string): Promise<void> {
  const dir = path.join(root, 'docs', id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.tsx'), `export const meta = { title: '${id}' };\n`);
}

describe('一次推多份時的登入', () => {
  it('把裝置授權碼印出來，而且四份只登入一次', async () => {
    for (const id of ['a', 'b', 'c', 'd']) await writeDoc(id);

    let shown = '';
    await pushProject({
      root,
      endpoint: server.url,
      items: await scanProject(root),
      buildItem: stubBuild,
      out: (line) => {
        shown += line;
      },
    });

    /* 沒有這一行，畫面會停在第一份的名字上，看起來像當掉。 */
    expect(shown).toContain('WXYZ-1234');
    expect(shown).toContain('https://example.test/activate');
    expect(server.deviceStarts).toBe(1);
  });

  /* 乾跑不上傳，所以不該為了憑證去連伺服器。 */
  it('乾跑完全不碰登入', async () => {
    await writeDoc('a');
    await pushProject({
      root,
      endpoint: 'https://unreachable.invalid',
      items: await scanProject(root),
      dryRun: true,
      buildItem: stubBuild,
      out: () => {},
    });
    expect(server.deviceStarts).toBe(0);
  });
});
