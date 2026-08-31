# costaff-workspace

The command-line client for [CoStaff Workspace](https://workspace.costaffs.app),
and the specification of the protocol it speaks.

```bash
npm i -g costaff-workspace

cd my-doc
costaff-workspace push
```

`cli/` is the published package — see [its README](cli/README.md) for what the
command does and every flag it takes. [`PROTOCOL.md`](PROTOCOL.md) is the wire
contract: anyone can run their own receiver and point `--endpoint` at it.

The service itself is not in this repository. What is here is the half a user
runs on their own machine, and the contract between the two.

## Working on it

```bash
cd cli
pnpm install
pnpm test
pnpm build
```

`pnpm build` compiles to `dist/`, which is what the package ships. To try the
result before publishing, install the folder itself:

```bash
pnpm add -g ./cli
```

## Licence

MIT
