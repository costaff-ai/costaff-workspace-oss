# costaff-workspace

[English](README.md) · **繁體中文**

[CoStaff Workspace](https://workspace.costaffs.app) 的官方命令列工具。

## 怎麼用

```bash
npm i -g costaff-workspace

cd my-doc
pnpm build
costaff-workspace push
```

**→ [完整說明](cli/README.zh-TW.md)** —— 安裝、第一次推送、之後怎麼更新、
換一台電腦怎麼接手,以及出問題時怎麼辦。

## 這裡有什麼

[`cli/`](cli) 就是發佈出去的套件 —— `npm i -g costaff-workspace`。

服務本身不在這個 repo 裡,這裡放的是**在你自己機器上跑的那一半**。

## 開發這個工具

```bash
cd cli
pnpm install
pnpm test
pnpm build          # 編到 dist/，那就是套件實際送出去的內容
pnpm add -g ./cli   # 發佈前先試試看
```

## 授權

MIT
