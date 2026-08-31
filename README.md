# costaff-workspace

**English** · [繁體中文](README.zh-TW.md)

The command-line tool for [CoStaff Workspace](https://workspace.costaffs.app),
and the specification of the protocol it speaks.

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

| | |
| --- | --- |
| [`cli/`](cli) | the published package — `npm i -g costaff-workspace` |
| [`PROTOCOL.md`](PROTOCOL.md) | the wire contract, so anyone can run their own receiver |

The service itself is not in this repository. What is here is the half that runs
on your own machine, and the contract between the two.

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
