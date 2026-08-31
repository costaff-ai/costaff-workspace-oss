# costaff-workspace

[![npm](https://img.shields.io/npm/v/costaff-workspace?style=for-the-badge)](https://www.npmjs.com/package/costaff-workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[English](README.md) · **繁體中文**

**[CoStaff Workspace](https://workspace.costaffs.app) 的命令列工具。**
把在本機做好的文件發佈出去，拿回一條可以傳的連結。換一台機器取回、修改、再發佈，
連結始終不變。

```bash
npm i -g costaff-workspace

cd my-doc && pnpm build
costaff-workspace push
```

**→ [完整說明](cli/README.zh-TW.md)**

## 目錄結構

| | |
| --- | --- |
| [`cli/`](cli) | 發佈出去的套件 |

服務本身不在這個 repo 裡，這裡放的是在你自己機器上跑的那一半。

## 開發

```bash
cd cli
pnpm install
pnpm test
pnpm build            # 編到 dist/，那就是套件實際送出去的內容
pnpm add -g ./cli     # 裝本機建置的版本來試
```

## 授權

MIT
