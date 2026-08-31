# costaff-workspace

[English](README.md) · **繁體中文**

把文件、簡報、試算表發佈到 [CoStaff Workspace](https://workspace.costaffs.app),
以及把原始碼取回來繼續改。

為 [open-doc](https://github.com/simonliu-ai-product/open-doc)、open-slide、
open-sheet 做的專案而寫。

```bash
npm i -g costaff-workspace

cd my-doc
costaff-workspace push
```

指令就這一行。在專案資料夾裡它會把其餘的推斷出來:資料夾名字是 slug、`package.json`
說出這是文件還是簡報還是試算表、`dist/` 是建置產物,原始碼也跟著走,所以之後拉得回來改。
**每一個猜測都會印出來**,而猜不出來的時候它會停下來,不會憑空編一個。

第一次推會顯示裝置授權碼,在瀏覽器授權後那台機器就記住登入。

## 指令

```bash
costaff-workspace push                  # 推這個資料夾
costaff-workspace pull <token> [dir]    # 把某份已發佈檔案的原始碼取回來
costaff-workspace login                 # 這台機器登入
costaff-workspace logout                # 忘掉這台機器的登入
```

`push` 常用的旗標:

| 旗標 | |
| --- | --- |
| `--slug`、`--kind`、`--title` | 蓋掉某一個猜測 |
| `--site-dir <dir>` | 建置產物的位置(預設 `dist`) |
| `--no-source` | 只推產物——之後就拉不回來改了 |
| `--dry-run` | 只打包並回報,不上傳,也不需要網路 |
| `--endpoint <url>` | 指向你自己架的 receiver |

## 一個專案是「一個站台含多份文件」

open-doc 專案不是一份檔案,是一個站台底下有好幾份文件(`docs/`),而一次
`open-doc build` 會把它們的 chunk 全部放進同一個 `assets/`。所以 `push` 會**把每一份
各自建置成獨立的 bundle**,再一份一份推。

這不是為了整齊。**分享設定唯一能擋住其餘東西的方式,是其餘的東西根本不在那個 bundle 裡**:
共用的建置產物裡,拿到其中一份連結的人就能抓到其他份的 chunk。代價是真的——N 次建置
而不是一次,資產也在各個 bundle 之間重複。

## 協定是公開的

`src/protocol.ts` 是規格,不是實作細節。任何人都可以架自己的 receiver 並用
`--endpoint` 指過去;`COSTAFF_WORKSPACE_ENDPOINT` 則是整個 shell 都指過去。

**加一個必填欄位,對每一個第三方 receiver 都是破壞性變更**,所以預設一律是選填。
`source` 是選填的:不帶它的推送依然有效,忽略它的 receiver 依然能提供服務。`pull` 在
探索文件裡也是選填——不提供的 receiver 直接不寫這個欄位,而不是對 CLI 以為能用的指令回 404。

## 原始碼會帶走什麼

`node_modules` 和點開頭的檔案不會被收進去,`.env` 就在那個範圍裡。

本機的相依規格(`link:`、`file:`、`workspace:`、`portal:`)會被換成**實際安裝的版本**,
因為作者硬碟上的那條路徑在任何別的機器上都不存在。解不出版本就**拒絕推送**——把一條
沒人解得開的路徑發佈出去,換來的是一個講「找不到某個目錄」的安裝失敗,而不是講
「這個相依套件有問題」。

## 拉回來的東西取決於你是誰

伺服器決定,不是客戶端問。

| | 拿到 | 推回去會 |
| --- | --- | --- |
| 擁有者 | 含 token | 更新同一條連結 |
| 被分享的人 | 不含 token | 在自己這邊產生新連結,原件不動 |

兩個客戶端如果各自判斷誰是擁有者,遲早會有一個判斷錯,而那個錯就是有人覆蓋掉不屬於
自己的文件。

## 授權

MIT
