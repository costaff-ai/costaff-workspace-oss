#!/usr/bin/env node
/**
 * costaff-workspace —— 一個入口，動作放在子指令。
 *
 * 兩個獨立執行檔的時候，每加一個功能就要多開一個 costaff-xxx，而且沒有任何地方
 * 能一次看完全部。子指令讓 --help 就是那份清單 —— 對 Agent 尤其重要，它不會去猜
 * 還有哪些兄弟指令存在。
 */

import { runPull } from './cli-pull.ts';
import { runPush } from './cli.ts';
import { DEFAULT_ENDPOINT } from './defaults.ts';

const USAGE = `costaff-workspace — publish to and pull back from CoStaff Workspace

  costaff-workspace <command> [options]

  push            push this folder up (run it with nothing else)
  pull <token>    fetch a published file's source back out
  login           sign this machine in
  logout          forget this machine's sign-in

  costaff-workspace <command> --help   for that command's options

Endpoint defaults to ${DEFAULT_ENDPOINT}; --endpoint or
COSTAFF_WORKSPACE_ENDPOINT points at a receiver you run yourself.
`;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'push':
      return runPush(rest);
    case 'pull':
      return runPull(rest);
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
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
