import {
  type DeviceAuthPoll,
  type DeviceAuthStart,
  DISCOVERY_PATH,
  type Discovery,
  isDiscovery,
  isPushResult,
  PUSH_PROTOCOL,
  type PushResult,
} from './protocol.ts';

export class PublishError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Machine-readable reason from the receiver; a status alone is ambiguous. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

function resolveAgainst(endpoint: string, target: string): string {
  return new URL(target, endpoint.endsWith('/') ? endpoint : `${endpoint}/`).toString();
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PublishError(`${res.url} returned ${res.status} with a non-JSON body.`, res.status);
  }
}

function errorCode(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null) {
    const code = (body as Record<string, unknown>).code;
    if (typeof code === 'string' && code !== '') return code;
  }
  return undefined;
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const message = (body as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  return fallback;
}

export async function discover(endpoint: string): Promise<Discovery> {
  const url = resolveAgainst(endpoint, `.${DISCOVERY_PATH}`);
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err) {
    throw new PublishError(
      `Cannot reach ${endpoint} — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new PublishError(`${endpoint} is not a CoStaff Workspace endpoint (${res.status}).`);
  }
  const body = await readJson(res);
  if (!isDiscovery(body)) {
    throw new PublishError(`${endpoint} returned a discovery document we cannot read.`);
  }
  if (body.protocol > PUSH_PROTOCOL) {
    throw new PublishError(
      `${body.name} speaks push protocol ${body.protocol}; this open-doc understands ${PUSH_PROTOCOL}. Upgrade costaff-workspace.`,
    );
  }
  return body;
}

export async function startDeviceAuth(
  endpoint: string,
  discovery: Discovery,
): Promise<DeviceAuthStart> {
  const res = await fetch(resolveAgainst(endpoint, discovery.deviceAuthStart), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ protocol: PUSH_PROTOCOL }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new PublishError(
      errorMessage(body, `Login could not start (${res.status}).`),
      res.status,
    );
  }
  return body as DeviceAuthStart;
}

export async function pollDeviceAuth(
  endpoint: string,
  discovery: Discovery,
  deviceCode: string,
): Promise<DeviceAuthPoll> {
  const res = await fetch(resolveAgainst(endpoint, discovery.deviceAuthPoll), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ deviceCode }),
  });
  const body = await readJson(res);
  if (res.status === 428) return { status: 'pending' };
  if (!res.ok) {
    throw new PublishError(errorMessage(body, `Login failed (${res.status}).`), res.status);
  }
  return body as DeviceAuthPoll;
}

export async function upload(
  endpoint: string,
  discovery: Discovery,
  token: string,
  bytes: Uint8Array,
): Promise<PushResult> {
  if (bytes.byteLength > discovery.maxBytes) {
    throw new PublishError(
      `Bundle is ${formatBytes(bytes.byteLength)}; ${discovery.name} accepts at most ${formatBytes(discovery.maxBytes)}.`,
    );
  }
  const res = await fetch(resolveAgainst(endpoint, discovery.push), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/zip',
      accept: 'application/json',
    },
    body: bytes as unknown as BodyInit,
  });
  const body = await readJson(res);
  if (res.status === 401 || res.status === 403) {
    throw new PublishError(errorMessage(body, 'Login expired — run with --login.'), res.status);
  }
  if (!res.ok) {
    throw new PublishError(
      errorMessage(body, `Publish failed (${res.status}).`),
      res.status,
      errorCode(body),
    );
  }
  if (!isPushResult(body)) {
    throw new PublishError(`${discovery.name} accepted the upload but returned no share URL.`);
  }
  return body;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
