# costaff-workspace

[English](README.md) · **繁體中文**

[CoStaff Workspace](https://workspace.costaffs.app) 的命令列工具,以及它所使用的協定規格。

```bash
npm i -g costaff-workspace

cd my-doc
costaff-workspace push
```

`cli/` 是發佈到 npm 的那個套件——指令做什麼、有哪些旗標,看[它的說明](cli/README.zh-TW.md)。
[`PROTOCOL.md`](PROTOCOL.md) 是傳輸協定:任何人都可以架自己的 receiver,`--endpoint` 指過去就是。

服務本身不在這個 repo 裡。這裡放的是**使用者在自己機器上跑的那一半**,以及兩邊之間的契約。

## 開發

```bash
cd cli
pnpm install
pnpm test
pnpm build
```

`pnpm build` 會編到 `dist/`,那就是套件實際送出去的內容。發佈前想先試,直接裝這個資料夾:

```bash
pnpm add -g ./cli
```

## 授權

MIT
