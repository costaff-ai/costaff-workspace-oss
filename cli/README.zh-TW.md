# costaff-workspace

[English](README.md) · **繁體中文**

把你在自己電腦上做好的文件,變成一條可以傳給別人的連結。

適用於用 [open-doc](https://github.com/simonliu-ai-product/open-doc)(文件)、
open-slide(簡報)、open-sheet(試算表)做的專案。

---

## 1. 安裝

需要 [Node.js](https://nodejs.org) 20 以上。用 `node -v` 確認。

```bash
npm i -g costaff-workspace
```

確認裝好了:

```bash
costaff-workspace --help
```

<details>
<summary>如果顯示「找不到指令」</summary>

你的 shell 看不到 npm 放全域指令的地方。`npm prefix -g` 會印出那個資料夾,把它底下的
`bin` 加進 `PATH`。如果你用 pnpm,跑一次 `pnpm setup` 就好。
</details>

## 2. 先建置你的專案

發佈送出去的是**建置後的檔案**,所以要先建置。

```bash
cd my-doc
pnpm install
pnpm build
```

跑完應該會出現一個 `dist/` 資料夾。如果你的專案輸出到別的地方,記住那個名字,
第 3 步會用到。

## 3. 推上去

```bash
costaff-workspace push
```

### 第一次會請你登入

```
  Sign in to CoStaff Workspace
  open  https://workspace.costaffs.app/activate?code=WXYZ-1234
  code  WXYZ-1234
```

用瀏覽器打開那個網址。**驗證碼已經在網址裡**,所以你只要按同意。指令會自己等著,
授權完就繼續。

這台機器之後就記住登入了,不會再問。

### 然後它就發佈了

```
  4 documents — one bundle each
  getting-started              → https://workspace.costaffs.app/dcuk0lmf875ctrgxfppa
  q3-numbers                   → https://workspace.costaffs.app/8fjq2ldk3nx7yrpv0aet
  team-offsite                 → https://workspace.costaffs.app/pv0aet8fjq2ldk3nx7yr
  budget-2027                  → https://workspace.costaffs.app/3nx7yrpv0aet8fjq2ldk
```

那些連結就是檔案本身。傳一條給別人,他就能讀。

## 4. 管理你發佈的東西

到 **<https://workspace.costaffs.app>** 改名字、分資料夾,以及決定每一份誰可以看。

> **剛推上去的檔案是私人的。** 在檔案管理員裡設定之前,只有你打得開。
> **光是把連結傳給別人是不夠的**——你要在那裡邀請他,或是把檔案改成公開連結。

---

## 之後要再做的事

**你改了內容。** 重新建置再推一次。**連結不會變**——你傳出去的那條會直接看到新版本。

```bash
pnpm build && costaff-workspace push
```

**你換了一台電腦。** 用 token(連結的最後一段)把專案取回來:

```bash
costaff-workspace pull dcuk0lmf875ctrgxfppa my-doc
cd my-doc
pnpm install
```

拿回來的是一個完整的專案。改完、建置、推上去,同一條連結就更新了。

**你想在發佈前先確認。** 這會把東西打包好並回報要送出什麼,但不上傳,也不需要網路:

```bash
costaff-workspace push --dry-run
```

---

## 你通常一個參數都不用打

在專案資料夾裡執行,`push` 會自己推斷,而且**每一個猜測都會印出來**:

```
  guessed --slug my-report  --kind deck  --source-dir .
```

| 它會猜 | 依據 |
| --- | --- |
| 檔案的身分(`--slug`) | 資料夾的名字 |
| 是文件、簡報還是試算表(`--kind`) | 你 `package.json` 裡的相依套件 |
| 建置產物在哪(`--site-dir`) | `dist` |
| 標題 | `package.json` 的 description,沒有就用 slug |

猜錯就只補那一個參數。**完全猜不出來的時候它會停下來說明,不會憑空編一個。**

### 參數

| 參數 | 什麼時候用 |
| --- | --- |
| `--title "第三季報告"` | 你想在檔案管理員裡顯示別的名字 |
| `--slug q3-report` | 資料夾名字不是你要的身分 |
| `--kind document\|deck\|workbook` | 它猜錯種類了 |
| `--site-dir build` | 你的建置產物不在 `dist` |
| `--dry-run` | 想先確認再送出 |
| `--no-source` | 只想發佈建置後的檔案 |
| `--endpoint https://…` | 你自己架了服務 |

`costaff-workspace push --help` 會列出全部。

---

## 值得知道的幾件事

**原始碼也會一起上去,那是刻意的。** 那正是之後 `pull` 能在任何機器上還你一個
可以直接跑的專案的原因。`node_modules` 和點開頭的檔案永遠不會被收進去——
**你的 `.env` 不會跟著走**。`--no-source` 可以不送,但那之後這份檔案就拉不回來了。

**多份文件的專案會比單次建置久。** 每一份文件都會被建成獨立的 bundle。這是必要的:
在一份共用的建置產物裡,你只傳一份給別人,他就能拿到其他全部。

**別人分享給你的檔案,拉回來是一份副本。** 它不帶連結,所以推上去會發佈在你自己的
帳號底下,原件不受影響。

---

## 出問題的時候

| 它說 | 意思,以及怎麼辦 |
| --- | --- |
| `No site at dist — build it first.` | 沒有建置產物可以發佈。先跑專案的建置指令。 |
| `dist has no index.html — it is not a publishable site.` | 建置有跑,但沒有產出頁面。檢查建置設定。 |
| `cannot make a slug out of the folder name` | 資料夾名字裡沒有可以當身分的英數字——例如中文資料夾名。加上 `--slug my-report`。 |
| `Sign in first — run with --login.` | 執行 `costaff-workspace login`。 |
| `Sign-in code expired.` / `Sign-in timed out.` | 驗證碼只有幾分鐘有效。再推一次就會拿到新的。 |
| `… is not a CoStaff Workspace endpoint` | `--endpoint` 的網址不對,或那台伺服器沒開。拿掉這個參數就會用預設的。 |
| `… does not hand source back.` | 那個服務沒有提供 `pull`。 |
| `No file at that token.` | token 不對,或這份檔案不是你的、也沒有分享給你。 |

---

## 自己架服務

這個 CLI 沒有綁死在 workspace.costaffs.app,可以指到任何地方:

```bash
costaff-workspace push --endpoint https://your-host
export COSTAFF_WORKSPACE_ENDPOINT=https://your-host    # 整個 shell 都指過去
```

[`PROTOCOL.md`](../PROTOCOL.md) 是實作 receiver 用的規格。

## 授權

MIT
