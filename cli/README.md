# costaff-workspace

**English** · [繁體中文](README.zh-TW.md)

Publish documents, decks and workbooks to [CoStaff Workspace](https://workspace.costaffs.app),
and pull their source back out to keep working on them.

Built for projects made with [open-doc](https://github.com/simonliu-ai-product/open-doc),
open-slide and open-sheet.

```bash
npm i -g costaff-workspace

cd my-doc
costaff-workspace push
```

That is the whole command. In a project folder it works the rest out: the folder
name is the slug, `package.json` says whether this is a document, a deck or a
workbook, `dist/` is the built bundle, and the source travels with it so the file
can be pulled back and edited. Every guess is printed, and a guess it cannot make
stops the push rather than inventing something.

The first push shows a device code to authorise in a browser. That machine stays
signed in afterwards.

## Commands

```bash
costaff-workspace push                  # push this folder
costaff-workspace pull <token> [dir]    # fetch a published file's source
costaff-workspace login                 # sign this machine in
costaff-workspace logout                # forget this machine's sign-in
```

Useful flags on `push`:

| Flag | |
| --- | --- |
| `--slug`, `--kind`, `--title` | override a guess |
| `--site-dir <dir>` | the built bundle (default `dist`) |
| `--no-source` | publish the bundle alone — nothing can be pulled back out of it |
| `--dry-run` | package and report, without uploading or needing a network |
| `--endpoint <url>` | a receiver you run yourself |

## A project is a site of many documents

An open-doc project is not one file — it is a site holding several documents
under `docs/`, and one `open-doc build` puts all of their chunks in a single
`assets/` directory. So `push` builds each document into a bundle of its own and
pushes them one at a time.

That is not tidiness. A share can only withhold the rest of a workspace if the
rest of the workspace is not in the bundle: inside a shared build, anyone holding
a link to one document can fetch the chunks of the others. The cost is real — N
builds instead of one, and assets repeated across them.

## The protocol is public

`src/protocol.ts` is a specification, not an implementation detail. Anyone can
run their own receiver and point `--endpoint` at it; `COSTAFF_WORKSPACE_ENDPOINT`
does the same thing for a whole shell.

Adding a required field is a breaking change for every third-party receiver, so
optional is the default. `source` is optional: a push without it is still valid,
and a receiver that ignores it still serves. `pull` is optional in the discovery
document — a receiver that cannot hand source back omits the field rather than
answering 404 to a command the CLI thought it had.

## What travels with the source

`node_modules` and dotfiles are not collected. `.env` is inside that.

Local dependency specs (`link:`, `file:`, `workspace:`, `portal:`) are replaced
with the version actually installed, because a path on the author's disk exists
on no other machine. A version that cannot be resolved refuses the push — a
published path nobody can resolve buys an install failure that talks about a
missing directory instead of a broken dependency.

## What comes back depends on who you are

The server decides, not the client.

| | You get | Pushing it back |
| --- | --- | --- |
| Owner | includes the token | updates the same link |
| Shared with you | no token | publishes at a new link of your own; the original is untouched |

Two clients each deciding who owns a file would eventually disagree.

## Licence

MIT
