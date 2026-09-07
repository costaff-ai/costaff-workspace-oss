/**
 * 給 agent 讀的那條輸出。
 *
 * 這些指令本來只印給人看的文字，所以要拿回網址就得對著文案下正規式 —— 那份文案
 * 改一個字就會壞，而改的人不會知道自己弄壞了誰。這裡釘住的是那份合約：欄位在、
 * 格式是一行 JSON、而且人看的散文不會混進同一條 stdout。
 *
 * 最要緊的是最後一條。未登入時的裝置碼是印給人看的，`--json` 會把它吞掉，然後
 * 程序就停在輪詢上直到過期 —— 一個看起來像當掉、其實只是沒人按核准的東西。
 */

import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { whoami } from './cli-whoami.ts';
import { done, fail, line, setJson } from './report.ts';

const capture = (fn: () => void): { out: string; err: string } => {
  const out: string[] = [];
  const err: string[] = [];
  const so = process.stdout.write.bind(process.stdout);
  const se = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((s: string) => {
    out.push(s);
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((s: string) => {
    err.push(s);
    return true;
  }) as typeof process.stderr.write;
  try {
    fn();
  } finally {
    process.stdout.write = so;
    process.stderr.write = se;
  }
  return { out: out.join(''), err: err.join('') };
};

describe('--json', () => {
  it('prints one line of JSON and nothing else', () => {
    setJson(true);
    const { out } = capture(() => {
      line('a human sentence\n');
      done({ command: 'push', items: [{ slug: 'q3', url: 'https://x/t' }] });
    });
    setJson(false);

    expect(out).not.toContain('human sentence');
    expect(out.trimEnd().split('\n')).toHaveLength(1);
    expect(JSON.parse(out)).toEqual({
      ok: true,
      command: 'push',
      items: [{ slug: 'q3', url: 'https://x/t' }],
    });
  });

  /* 兩種格式都要解析的話，agent 得先猜自己拿到的是哪一種。 */
  it('reports failure in the same shape', () => {
    setJson(true);
    const { out, err } = capture(() => fail('no such token'));
    setJson(false);
    expect(err).toBe('');
    expect(JSON.parse(out)).toEqual({ ok: false, error: 'no such token' });
  });

  it('leaves prose alone when it is off', () => {
    const { out } = capture(() => {
      line('pushed\n');
      done({ command: 'push' });
    });
    expect(out).toBe('pushed\n');
  });
});

describe('whoami', () => {
  const END = 'https://example.test';
  /* 不存在的檔案，所以答案來自這個測試而不是這台機器。 */
  const NONE = path.join(os.tmpdir(), 'costaff-whoami-absent.json');

  it('names where the credential came from', async () => {
    expect(await whoami(END, 'tok', {}, NONE)).toMatchObject({ signedIn: true, source: 'flag' });
    expect(await whoami(END, undefined, { COSTAFF_WORKSPACE_TOKEN: 'tok' }, NONE)).toMatchObject({
      signedIn: true,
      source: 'env',
    });
  });

  /*
   * 沒登入要說得出口。一個 skill 在這裡的動作是「停下來請人跑一次 login」，而它
   * 沒有別的便宜方法問得出這件事 —— 以前只能推推看。
   */
  it('says so when there is nothing to sign in with', async () => {
    const who = await whoami(END, undefined, {}, NONE);
    expect(who.signedIn).toBe(false);
    expect(who.source).toBe('none');
    expect(who.account).toBeNull();
  });
});
