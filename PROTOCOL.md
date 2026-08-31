# The push protocol

`costaff-workspace` talks to a **receiver** over plain HTTP and JSON. Anyone can
run one; `--endpoint https://your-receiver.example` points the CLI at it, and
`COSTAFF_WORKSPACE_ENDPOINT` does the same for a whole shell.

The normative version of everything below is
[`cli/src/protocol.ts`](cli/src/protocol.ts). This document explains it.

Current version: **`PUSH_PROTOCOL = 1`**.

## Compatibility

**A required field is a breaking change for every receiver anyone has written.**
So new things are optional by default, and the version only moves when an
existing shape changes meaning.

Two examples of that rule in practice:

- `source` — the pushed source — was added without a version bump. A push
  without it is still valid, and a receiver that drops it still serves the site.
- `pull` is optional in the discovery document. A receiver that cannot hand
  source back **omits the field** rather than answering 404 to a command the CLI
  believed it had. Absent means "not offered"; present means "works".

A receiver reading a manifest whose `protocol` is higher than it understands
should refuse the push and say so, rather than guess.

## 1. Discovery

```
GET /.well-known/costaff-workspace-push
```

```jsonc
{
  "protocol": 1,
  "name": "CoStaff Workspace",   // shown to the person signing in
  "deviceAuthStart": "/v1/device/start",
  "deviceAuthPoll": "/v1/device/poll",
  "push": "/v1/push",
  "pull": "/v1/pull",            // optional — omit if source cannot be fetched
  "maxBytes": 52428800           // largest accepted upload
}
```

Paths may be relative to the endpoint or absolute.

## 2. Signing in

[RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628) device authorisation,
minus the fields this client does not use. A CLI cannot host a redirect URI, and
a scripted push cannot show anyone a browser — so the sign-in is done once, up
front, and the machine keeps the token.

```
POST <deviceAuthStart>
→ { "deviceCode", "userCode", "verificationUri", "interval", "expiresIn" }
```

The CLI prints `verificationUri` and `userCode`, then polls:

```
POST <deviceAuthPoll>   { "deviceCode": "…" }
→ { "status": "pending" }
→ { "status": "slow_down", "interval": 10 }   // poll more slowly
→ { "status": "denied" }
→ { "status": "expired" }
→ { "status": "ok", "token": "…", "expiresAt": "…", "account": "…" }
```

The token goes in `authorization: Bearer …` on every later request.

## 3. Pushing

```
POST <push>          authorization: Bearer …
                     content-type: application/zip
```

The body is a zip of:

```
manifest.json
site/…            the built bundle, exactly as it will be served
source/…          optional — what it takes to build it again
```

`manifest.json`:

```jsonc
{
  "protocol": 1,
  "pushedAt": "2026-08-31T04:00:00.000Z",
  "slug": "q3-numbers",          // the file's identity in the workspace
  "kind": "document",            // document | workbook | deck
  "token": "7iulocqyoglyojkxjtuf",
  "title": "Q3 numbers",
  "subtitle": "…",               // optional
  "folder": null,                // optional
  "route": "/",                  // route inside the bundle
  "entry": "index.html",         // entry file inside the bundle
  "source": {                    // optional
    "dir": "docs/q3-numbers",
    "entry": "index.tsx",
    "dependencies": {},
    "devDependencies": {}
  }
}
```

```
→ { "workspace": "…", "slug": "…", "url": "https://…", "updated": true }
```

### The token is chosen by the client

This is the surprising one, and it is not an accident.

The token is the file's public address, and a bundle's asset paths are **baked
against it at build time** — the build happens before the upload, so the address
has to exist before the build. A receiver that assigned addresses itself would
be assigning them after every asset path had already been written.

So the CLI settles the token first and remembers it in the workspace's
`.costaff-workspace/files.json`; pushing the same slug again reuses it, which is
what makes a link stable across re-publishes. A receiver must treat a token that
is already someone else's as a conflict, not as an instruction.

### Sharing does not travel

A re-push must never resurrect a revoked link nor widen one the owner had
narrowed. Sharing state belongs to the file on the receiver, not to the push.

## 4. Pulling source back

Offered only if `pull` is present in discovery.

```
GET <pull>/<token>   authorization: Bearer …
→ application/zip
```

**What comes back depends on who is asking, and the receiver decides.**

| | Receives | Pushing it back |
| --- | --- | --- |
| The owner | includes `.costaff-workspace/files.json`, with the token | updates the same link |
| Someone it was shared with | no token | publishes at a new link of their own; the original is untouched |

The client never asks for one shape or the other. Two clients each deciding who
owns a file would eventually disagree, and the disagreement would be someone
overwriting a document that was not theirs.

A receiver that holds no source for a file answers `409` with a code of
`no_source` — distinct from `404`, which means there is no such file *or* it is
not yours. Those two are one answer on purpose: telling a stranger which of the
two it is confirms that a token exists.

## 5. Errors

JSON, with a `message` a person can read and an optional machine-readable
`code`:

```jsonc
{ "code": "no_source", "message": "That file was published without its source." }
```

`401` or `403` means the token is unusable — expired, revoked, or never valid
for this receiver. The CLI forgets it, signs in again, and retries the push once.
