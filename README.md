# costaff-workspace

**English** · [繁體中文](README.zh-TW.md)

The official command-line tool for [CoStaff Workspace](https://workspace.costaffs.app).

## Using it

```bash
npm i -g costaff-workspace

cd my-doc
pnpm build
costaff-workspace push
```

**→ [Full guide](cli/README.md)** — installing, your first push, publishing
again, editing from another machine, and what to do when something goes wrong.

## What is in here

[`cli/`](cli) is the published package — `npm i -g costaff-workspace`.

The service itself is not in this repository. What is here is the half that runs
on your own machine.

## Working on the tool

```bash
cd cli
pnpm install
pnpm test
pnpm build          # compiles to dist/, which is what the package ships
pnpm add -g ./cli   # try the result before publishing
```

## Licence

MIT
