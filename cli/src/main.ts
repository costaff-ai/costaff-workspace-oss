#!/usr/bin/env node
/**
 * costaff-workspace —— 一個入口，動作放在子指令。
 *
 * 兩個獨立執行檔的時候，每加一個功能就要多開一個 costaff-xxx，而且沒有任何地方
 * 能一次看完全部。子指令讓 --help 就是那份清單 —— 對 Agent 尤其重要，它不會去猜
 * 還有哪些兄弟指令存在。
 */

import { runPull } from './cli-pull.ts';
import { runTheme } from './cli-theme.ts';
import { runWhoami } from './cli-whoami.ts';
import { runPush } from './cli.ts';
import { DEFAULT_ENDPOINT } from './defaults.ts';
import { fail, setJson } from './report.ts';

const USAGE = `costaff-workspace — publish to and pull back from CoStaff Workspace

  costaff-workspace <command> [options]

  push            push this folder up (run it with nothing else)
  pull <token>    fetch a published file's source back out
  theme           push, list, pull and remove the themes/ folder
  whoami          what this machine is signed in as
  login           sign this machine in
  logout          forget this machine's sign-in

  costaff-workspace <command> --help   for that command's options
  --json                               one line of JSON instead of prose

Endpoint defaults to ${DEFAULT_ENDPOINT}; --endpoint or
COSTAFF_WORKSPACE_ENDPOINT points at a receiver you run yourself.
`;

async function main(): Promise<void> {
  /*
   * 在分派之前就摘掉。每個子指令的解析器都把「--flag 後面接非 -- 的字」讀成一組
   * 值，留著它 `--json push` 會被當成 --json=push；而且錯誤處理器也要先知道該用
   * 哪一種格式，那比任何子指令都早。
   */
  const argv = process.argv.slice(2).filter((a) => a !== '--json');
  setJson(argv.length !== process.argv.length - 2);
  const [command, ...rest] = argv;

  switch (command) {
    case 'push':
      return runPush(rest);
    case 'pull':
      return runPull(rest);
    case 'theme':
    case 'themes':
      return runTheme(rest);
    case 'whoami':
      return runWhoami(rest);
    /* login 和 logout 走的是 push 那條路：它們本來就是同一組憑證。 */
    case 'login':
      return runPush([...rest, '--login']);
    case 'logout':
      return runPush([...rest, '--logout']);
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      process.stdout.write(USAGE);
      return;
    default:
      process.stderr.write(`error: unknown command '${command}'\n\n${USAGE}`);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
