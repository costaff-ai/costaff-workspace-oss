# costaff-workspace

**English** · [繁體中文](README.zh-TW.md)

Turn a document you built on your own machine into a link you can send someone.

Works with projects made using [open-doc](https://github.com/simonliu-ai-product/open-doc)
(documents), open-slide (decks) and open-sheet (workbooks).

---

## 1. Install it

You need [Node.js](https://nodejs.org) 20 or newer. Check with `node -v`.

```bash
npm i -g costaff-workspace
```

Confirm it is there:

```bash
costaff-workspace --help
```

<details>
<summary>If the command is not found</summary>

Your shell cannot see where npm puts global commands. `npm prefix -g` prints
that folder; add its `bin` to your `PATH`. With pnpm, run `pnpm setup` once.
</details>

## 2. Build your project

Publishing sends the **built** files, so build first.

```bash
cd my-doc
pnpm install
pnpm build
```

You should now have a `dist/` folder. If your project builds somewhere else,
remember the name — you will pass it in step 3.

## 3. Push

```bash
costaff-workspace push
```

### The first time, it asks you to sign in

```
  Sign in to CoStaff Workspace
  open  https://workspace.costaffs.app/activate?code=WXYZ-1234
  code  WXYZ-1234
```

Open that address in a browser. **The code is already in the link**, so you only
have to approve it. The command waits, then carries on by itself.

This machine stays signed in. You will not see this again.

### Then it publishes

```
  4 documents — one bundle each
  getting-started              → https://workspace.costaffs.app/dcuk0lmf875ctrgxfppa
  q3-numbers                   → https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet
  team-offsite                 → https://workspace.costaffs.app/pv0aet8fjq2ldk3nx7yr
  budget-2027                  → https://workspace.costaffs.app/3nx7yrpv0aet8fjq2ldk
```

Those links are the files. Send one to someone and they can read it.

> Your project's source is uploaded too — that is what lets you fetch it back
> later on another machine. `node_modules` and dotfiles are never collected, so
> **your `.env` does not travel**. `--no-source` publishes the built files alone.

## 4. Manage what you published

Go to **<https://workspace.costaffs.app>** to rename files, put them in folders,
and decide who may read each one.

> **A newly pushed file is private.** Only you can open it until you say
> otherwise in the file manager. Sending someone the link is not enough — you
> invite them, or you turn the file into a public link, there.

---

## Doing it again

**You changed something.** Build and push again. **The link stays the same** —
whoever you sent it to sees the new version.

```bash
pnpm build && costaff-workspace push
```

**You are on a different computer.** Fetch the project back with the token — the
last part of the link:

```bash
costaff-workspace pull dcuk0lmf875ctrgxfppa my-doc
cd my-doc
pnpm install
```

What comes back is a complete project. Edit it, build it, push it, and the same
link updates.

**You want to check before publishing.** This packages everything and reports
what it would send, without uploading and without needing a network:

```bash
costaff-workspace push --dry-run
```

---

## You usually pass no options at all

Run in a project folder, `push` works out the rest and **prints every guess**:

```
  guessed --slug my-report  --kind deck  --source-dir .
```

| It guesses | From |
| --- | --- |
| the file's identity (`--slug`) | the folder's name |
| document, deck or workbook (`--kind`) | what your `package.json` depends on |
| the built files (`--site-dir`) | `dist` |
| the title | your `package.json` description, else the slug |

If a guess is wrong, pass that one option. If it cannot guess at all it stops and
says so, rather than inventing something.

### Options

| Option | Use it when |
| --- | --- |
| `--title "Q3 report"` | you want a different name in the file manager |
| `--slug q3-report` | the folder name is not the identity you want |
| `--kind document\|deck\|workbook` | it guessed the wrong kind |
| `--site-dir build` | your build output is not in `dist` |
| `--dry-run` | you want to check before sending |
| `--no-source` | you want to publish the built files alone |

`costaff-workspace push --help` lists all of them.


## Licence

MIT
