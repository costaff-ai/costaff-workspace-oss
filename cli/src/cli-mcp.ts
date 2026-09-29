/**
 * 讓自己的 Agent 接上工作區。
 *
 * 這個指令不碰任何憑證。它曾經把這台機器的裝置權杖直接印出來，好湊成一行能貼的
 * 指令 —— 那張權杖能推送、能取回原始碼，印在畫面上就是留在捲動紀錄、截圖、錄影裡。
 *
 * 所以金鑰改成人在網站上自己建：取了名字、看得到、可以單獨撤銷，而且只能用在
 * MCP。這裡只印位址、佔位符，和去哪裡建金鑰。不必登入，也不連 MCP，只問一次探索
 * 文件確認對方真的提供 MCP。
 */

import { discover } from './client.ts';
import { DEFAULT_ENDPOINT } from './defaults.ts';
import { done, line } from './report.ts';

export const KEY_PLACEHOLDER = '<costaff-workspace-api-key>';

const USAGE = `costaff-workspace mcp — connect your agent to edit files in the workspace

  costaff-workspace mcp [--endpoint <url>] [--json]

Prints the MCP address and the command that adds it to Claude Code, with a
placeholder where the key goes. Make the key yourself on the workspace's
devices page: it is named, listed, revocable on its own, and works for MCP
only. This command never handles a credential.
`;

export function mcpSetup(endpoint: string, mcpPath: string) {
  const url = new URL(mcpPath, endpoint).toString();
  const keysUrl = new URL('/devices', endpoint).toString();
  const claude = `claude mcp add --transport http costaff-workspace ${url} --header "Authorization: Bearer ${KEY_PLACEHOLDER}"`;
  return { url, keysUrl, claude };
}

export async function runMcp(argv: string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }
  const at = argv.indexOf('--endpoint');
  const endpoint = new URL(
    (at === -1 ? undefined : argv[at + 1]) ?? process.env.COSTAFF_WORKSPACE_ENDPOINT ?? DEFAULT_ENDPOINT,
  ).toString();

  const discovery = await discover(endpoint);
  if (discovery.mcp === undefined) {
    throw new Error(`${discovery.name} does not offer editing over MCP.`);
  }
  const { url, keysUrl, claude } = mcpSetup(endpoint, discovery.mcp);

  line(
    [
      '',
      `  MCP   ${url}`,
      '',
      `  1. Make a key at ${keysUrl}  (MCP keys → Create key)`,
      `  2. In your project folder, run this with ${KEY_PLACEHOLDER} replaced by that key:`,
      '',
      `    ${claude}`,
      '',
    ].join('\n'),
  );
  done({ command: 'mcp', endpoint, url, keysUrl, placeholder: KEY_PLACEHOLDER, claude });
}
