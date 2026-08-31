# costaff-workspace

[![npm](https://img.shields.io/npm/v/costaff-workspace?style=for-the-badge)](https://www.npmjs.com/package/costaff-workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**English** · [繁體中文](README.zh-TW.md)

**The command-line tool for [CoStaff Workspace](https://workspace.costaffs.app).**
Publish a document you built locally and get back a link you can send. Fetch it
onto another machine, edit, publish again — the link never changes.

Works with projects made using [open-doc](https://github.com/simonliu-ai-product/open-doc)
(documents), open-slide (decks) and open-sheet (workbooks).

```bash
npm i -g costaff-workspace
```

## Why

A built document is a folder of files, and sending someone a folder is not
sending them a document. Static hosting solves the delivery and loses everything
around it: who may read the file, what it is called, which version they are
looking at, and the source it was built from.

`costaff-workspace push` closes that gap in one command. What comes back is an
address, not a deployment.

## Highlights

### 📤 One command, no configuration

Run it in a project folder. The slug comes from the folder name, the kind from
what `package.json` depends on, the bundle from `dist/`, the title from the
package description. **Every guess is printed**, and a guess it cannot make stops
the push rather than inventing something.

```
guessed --slug q3-report  --kind deck  --source-dir .
```

### 🔗 Links that survive edits

The address is settled before the build rather than assigned afterwards, and it
is remembered per file. Publish the same folder a year later and everyone holding
the old link sees the new version.

### ↩️ Editable from anywhere

A push carries the source. `costaff-workspace pull <token>` hands back a complete
project on any machine — install, edit, publish, same link. Nothing is tied to
the computer that published it first.

### 🔒 Private until you say otherwise

A newly published file opens for its owner and nobody else. Readers are invited,
or the file is made a public link, in the file manager. Sending someone the
address is not enough on its own.

### 📦 One bundle per document

A project holding several documents is built once per document. The alternative —
a single shared build — lets anyone sent one document reach every other
document's assets. Isolation is the reason; the extra builds are the price.

## Get started

```bash
cd my-doc
pnpm build                    # publishing sends the built files
costaff-workspace push
```

The first push prints a sign-in link with the code already in it. Approve it in a
browser: the command continues on its own, and the machine stays signed in.

```
4 documents — one bundle each
getting-started              → https://workspace.costaffs.app/dcuk0lmf875ctrgxfppa
q3-numbers                   → https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet
```

Names, folders, and who may read each file are managed at
[workspace.costaffs.app](https://workspace.costaffs.app).

> The project's source is uploaded alongside the build, which is what makes
> `pull` possible later. `node_modules` and dotfiles are never collected, so
> **`.env` does not travel**. `--no-source` publishes the built files alone.

## Commands

| | |
| --- | --- |
| `costaff-workspace push` | publish this folder |
| `costaff-workspace pull <token> [dir]` | fetch a published file's source |
| `costaff-workspace login` | sign this machine in |
| `costaff-workspace logout` | forget this machine's sign-in |

## Options

A normal project needs none of these. Pass one when a guess is wrong.

| | |
| --- | --- |
| `--title "Q3 report"` | the name shown in the file manager |
| `--slug q3-report` | the file's identity, and what a re-push updates |
| `--kind document\|deck\|workbook` | when the kind is guessed wrong |
| `--site-dir build` | when the build output is not `dist` |
| `--dry-run` | package and report; uploads nothing, needs no network |
| `--no-source` | publish the built files without the source |

`costaff-workspace push --help` lists every option.

## License

MIT
