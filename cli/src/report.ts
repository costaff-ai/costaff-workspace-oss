/**
 * 一次輸出，兩種讀者。
 *
 * 人要看的是「推到哪、網址是什麼」；agent 要的是能直接讀的欄位。原本只有前者，
 * 所以要拿回網址就得對著人類文案下正規式 —— 而那份文案改一個字就會壞，改的人
 * 也不會知道自己弄壞了誰。
 *
 * `--json` 開啟之後，人看的那些行完全不印：混在同一條 stdout 裡的 JSON 不是
 * JSON。錯誤也跟著換成 JSON，否則 agent 得同時解析兩種格式才知道發生什麼事。
 */

let json = false;

export function setJson(on: boolean): void {
  json = on;
}

export function jsonMode(): boolean {
  return json;
}

/** 給人看的一行。`--json` 之下靜音。 */
export function line(text: string): void {
  if (!json) process.stdout.write(text);
}

/** 指令的結果。`--json` 之下才印，而且是這條 stdout 上唯一的東西。 */
export function done(body: Record<string, unknown>): void {
  if (json) process.stdout.write(`${JSON.stringify({ ok: true, ...body })}\n`);
}

/** 失敗。兩種模式都以 1 結束，差別只在讀的人是誰。 */
export function fail(message: string): void {
  if (json) process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  else process.stderr.write(`error: ${message}\n`);
}
