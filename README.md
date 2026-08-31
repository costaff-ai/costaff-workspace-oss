# costaff-workspace

[![npm](https://img.shields.io/npm/v/costaff-workspace?style=for-the-badge)](https://www.npmjs.com/package/costaff-workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**English** · [繁體中文](README.zh-TW.md)

**The command-line tool for [CoStaff Workspace](https://workspace.costaffs.app).**
Publish a document you built locally and get back a link you can send. Fetch it
onto another machine, edit, publish again — the link never changes.

```bash
npm i -g costaff-workspace

cd my-doc && pnpm build
costaff-workspace push
```

**→ [Documentation](cli/README.md)**

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
