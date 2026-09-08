/**
 * 猜測的規則。
 *
 * 這裡每一條錯掉的後果都一樣：東西被推到錯的地方，而且推的人不知道為什麼。
 * 所以重點放在「猜不出來的時候會不會硬湊」——回 null 讓人自己給，永遠比推上一份
 * 叫「-」的檔案好。
 */

import { describe, expect, it } from 'vitest';
import { rootAbsoluteRefs } from './integration.ts';
import { kindFromManifest, slugFromDir, titleFromManifest } from './defaults.ts';

describe('slugFromDir', () => {
  it('用資料夾的名字', () => {
    expect(slugFromDir('/a/b/my-doc')).toBe('my-doc');
    expect(slugFromDir('/a/b/report2026')).toBe('report2026');
  });

  it('正規化成伺服器認得的形狀', () => {
    expect(slugFromDir('/a/b/My Doc')).toBe('my-doc');
    expect(slugFromDir('/a/b/Q3_Numbers')).toBe('q3-numbers');
    expect(slugFromDir('/a/b/.hidden')).toBe('hidden');
    expect(slugFromDir('/a/b/--weird--')).toBe('weird');
  });

  /*
   * 中文資料夾名會被清成空字串。這時候要說不知道，而不是推上一份沒有名字的檔案。
   */
  it('湊不出東西的時候回 null，不硬湊', () => {
    expect(slugFromDir('/a/b/簡報')).toBeNull();
    expect(slugFromDir('/a/b/---')).toBeNull();
  });

  /* 開頭必須是英數，而且不能超過 63 個字。 */
  it('守住伺服器的長度與開頭規則', () => {
    const long = slugFromDir(`/a/${'x'.repeat(200)}`);
    expect(long).not.toBeNull();
    expect(long?.length).toBe(63);
    expect(slugFromDir('/a/b/9lives')).toBe('9lives');
  });
});

describe('kindFromManifest', () => {
  const withDeps = (deps: Record<string, string>) => ({ dependencies: deps });

  it('從相依套件認出三種框架', () => {
    expect(kindFromManifest(withDeps({ '@open-document/core': '^1' }))).toBe('document');
    expect(kindFromManifest(withDeps({ '@open-slide/core': '^1' }))).toBe('deck');
    expect(kindFromManifest(withDeps({ '@open-sheet/core': '^1' }))).toBe('workbook');
  });

  it('devDependencies 也算 —— 框架常常裝在那裡', () => {
    expect(kindFromManifest({ devDependencies: { '@open-slide/cli': '^1' } })).toBe('deck');
  });

  /* 認不出來就說認不出來，由呼叫端決定要不要退回 document。 */
  it('認不出來回 null', () => {
    expect(kindFromManifest(withDeps({ react: '^19' }))).toBeNull();
    expect(kindFromManifest(null)).toBeNull();
    expect(kindFromManifest({})).toBeNull();
  });

  /* 前綴要整個對上，免得 open-slide-something-else 被誤認。 */
  it('不把名字裡剛好含有前綴的套件算進去', () => {
    expect(kindFromManifest(withDeps({ 'my-@open-slide/core': '^1' }))).toBeNull();
  });
});

describe('titleFromManifest', () => {
  it('用 description，那是作者寫給人看的一句話', () => {
    expect(titleFromManifest({ description: '第三季數字' }, 'q3')).toBe('第三季數字');
  });

  it('沒有 description 就退回 slug', () => {
    expect(titleFromManifest({ description: '   ' }, 'q3')).toBe('q3');
    expect(titleFromManifest({}, 'q3')).toBe('q3');
    expect(titleFromManifest(null, 'q3')).toBe('q3');
  });
});

/**
 * 建置出來的位址有沒有帶著 token。
 *
 * 回報進來的症狀是「頁面打得開、外框也在，只有內容一片黑」—— 因為 Vite 的 `base`
 * 預設是 `/`，而每份檔案是掛在 `/<token>/` 底下的。那些資產請求敲的是網站根目錄，
 * 那裡沒有那個檔案，而 404 的 JS 不會說話。
 *
 * 專案推送撞不到：它的建置設定是 CLI 自己寫的。撞到的是手動推一份自己建好的站台
 * 的人，也就是最沒有線索可循的那個人。
 */
describe('assets that point at the site root', () => {
  const P = '/tok123/';

  it('are caught, because they would all 404', () => {
    const html = '<script src="/assets/index-abc.js"></script><link href="/assets/x.css">';
    expect(rootAbsoluteRefs(html, P)).toEqual(['/assets/index-abc.js', '/assets/x.css']);
  });

  it('are fine once the base is the token', () => {
    expect(rootAbsoluteRefs('<script src="/tok123/assets/index-abc.js"></script>', P)).toEqual([]);
  });

  it('are fine when relative, which survives any prefix', () => {
    expect(rootAbsoluteRefs('<script src="./assets/index-abc.js"></script>', P)).toEqual([]);
  });

  /* 這兩種不是本地路徑，套前綴上去反而會把它們弄壞。 */
  it('leave absolute and protocol-relative urls alone', () => {
    const html = '<link href="https://cdn.example.com/x.css"><script src="//cdn.example.com/y.js">';
    expect(rootAbsoluteRefs(html, P)).toEqual([]);
  });
});
