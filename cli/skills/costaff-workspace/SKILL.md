---
name: costaff-workspace
description: Publish a built open-doc, open-slide or open-sheet project to CoStaff Workspace and get shareable links back, pull a published file's source onto this machine to keep working on it, or keep a project's themes/ folder in the workspace. Use whenever the user asks to publish, ship, share, upload or "put this online", asks for the link to something they published, wants to continue editing something that lives in the workspace, or mentions costaff-workspace, workspace.costaffs.app, or a token that looks like a workspace address.
---

# Publishing to CoStaff Workspace

The `costaff-workspace` CLI is the only way files get into the workspace — there
is no browser upload. Every command takes `--json`, which prints one line on
stdout and nothing else. Use it: the prose output is for people and its wording
is not a contract.

## Before anything else: is this machine signed in?

```bash
costaff-workspace whoami --json
```

```json
{"ok":true,"command":"whoami","endpoint":"https://workspace.costaffs.app","signedIn":false,"source":"none","account":null,"expiresAt":null}
```

**If `signedIn` is false, stop and ask the user to run `costaff-workspace login`
themselves.** Signing in prints a device code that has to be approved in a
browser; you cannot do that, and you must not try. Under `--json` every command
that would need it fails immediately rather than waiting, so a run that skips
this check does not hang — it just fails later with less to say.

`source` tells you where a credential came from: `flag`, `env`, `stored`, or
`none`. `whoami` reads local state only, so a token revoked on the server still
reads as signed in until something uses it.

## Publishing

Publishing sends the **built** output, so build first. Then, from the project
folder:

```bash
pnpm build
costaff-workspace push --dry-run --json   # packages and reports, uploads nothing
costaff-workspace push --json
```

Always dry-run first and show the user what it found. `push` guesses the slug
from the folder name and the kind from `package.json`; a wrong guess publishes
under the wrong identity, and the dry run is where that is cheap to catch.

```json
{"ok":true,"command":"push","endpoint":"https://workspace.costaffs.app","dryRun":false,
 "items":[{"slug":"q3-report","kind":"deck","token":"8fjq2ldk3nx7yrpv0aet",
           "url":"https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet"}]}
```

Give the user the `url`. Keep the `token`: it is what `pull` takes.

**Ask before pushing.** A push puts the user's work on a public host under an
address they can hand to other people. It is private until they share it, and
re-pushing keeps the same address, so this is not dangerous — but it is theirs
to decide, and an unasked-for publish is a surprise.

A project with several documents publishes each as its own bundle, so `items`
usually has more than one entry. Report all of them.

## Continuing somewhere else

```bash
costaff-workspace pull <token> ./my-doc --json
cd my-doc && pnpm install
```

What comes back is a complete project. Build it, push it, and the same address
updates — that is how a document moves between machines without the link
changing.

## Themes

A theme is a house style the next document can start from: `themes/<id>.md`
describes it, an optional `themes/<id>.demo.tsx` shows it. Themes belong to the
account rather than to one file.

```bash
costaff-workspace theme list --json     # what the account already has
costaff-workspace theme pull aurora     # copy one into ./themes to follow it
costaff-workspace theme push            # send this project's themes up
```

When the user asks for a document that should look like their others, check
`theme list` first and pull the spec rather than inventing a look.

## When something fails

Every failure is the same shape, with exit status 1:

```json
{"ok":false,"error":"not signed in — run `costaff-workspace login` once, or set COSTAFF_WORKSPACE_TOKEN"}
```

Read `error` and say what it says. Two worth recognising:

- **not signed in** — ask the user to run `login`. Do not retry.
- **a guess it could not make** — `push` refuses rather than inventing a slug or
  kind. Pass `--slug` or `--kind` once you and the user agree what they are.

## What not to do

- Do not open a browser, or tell the user you will sign in for them.
- Do not parse the human-readable output. `--json` exists for this.
- Do not push without building first; the workspace serves what `dist/` held.
- Do not push a project you have not been asked to publish.
