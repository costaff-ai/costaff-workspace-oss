import { PublishError, discover } from './client.ts';
import { DEFAULT_ENDPOINT } from './defaults.ts';
import { pull } from './pull.ts';
import { login } from './push.ts';

const USAGE = `costaff-workspace pull — fetch a published file's source back out

  costaff-workspace pull <token> [dir] [options]

  --endpoint <url>     receiver (default ${DEFAULT_ENDPOINT},
                       or COSTAFF_WORKSPACE_ENDPOINT)
  --force              write into a directory that is not empty
  --bearer <token>     auth token instead of a stored login

If you own the file, what comes back can be pushed straight back to the
same link. If it was shared with you, it comes back as a copy: pushing it
publishes at a new link under your own workspace.
`;

export async function runPull(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return;
  }

  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      flags[arg.slice(2)] = next;
      i += 1;
    } else {
      flags[arg.slice(2)] = true;
    }
  }
  const str = (k: string): string | undefined =>
    typeof flags[k] === 'string' ? (flags[k] as string) : undefined;

  const endpoint = str('endpoint') ?? process.env.COSTAFF_WORKSPACE_ENDPOINT ?? DEFAULT_ENDPOINT;
  if (endpoint === '') throw new PublishError('missing --endpoint');
  const token = positional[0];
  if (token === undefined) throw new PublishError('missing <token>');

  const out = (line: string): void => {
    process.stdout.write(line);
  };
  await pull({
    endpoint,
    token,
    dir: positional[1],
    force: flags.force === true,
    bearer: str('bearer'),
    out,
    signIn: async () => login({ endpoint, out }, (await discover(endpoint)).name),
  });
}
