# 為什麼 `agy` 指令在程式裡會卡住？原理解析與修復說明

## 一、問題現象

- 在終端機（terminal）直接執行 `agy models`，不到 5 秒就印出結果並結束。
- 但是透過 Node.js 的 `exec` 呼叫（例如 `index.ts` 或 `summarizer.ts`），同樣的指令卻**永遠卡住**，不會回傳。
- 換成 `echo 123` 之類的指令，透過 `exec` 呼叫卻完全正常。

關鍵問題：**為什麼同一個指令，在終端機沒事，包進程式裡就卡死？**

---

## 二、先搞懂幾個基礎觀念

### 1. 每個程序都有三條標準資料流（stdio）

任何一個程序啟動時，作業系統都會給它三個檔案描述符（file descriptor，簡稱 fd）：

| fd | 名稱 | 預設用途 |
|----|------|----------|
| 0 | stdin（標準輸入） | 程式從這裡「讀」資料 |
| 1 | stdout（標準輸出） | 程式把結果「寫」到這裡 |
| 2 | stderr（標準錯誤） | 程式把錯誤訊息「寫」到這裡 |

這三條流「接到哪裡」會因執行環境而不同：

- 在終端機裡：三條流都接到你的**終端機（TTY）**。
- 在程式裡用 `exec`：Node 會幫子程序建立**管線（pipe）**，把 stdout / stderr 接過來，這樣程式才能把輸出抓進變數裡。

### 2. `exec` 的運作原理

當你寫：

```ts
const { stdout } = await execPromise('agy models');
```

Node 實際上做了這些事：

1. 啟動一個 shell：`/bin/sh -c "agy models"`。
2. 幫這個 shell 的 **stdout / stderr 各接一條 pipe**，自己抓著 pipe 的「讀取端」。
3. 子程序把輸出寫進 pipe 的「寫入端」，Node 從讀取端把資料一塊一塊收集起來。
4. **重點**：Node 要等到 pipe 收到 **EOF（End Of File，資料結束訊號）**，確定「不會再有任何資料了」，才會把 `stdout` 整包回傳、讓 `await` 結束。

那 pipe 什麼時候會收到 EOF？

> 只有當「**所有**持有這條 pipe 寫入端的程序」**全部關閉**它之後，讀取端才會收到 EOF。
> 只要還有任何一個程序握著寫入端不放，EOF 就永遠不會來，Node 就會一直等下去。

這就是卡住的伏筆。

### 3. `/dev/null` 是什麼？

`/dev/null` 是一個特殊的系統「裝置檔」，俗稱「黑洞」：

- **當作輸出**（`> /dev/null`）：寫進去的東西全部被丟棄。
- **當作輸入**（`< /dev/null`）：一去讀它，**立刻回傳 EOF**——也就是「沒有任何資料，直接結束」。

第二點很關鍵：把一個程式的 stdin 接到 `/dev/null`，等於告訴它「你沒有輸入，別等了」。

---

## 三、`agy` 卡住的真正原因

`agy` 不是一般的小工具，它是一個 **互動式 AI agent CLI**。它有一個特性：

> **執行時會 fork 出一個長駐的背景服務（daemon）**，而這個 daemon 會**繼承父程序的 stdout**。

把前面的觀念串起來，事情就清楚了。我們用 `agy models | cat` 做實驗，結果是：

```
（正常印出所有 model 名稱）
...接著整個指令卡死，不會結束
```

`cat` 印完了卻不結束，代表它的 stdin（也就是 `agy` 那條 pipe）**始終收不到 EOF**。為什麼？

1. `agy` 本體在不到 5 秒內就印完結果、自己結束了。
2. **但它 fork 出來的 daemon 還活著，而且還握著 stdout pipe 的寫入端。**
3. 因為寫入端沒有「全部」關閉，pipe 永遠不會送出 EOF。
4. 於是上游（`cat`、或 Node 的 `exec`）就一直癡癡地等資料，永遠等不到 → **卡住**。

### 為什麼在終端機沒事？

在終端機直接跑 `agy models` 時，stdout 接的是 **TTY，不是 pipe**。TTY 沒有「等所有寫入端關閉才放行」這種機制——`agy` 本體一結束，shell 就直接回到提示字元，根本不在乎 daemon 還握著 TTY。所以你完全感覺不到問題。

> **一句話總結**：問題不在 `agy` 慢，而在於「用 pipe 抓輸出」這件事，會被 `agy` 那個賴著不走、又抓著 pipe 不放的背景 daemon 害到永遠等不到結束訊號。

---

## 四、修復方法與原理

修復後的指令長這樣：

```ts
// 修好之前（會卡死）
await execPromise(`agy -p "$(cat ${promptFilePath})"`);

// 修好之後
await execPromise(
  `agy -p "$(cat ${promptFilePath})" < /dev/null > "${outFile}" 2> "${errFile}"`,
);
// 然後再從 outFile / errFile 把結果讀回來
```

它做了兩件事，正好對應兩個成因：

### 1. `< /dev/null`：餵 stdin 一個立即的 EOF

`agy` 啟動時會去讀 stdin。在程式環境裡 stdin 是一條開著、又永遠沒資料的 pipe，它就會卡在「等輸入」。
接上 `/dev/null` 後，它一讀就拿到 EOF，知道「沒輸入」，不再傻等。

### 2. `> "${outFile}" 2> "${errFile}"`：把輸出導去檔案，而不是 pipe（**這才是治本的關鍵**）

這是最重要的一步。把 stdout 導向**檔案**之後，fd 的繼承關係變成：

- shell 把 `agy` 的 stdout（fd 1）用 `dup2` 指向 **outFile**。
- `agy` fork 出來的 daemon，於是繼承到的是 **outFile 這個檔案的 fd**，**不再是 Node 的那條 pipe**。
- 此時 Node 那條 pipe 已經沒有任何人握著寫入端 → shell 一結束，pipe 立刻收到 EOF → `exec` 馬上回傳，**不再卡住**。
- daemon 繼續活著也無所謂，因為它握的是檔案，跟 Node 等待的 pipe 已經毫無關係。

最後我們再用 `fs.readFile` 把 `outFile`、`errFile` 的內容讀回程式，照樣拿得到完整輸出與錯誤訊息。

> 補充：光加 `< /dev/null` **不夠**，因為就算 stdin 解決了，daemon 抓著 stdout pipe 不放的問題還在。**真正治本的是把 stdout 導去檔案**，讓 daemon 繼承的是檔案 fd 而非 pipe。

---

## 五、兩種指令的差異對照

| 比較項目 | `echo 123`（正常） | `agy models`（會卡） |
|----------|--------------------|----------------------|
| 會不會讀 stdin | 不會碰 stdin | 會去讀 stdin，沒接 `/dev/null` 就傻等 |
| 會不會 fork 背景 daemon | 不會，印完就乾淨結束 | 會 fork 一個長駐 daemon |
| daemon 是否抓著 stdout pipe | 無此問題 | 會繼承並一直握著 stdout pipe |
| stdout pipe 何時送出 EOF | 程序一結束立刻送出 | daemon 不放手 → 永遠不送出 |
| `exec` 何時回傳 | 立刻回傳 | 永遠等不到 EOF → 卡死 |

核心差異就一句話：

> `echo` 印完就**徹底結束**，沒人再抓著 pipe，EOF 馬上來；
> `agy` 印完了，卻**留下一個抓著 stdout pipe 的 daemon**，害 EOF 永遠不來。
> 在終端機因為走的是 TTY 不是 pipe，所以看不出差別；一旦改用 pipe 抓輸出（`exec`、`| cat`），差別就要命了。

---

## 六、一句話結論

`agy` 會留下一個繼承 stdout 的背景 daemon，導致用 pipe 抓輸出的 `exec` 永遠等不到 EOF 而卡死。
修復方式是：**`< /dev/null` 讓它別等輸入**，**`> 檔案` 讓 daemon 繼承的是檔案而不是 pipe**，再從檔案讀回結果——這樣 Node 的 pipe 沒人佔用，`exec` 就能正常結束。
