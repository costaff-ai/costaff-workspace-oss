# costaff-workspace

[![npm](https://img.shields.io/npm/v/costaff-workspace?style=for-the-badge)](https://www.npmjs.com/package/costaff-workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**English** · [繁體中文](README.zh-TW.md)

**The command-line tool for [CoStaff Workspace](https://workspace.costaffs.app).**
Publish a document you built locally and get back a link you can send. Fetch it
onto another machine, edit, publish again — the link never changes.

Works with projects made using [open-doc](https://github.com/simonliu-ai-product/open-doc)
(documents), open-slide (decks) and open-sheet (workbooks).

## Install

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm i -g costaff-workspace
```

Check it:

```bash
costaff-workspace --help
```

<details>
<summary>If the command is not found</summary>

The shell cannot see where npm puts global commands. `npm prefix -g` prints that
folder; add its `bin` to `PATH`. With pnpm, run `pnpm setup` once.
</details>

## Use

Build the project first — publishing sends the built files, not the source
tree — then publish from the project folder.

```bash
cd my-doc
pnpm build
costaff-workspace push
```

The first push prints a sign-in link with the code already in it. Approve it in a
browser; the command continues on its own, and the machine stays signed in.

```
4 documents — one bundle each
getting-started              → https://workspace.costaffs.app/dcuk0lmf875ctrgxfppa
q3-numbers                   → https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet
```

Each address is a file. Send one to somebody and they can read it.

**Publishing again keeps the same address.** Build, push, and everyone holding
the link sees the new version.

**A published file is private until you say otherwise.** Invite readers, or turn
the file into a public link, at
[workspace.costaffs.app](https://workspace.costaffs.app). Sending the address
alone is not enough.

## Commands

| | |
| --- | --- |
| `costaff-workspace push` | publish this folder |
| `costaff-workspace pull <token> [dir]` | fetch a published file's source |
| `costaff-workspace login` | sign this machine in |
| `costaff-workspace logout` | forget this machine's sign-in |

### push

Run it in a project folder with nothing else. The slug comes from the folder
name, the kind from what `package.json` depends on, the bundle from `dist/`.
**Every guess is printed**, and a guess it cannot make stops the push rather than
inventing something.

```
guessed --slug q3-report  --kind deck  --source-dir .
```

Pass an option only when a guess is wrong:

```bash
costaff-workspace push --title "Q3 report" --slug q3-report --kind deck
costaff-workspace push --site-dir build      # build output is not in dist
costaff-workspace push --dry-run             # report only, upload nothing
costaff-workspace push --no-source           # built files without the source
```

### pull

The token is the last part of the address.

```bash
costaff-workspace pull dcuk0lmf875ctrgxfppa my-doc
cd my-doc && pnpm install
```

What comes back is a complete project. Edit it, build it, push it, and the same
address updates. This is how you continue on a different machine.

### login / logout

`push` and `pull` sign in on their own when they need to, so these are for doing
it deliberately — setting a machine up ahead of a scripted push, or clearing the
sign-in from a machine you are handing on.

**→ [Full documentation](cli/README.md)** — every option, and how the pieces fit.

## Repo layout

| | |
| --- | --- |
| [`cli/`](cli) | the published package |

The service is not in this repository. What is here is the half that runs on your
own machine.

## Development

```bash
cd cli
pnpm install
pnpm test
pnpm build            # compiles to dist/, which is what the package ships
pnpm add -g ./cli     # install the local build to try it
```

## License

MIT
