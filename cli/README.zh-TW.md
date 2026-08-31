# costaff-workspace

[![npm](https://img.shields.io/npm/v/costaff-workspace?style=for-the-badge)](https://www.npmjs.com/package/costaff-workspace)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[English](README.md) · **繁體中文**

**[CoStaff Workspace](https://workspace.costaffs.app) 的命令列工具。**
把在本機做好的文件發佈出去,拿回一條可以傳的連結。換一台機器取回、修改、再發佈,
連結始終不變。

適用於用 [open-doc](https://github.com/simonliu-ai-product/open-doc)(文件)、
open-slide(簡報)、open-sheet(試算表)做的專案。

```bash
npm i -g costaff-workspace
```

## 為什麼

建置好的文件是一整包檔案,而把一整包檔案傳給別人,不等於把文件交給他。靜態託管解決了
傳遞,卻丟掉了周邊的一切:誰可以讀、它叫什麼名字、對方看到的是哪一版,以及它是從什麼
原始碼建出來的。

`costaff-workspace push` 用一個指令補上這段落差。拿回來的是一個位址,不是一次部署。

## 特色

### 📤 一個指令,不用設定

在專案資料夾裡執行。slug 取自資料夾名稱、種類取自 `package.json` 的相依套件、
產物取自 `dist/`、標題取自套件描述。**每一個推斷都會印出來**,而推斷不出來的時候
它會停下,不會憑空編一個。

```
guessed --slug q3-report  --kind deck  --source-dir .
```

### 🔗 改了內容,連結不變

位址在建置之前就決定,不是事後才配發的,而且逐一記在檔案上。一年後重新發佈同一個
資料夾,所有拿著舊連結的人看到的就是新版本。

### ↩️ 換台機器就能接手

推送會帶著原始碼。`costaff-workspace pull <token>` 會在任何機器上還你一個完整的
專案——安裝、修改、發佈,同一條連結。沒有任何東西綁在最初發佈的那台電腦上。

### 🔒 預設私人,由你決定開放

剛發佈的檔案只有擁有者打得開。要讓誰讀,是在檔案管理員裡邀請,或把它改成公開連結。
**光是把位址傳給別人並不夠。**

### 📦 一份文件一個 bundle

含多份文件的專案會逐份建置。另一種做法——共用一次建置——會讓你只傳一份文件給別人時,
他就能取得其他每一份的資產。隔離是理由,多出來的建置次數是代價。

## 開始使用

```bash
cd my-doc
pnpm build                    # 發佈送出去的是建置後的檔案
costaff-workspace push
```

第一次推送會印出一條登入連結,驗證碼已經在網址裡。在瀏覽器按下同意,指令會自己繼續,
之後這台機器就保持登入。

```
4 documents — one bundle each
getting-started              → https://workspace.costaffs.app/dcuk0lmf875ctrgxfppa
q3-numbers                   → https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet
```

名稱、資料夾,以及每一份誰可以讀,都在
[workspace.costaffs.app](https://workspace.costaffs.app) 管理。

> 專案的原始碼會和建置產物一起上傳,那正是之後 `pull` 得以成立的原因。
> `node_modules` 和點開頭的檔案永遠不會被收進去,所以 **`.env` 不會跟著走**。
> `--no-source` 則只發佈建置後的檔案。

## 指令

| | |
| --- | --- |
| `costaff-workspace push` | 發佈這個資料夾 |
| `costaff-workspace pull <token> [dir]` | 取回某份已發佈檔案的原始碼 |
| `costaff-workspace login` | 讓這台機器登入 |
| `costaff-workspace logout` | 忘掉這台機器的登入 |

## 參數

一般的專案一個都不需要。推斷錯了才補上那一個。

| | |
| --- | --- |
| `--title "第三季報告"` | 檔案管理員裡顯示的名稱 |
| `--slug q3-report` | 檔案的身分,也決定重推會更新哪一份 |
| `--kind document\|deck\|workbook` | 種類推斷錯誤時 |
| `--site-dir build` | 建置產物不在 `dist` 時 |
| `--dry-run` | 打包並回報;不上傳,也不需要網路 |
| `--no-source` | 只發佈建置後的檔案,不帶原始碼 |

`costaff-workspace push --help` 會列出全部參數。

## 授權

MIT
