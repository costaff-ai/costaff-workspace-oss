# costaff-workspace

[![npm](https://img.shields.io/npm/v/costaff-workspace?style=for-the-badge)](https://www.npmjs.com/package/costaff-workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[English](README.md) · **繁體中文**

**[CoStaff Workspace](https://workspace.costaffs.app) 的命令列工具。**
把在本機做好的文件發佈出去，拿回一條可以傳的連結。換一台機器取回、修改、再發佈，
連結始終不變。

適用於用 [open-doc](https://github.com/simonliu-ai-product/open-doc)（文件）、
open-slide（簡報）、open-sheet（試算表）做的專案。

你需要一個工作區的帳號——第一次 push 會帶你用 Google 登入。名額有限，新帳號有可能
先進候補名單。

## 安裝

需要 [Node.js](https://nodejs.org) 20 以上。

```bash
npm i -g costaff-workspace
```

確認裝好了：

```bash
costaff-workspace --help
```

<details>
<summary>如果顯示「找不到指令」</summary>

你的 shell 看不到 npm 放全域指令的位置。`npm prefix -g` 會印出那個資料夾，把它底下的
`bin` 加進 `PATH`。如果你用 pnpm，跑一次 `pnpm setup` 就好。
</details>

## 使用

先建置——發佈送出去的是**建置後的檔案**，不是整個原始碼目錄——然後在專案資料夾裡發佈。

```bash
cd my-doc
pnpm build
costaff-workspace push
```

第一次推送會印出一條登入連結，驗證碼已經在網址裡。在瀏覽器按下同意，指令會自己繼續，
之後這台機器就保持登入。

```
4 documents — one bundle each
getting-started              → https://workspace.costaffs.app/dcuk0lmf875ctrgxfppa
q3-numbers                   → https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet
```

每一條位址就是一份檔案。傳一條給別人，他就能讀。

**再次發佈，位址不變。** 建置、推送，所有拿著連結的人看到的就是新版本。

**發佈後的檔案預設是私人的。** 要讓誰讀，是在
[workspace.costaffs.app](https://workspace.costaffs.app) 邀請他，或把檔案改成公開連結。
**光是把位址傳出去並不夠。**

## 指令

| | |
| --- | --- |
| `costaff-workspace push` | 發佈這個資料夾 |
| `costaff-workspace pull <token> [dir]` | 取回某份已發佈檔案的原始碼 |
| `costaff-workspace theme` | 把專案的 `themes/` 資料夾留在工作區 |
| `costaff-workspace whoami` | 這台機器登入的是誰 |
| `costaff-workspace login` | 讓這台機器登入 |
| `costaff-workspace logout` | 忘掉這台機器的登入 |

每個指令都吃 `--help`，會印出它自己的選項。

### push

在專案資料夾裡執行，不用帶任何參數。slug 取自資料夾名稱、種類取自 `package.json`
的相依套件、產物取自 `dist/`。**每一個推斷都會印出來**，而推斷不出來的時候它會停下，
不會憑空編一個。

```
guessed --slug q3-report  --kind deck  --source-dir .
```

推斷錯了才補上那一個參數：

```bash
costaff-workspace push --title "第三季報告" --slug q3-report --kind deck
costaff-workspace push --site-dir build      # 建置產物不在 dist
costaff-workspace push --dry-run             # 只回報，不上傳
costaff-workspace push --no-source           # 只發佈產物，不帶原始碼
```

### pull

token 是位址的最後一段。

```bash
costaff-workspace pull dcuk0lmf875ctrgxfppa my-doc
cd my-doc && pnpm install
```

拿回來的是一個完整的專案。改完、建置、推上去，同一條位址就更新了。換一台電腦接手，
走的就是這條路。

### theme

主題就是一套版面風格：`themes/<id>.md` 寫下它，可選的 `themes/<id>.demo.tsx` 展示它。
把它們留在工作區，下一份文件才有辦法從上一份的樣子開始，而不是從零開始——你自己、
或替你寫的 agent，取回那份規格照著做。

```bash
costaff-workspace theme push          # 推 ./themes 裡的每一份
costaff-workspace theme list          # 看工作區裡有哪些
costaff-workspace theme pull aurora   # 把其中一份寫回 ./themes
costaff-workspace theme rm aurora     # 從工作區移除
```

主題屬於帳號，不屬於某一份檔案，所以你推的每個專案都拿得到同一批主題。框架從
`package.json` 判斷；判斷錯的時候用 `--kind document|deck|workbook` 指定——同一個 id
在不同框架各有一份時，也是靠它分辨。

`push` 會順便把每份主題的示範建置出來，讓工作區能呈現它的樣子。那是一次真的建置，
每份大約兩秒；`--no-demo` 可以跳過，只送規格。

### whoami

回答腳本在做任何事之前必須先確定的那件事：這裡有沒有憑證，還是得請人先登入一次？
它讀的是本機存的東西，不會連線到工作區，所以是即時的。

```bash
costaff-workspace whoami
costaff-workspace whoami --json
```

### 給機器讀的輸出

`--json` 在每個有結果的指令上都有效。stdout 上就一行，沒有別的——給人看的散文
會被靜音而不是混進來；失敗也是同一種形狀，並以狀態碼 1 結束。

```console
$ costaff-workspace push --json
{"ok":true,"command":"push","endpoint":"https://workspace.costaffs.app","dryRun":false,
 "items":[{"slug":"q3-report","kind":"deck","token":"8fjq2ldk3nx7yrpv0aet",
           "url":"https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet"}]}

$ costaff-workspace pull nope --json
{"ok":false,"error":"not signed in — run `costaff-workspace login` once, or set COSTAFF_WORKSPACE_TOKEN"}
```

`--json` 之下，需要互動登入的指令會**直接停下來，而不是等**。裝置碼是印給人在瀏覽器
按核准用的，腳本按不了；把碼吞掉只會讓它輪詢到過期，看起來像當掉。

### login / logout

`push` 和 `pull` 需要時會自己要求登入，所以這兩個指令是給你刻意執行用的——例如在
排程推送之前先把一台機器設定好，或是把要轉手的電腦上的登入清掉。

**→ [完整說明](cli/README.zh-TW.md)** —— 所有參數，以及各部分怎麼組合起來。

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
