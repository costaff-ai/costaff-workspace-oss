/**
 * The wire contract between the CLI and a receiver.
 *
 * Fields are optional by default. A CLI that is already installed keeps talking
 * to a receiver that has moved on, so adding a required field breaks every copy
 * out there; bump `PUSH_PROTOCOL` and keep reading the old shape when an
 * existing field has to change meaning.
 */

export const PUSH_PROTOCOL = 1;
export const DISCOVERY_PATH = '/.well-known/costaff-workspace-push';

export type Discovery = {
  protocol: number;
  name: string;
  deviceAuthStart: string;
  deviceAuthPoll: string;
  push: string;
  /** Absent on a receiver that does not hand source back. */
  pull?: string;
  /** Optional: where an agent edits files over MCP with the same device token. */
  mcp?: string;
  maxBytes: number;
};

/** RFC 8628 §3.2, minus the fields we do not use. */
export type DeviceAuthStart = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
};

export type DeviceAuthPoll =
  | { status: 'pending' }
  | { status: 'slow_down'; interval: number }
  | { status: 'denied' }
  | { status: 'expired' }
  | { status: 'ok'; token: string; expiresAt?: string; account?: string };

export type FileKind = 'document' | 'workbook' | 'deck';

/**
 * Where the source that built this file came from, and what it needs to build
 * again. Optional: a push without it is still a valid push, and a receiver that
 * ignores it still serves the site — which is why adding it does not bump
 * PUSH_PROTOCOL.
 */
export type PushSource = {
  /** The item's directory inside its workspace, e.g. "docs/publish-protocol". */
  dir: string;
  /** The file a rebuild starts from, relative to `dir`. */
  entry: string;
  /** Resolved to published versions — a local path means nothing to a puller. */
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/** Root of the pushed zip, alongside `site/`. */
export type PushManifest = {
  protocol: number;
  pushedAt: string;
  /**
   * No longer sent. An account has exactly one workspace and the receiver
   * decides which from the credentials on the request — a name the client chose
   * must not select whose workspace a push lands in. Older publishers still
   * send it and receivers ignore it, so it stays optional rather than removed.
   */
  workspace?: string;
  slug: string;
  kind: FileKind;
  /**
   * The public address. Chosen here rather than by the receiver because the
   * bundle's asset paths are baked against it at build time, and kept in the
   * workspace's state file so re-pushing updates the same link.
   */
  token: string;
  title: string;
  subtitle?: string;
  /** open-doc / open-slide 的 meta.theme —— 這份檔案是照哪一份主題做的。 */
  theme?: string;
  folder?: string | null;
  route: string;
  entry: string;
  /**
   * The source revision this was built from, as the last pull or push reported
   * it. Lets the receiver refuse a push that would publish over work landed
   * since — by an agent over MCP, or another editor. Omitted when unknown.
   */
  base?: number;
  source?: PushSource;
};

export type PushResult = {
  workspace: string;
  slug: string;
  url: string;
  updated: boolean;
  /** The source revision this push became, on a receiver that keeps them. */
  revision?: number;
};

export function isDiscovery(value: unknown): value is Discovery {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.protocol === 'number' &&
    typeof v.name === 'string' &&
    typeof v.deviceAuthStart === 'string' &&
    typeof v.deviceAuthPoll === 'string' &&
    typeof v.push === 'string' &&
    typeof v.maxBytes === 'number'
  );
}

export function isPushResult(value: unknown): value is PushResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.url === 'string' && typeof v.slug === 'string';
}
