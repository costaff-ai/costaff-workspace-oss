# costaff-workspace

[![npm](https://img.shields.io/npm/v/costaff-workspace?style=for-the-badge)](https://www.npmjs.com/package/costaff-workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**English** · [繁體中文](README.zh-TW.md)

**The command-line tool for [CoStaff Workspace](https://workspace.costaffs.app).**
Publish a document you built locally and get back a link you can send. Fetch it
onto another machine, edit, publish again — the link never changes.

Works with projects made using [open-doc](https://github.com/simonliu-ai-product/open-doc)
(documents), open-slide (decks) and open-sheet (workbooks).

You need an account on the workspace — the first push walks you through signing
in with Google. Places are limited, so a new account may land on a waitlist.

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
| `costaff-workspace theme` | keep the project's `themes/` folder in the workspace |
| `costaff-workspace whoami` | what this machine is signed in as |
| `costaff-workspace skills` | install the agent skill into this project |
| `costaff-workspace login` | sign this machine in |
| `costaff-workspace logout` | forget this machine's sign-in |

Any of them takes `--help` for its own options.

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

### theme

A theme is a house style: `themes/<id>.md` describes it, and an optional
`themes/<id>.demo.tsx` shows it. Keeping them in the workspace is how the next
document starts from the last one's look instead of from nothing — you, or an
agent writing for you, pull the spec and follow it.

```bash
costaff-workspace theme push          # every theme in ./themes
costaff-workspace theme list          # what is up there
costaff-workspace theme pull aurora   # write one back into ./themes
costaff-workspace theme rm aurora     # remove it from the workspace
```

Themes belong to the account, not to a file, so the same theme is available to
every project you push. The framework is read from `package.json`; pass
`--kind document|deck|workbook` when that guess is wrong, which is also how you
tell apart two themes that share an id across frameworks.

`push` builds each theme's demo so the workspace can show it. That is a real
build and takes a couple of seconds per theme — `--no-demo` skips it and sends
the specs alone.

### whoami

Answers the one question a script has to settle before it does anything: is
there a credential here, or does a person have to sign in once? It reads what is
stored and does not call the workspace, so it is instant.

```bash
costaff-workspace whoami
costaff-workspace whoami --json
```

### Machine-readable output

`--json` works on every command that has a result. One line on stdout, nothing
else — the prose is suppressed rather than mixed in, and failures come back in
the same shape with exit status 1.

```console
$ costaff-workspace push --json
{"ok":true,"command":"push","endpoint":"https://workspace.costaffs.app","dryRun":false,
 "items":[{"slug":"q3-report","kind":"deck","token":"8fjq2ldk3nx7yrpv0aet",
           "url":"https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet"}]}

$ costaff-workspace pull nope --json
{"ok":false,"error":"not signed in — run `costaff-workspace login` once, or set COSTAFF_WORKSPACE_TOKEN"}
```

Under `--json` a command that would need an interactive sign-in **stops rather
than waiting**. The device code is printed for a person to approve in a browser;
a script cannot do that, and swallowing the code would leave it polling until
the code expired, looking like a hang.

### skills

The package carries an agent skill — how to publish, what to check before it
does, and where it must stop and ask you. Install it into a project and Claude
Code (or anything reading `.agents/skills/`) picks it up:

```bash
costaff-workspace skills            # writes .claude/skills/ and .agents/skills/
costaff-workspace skills --dry-run  # say what would change
```

Re-run it after upgrading the CLI; it overwrites, because these files belong to
the package rather than to your project. Edit a copy under a different name if
you want your own.

The skill tells the agent to check `whoami` first and to **stop and ask you** to
sign in rather than trying — the device code needs a browser, and an agent
cannot use one.

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
