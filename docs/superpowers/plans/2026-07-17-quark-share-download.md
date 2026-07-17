# 夸克网盘分享下载扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Gopeed 扩展：解析夸克分享链接、递归目录、按空间分批转存到 `GopeedTemp`、取直链并默认删除转存，支持 `onStart` 刷新与 `__puus` 续期。

**Architecture:** 工程骨架对齐 `gopeed-extension-gofile`（webpack + `dist/index.js`）；业务拆为 `url` / `cookie` / `net` / `api` / `walk` / `transfer` / `resolve` / `start`。`onResolve` 完成转存取链；`onStart` 在直链过期时重取（必要时单文件重转存）。

**Tech Stack:** JavaScript (ESM 源码)、webpack 5、babel、`gopeed-polyfill-webpack-plugin`、`superagent`（可靠读取 `set-cookie` 以更新 `__puus`）、Node 内置 `node:test` 测纯函数。

**Spec:** `docs/superpowers/specs/2026-07-17-quark-share-download-design.md`

## Global Constraints

- 用户文案（manifest / README / 设置项 / 错误提示）使用中文
- URL `/s/{id}` → 代码命名 `shareId`；提取码 → `passcode`；仅在 API 请求体映射 `pwd_id`
- 提取码只从 URL（`?pwd=` 等）读取，无全局默认提取码设置
- 转存目录固定为网盘根下 `GopeedTemp`；默认取链后删除转存
- 安全余量默认 `100 * 1024 * 1024`；`onStart` label：`Gwkang@gopeed-extension-quark`
- 不把 Cookie / 提取码写入仓库；日志不长期明文打印完整 Cookie
- Git 安装需提交 `dist/index.js`；若仓库尚无 git，先 `git init` 再按任务提交

---

## File Structure

| 路径 | 职责 |
| --- | --- |
| `package.json` / `package-lock.json` | 依赖与 `build` / `dev` / `test` 脚本 |
| `webpack.config.js` / `babel.config.js` | 打包到 `dist/index.js` |
| `manifest.json` | `onResolve` / `onStart` 与设置项 |
| `src/index.js` | 注册事件 |
| `src/quark/constants.js` | 基址、UA、常量、扩展 label |
| `src/quark/url.js` | 解析 `shareId` / `passcode` / `pdirFid` |
| `src/quark/cookie.js` | Cookie 读写与 `__puus` 合并 |
| `src/quark/net.js` | superagent 请求、重试、错误映射入口 |
| `src/quark/api.js` | 夸克 REST 封装 |
| `src/quark/walk.js` | 递归分页列文件 |
| `src/quark/transfer.js` | `GopeedTemp`、分批、转存取链删除 |
| `src/quark/resolve.js` | `onResolve` 编排 |
| `src/quark/start.js` | `onStart` 编排 |
| `tests/*.test.js` | 纯函数单测 |
| `README.md` / `icon.png` / `.gitignore` / `LICENSE` | 文档与资源 |
| `dist/index.js` | 构建产物（需提交） |

---

### Task 1: 工程脚手架与测试脚本

**Files:**
- Create: `package.json`
- Create: `babel.config.js`
- Create: `webpack.config.js`
- Create: `.gitignore`
- Create: `tests/smoke.test.js`
- Create: `src/index.js`（临时空事件注册，后续任务替换）

**Interfaces:**
- Consumes: 无
- Produces: `npm run build` → `dist/index.js`；`npm test` 可跑 `node --test`

- [ ] **Step 1: 写入 `package.json`**

```json
{
  "name": "gopeed-extension-quark",
  "version": "1.0.0",
  "private": true,
  "description": "Gopeed 的夸克网盘分享下载扩展",
  "type": "module",
  "scripts": {
    "dev": "webpack --mode production --watch",
    "build": "webpack --mode production",
    "test": "node --test tests/**/*.test.js"
  },
  "keywords": ["gopeed", "gopeed-extension", "quark"],
  "author": "Gwkang",
  "license": "MIT",
  "devDependencies": {
    "@babel/core": "^7.22.20",
    "@babel/preset-env": "^7.22.20",
    "babel-loader": "^9.1.3",
    "gopeed": "^1.6.1",
    "gopeed-polyfill-webpack-plugin": "^1.0.6",
    "webpack": "^5.75.0",
    "webpack-cli": "^5.0.1"
  },
  "dependencies": {
    "superagent": "^9.0.2"
  }
}
```

- [ ] **Step 2: 写入 babel / webpack / gitignore（对齐 gofile）**

`babel.config.js`：

```js
export default {
  presets: [
    [
      '@babel/preset-env',
      {
        exclude: ['transform-async-to-generator', 'transform-regenerator'],
      },
    ],
  ],
};
```

`webpack.config.js`：与 `gopeed-extension-gofile/webpack.config.js` 相同（入口 `./src/index.js`，输出 `dist/index.js`，`GopeedPolyfillPlugin`）。

`.gitignore`：

```text
node_modules/
*.log
.DS_Store
.idea/
.vscode/
.cursor/
```

- [ ] **Step 3: 临时 `src/index.js` + smoke 测试**

```js
// src/index.js
gopeed.events.onResolve(async () => {
  throw new Error('尚未实现');
});
```

```js
// tests/smoke.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('构建产物 dist/index.js 存在且非空', () => {
  const distPath = path.join(root, 'dist', 'index.js');
  assert.ok(fs.existsSync(distPath), 'dist/index.js 应存在（请先 npm run build）');
  assert.ok(fs.statSync(distPath).size > 0, 'dist/index.js 不应为空');
});
```

- [ ] **Step 4: 安装依赖并验证**

Run: `npm install`
Run: `npm run build`
Expected: 生成 `dist/index.js`
Run: `npm test`
Expected: PASS（smoke 检查构建产物存在）

- [ ] **Step 5: Commit**

```bash
git init  # 若尚无仓库
git add package.json package-lock.json babel.config.js webpack.config.js .gitignore src/index.js tests/smoke.test.js
git commit -m "chore: scaffold gopeed quark extension project"
```

---

### Task 2: URL 解析（`shareId` / `passcode` / 子目录）

**Files:**
- Create: `src/quark/url.js`
- Create: `tests/url.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `parseShareUrl(rawUrl: string): { shareId: string, passcode: string, pdirFid: string }`

- [ ] **Step 1: 写失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShareUrl } from '../src/quark/url.js';

test('解析 shareId 与 passcode', () => {
  const r = parseShareUrl('https://pan.quark.cn/s/abc123xyz?pwd=ab12');
  assert.equal(r.shareId, 'abc123xyz');
  assert.equal(r.passcode, 'ab12');
  assert.equal(r.pdirFid, '');
});

test('解析 hash 子目录', () => {
  const r = parseShareUrl('https://pan.quark.cn/s/abc123xyz#/list/share/fid999');
  assert.equal(r.shareId, 'abc123xyz');
  assert.equal(r.pdirFid, 'fid999');
});

test('无效链接抛错', () => {
  assert.throws(() => parseShareUrl('https://example.com/x'), /分享/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/url.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `src/quark/url.js`**

```js
export function parseShareUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('无效的夸克分享链接');
  }
  const clean = rawUrl.replace(/\[.*?\]/g, '').trim();
  let shareId = '';
  let passcode = '';
  let pdirFid = '';

  const idMatch = clean.match(/\/s\/([a-zA-Z0-9]+)/i);
  if (idMatch) shareId = idMatch[1];
  else if (/^[a-zA-Z0-9]+$/.test(clean) && clean.length > 6) shareId = clean;

  const pwMatch = clean.match(/[?&](pwd|password|pw)=([a-zA-Z0-9]+)/i);
  if (pwMatch) passcode = pwMatch[2];

  const dirMatch = clean.match(/#\/list\/share\/([a-zA-Z0-9]+)/i);
  if (dirMatch) pdirFid = dirMatch[1];

  if (!shareId) throw new Error('无效的夸克分享链接：缺少分享 ID');
  return { shareId, passcode, pdirFid };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/url.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/quark/url.js tests/url.test.js
git commit -m "feat: parse quark share URLs into shareId and passcode"
```

---

### Task 3: Cookie 与 `__puus` 合并

**Files:**
- Create: `src/quark/cookie.js`
- Create: `tests/cookie.test.js`
- Create: `src/quark/constants.js`（本任务写入存储键与临时目录名）

**Interfaces:**
- Consumes: 无
- Produces:
  - `STORAGE_COOKIE_KEY = 'quark_cookie'`
  - `TEMP_FOLDER_NAME = 'GopeedTemp'`
  - `EXTENSION_LABEL = 'Gwkang@gopeed-extension-quark'`
  - `mergePuusIntoCookie(cookie: string, setCookieHeader: string | string[] | undefined): string`
  - `assertCookieConfigured(cookie: string): void`（缺 Cookie 或明显无 `__puus` 时抛中文错误）
  - 运行时封装（依赖 `gopeed`，本任务可不单测）：`getEffectiveCookie()` / `persistCookie(cookie)` / `updatePuusFromSetCookie(setCookie)`

- [ ] **Step 1: 写失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePuusIntoCookie, assertCookieConfigured } from '../src/quark/cookie.js';

test('合并 __puus', () => {
  const next = mergePuusIntoCookie('a=1; __puus=old', '__puus=new; Path=/; HttpOnly');
  assert.match(next, /__puus=new/);
  assert.doesNotMatch(next, /__puus=old/);
});

test('缺少 Cookie 抛错', () => {
  assert.throws(() => assertCookieConfigured(''), /Cookie/);
});

test('缺少 __puus 抛错', () => {
  assert.throws(() => assertCookieConfigured('a=1; b=2'), /__puus/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/cookie.test.js`
Expected: FAIL

- [ ] **Step 3: 实现 constants + cookie 纯函数与 gopeed 封装**

`constants.js` 至少包含：

```js
export const PAN_ORIGIN = 'https://pan.quark.cn';
export const DRIVE_BASE = 'https://drive-pc.quark.cn';
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-b478491100 Safari/537.36 Channel/pckk_other_ch';
export const PAGE_SIZE = 100;
export const MAX_RETRY = 3;
export const RETRY_DELAY_MS = 1500;
export const SAFE_BUFFER_BYTES = 100 * 1024 * 1024;
export const TEMP_FOLDER_NAME = 'GopeedTemp';
export const STORAGE_COOKIE_KEY = 'quark_cookie';
export const EXTENSION_LABEL = 'Gwkang@gopeed-extension-quark';
export const DEFAULT_CHUNK_FILE_COUNT = 50;
```

`cookie.js`：实现 `mergePuusIntoCookie`（按 `;` 拆分、替换或追加 `__puus=`）、`assertCookieConfigured`、以及：

```js
export function getEffectiveCookie() {
  return gopeed.storage.get(STORAGE_COOKIE_KEY) || (gopeed.settings.cookie || '').trim();
}

export function persistCookie(cookie) {
  gopeed.storage.set(STORAGE_COOKIE_KEY, cookie);
}

export function updatePuusFromSetCookie(setCookie) {
  const current = getEffectiveCookie() || '';
  const merged = mergePuusIntoCookie(current, setCookie);
  if (merged && merged !== current) persistCookie(merged);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/cookie.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/quark/constants.js src/quark/cookie.js tests/cookie.test.js
git commit -m "feat: manage quark cookie and __puus refresh merge"
```

---

### Task 4: 网络层（superagent + 重试）

**Files:**
- Create: `src/quark/net.js`

**Interfaces:**
- Consumes: `getEffectiveCookie`, `assertCookieConfigured`, `updatePuusFromSetCookie`, constants
- Produces:
  - `quarkRequest(url: string, method: 'GET'|'POST', data?: object): Promise<any>`  
    返回解析后的 JSON body；`code===40001||10000` 抛「Cookie 已失效…」；其它网络错误重试 `MAX_RETRY` 次

- [ ] **Step 1: 实现 `quarkRequest`**

要点：

- 每次请求前 `assertCookieConfigured(getEffectiveCookie())`
- Header：`Cookie`、`User-Agent`、`Referer: https://pan.quark.cn/`、`Origin: https://pan.quark.cn/`、`Content-Type: application/json;charset=UTF-8`
- `superagent`：`.ok(() => true)`，手动看 `status`
- 从 `response.headers['set-cookie']` 调用 `updatePuusFromSetCookie`
- Cookie 失效错误不重试；其它错误 sleep `RETRY_DELAY_MS` 后重试

完整实现应类似：

```js
import superagent from 'superagent';
import {
  MAX_RETRY,
  PAN_ORIGIN,
  RETRY_DELAY_MS,
  USER_AGENT,
} from './constants.js';
import {
  assertCookieConfigured,
  getEffectiveCookie,
  updatePuusFromSetCookie,
} from './cookie.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function quarkRequest(url, method, data = {}, retryCount = 0) {
  const cookie = getEffectiveCookie();
  assertCookieConfigured(cookie);
  try {
    const req =
      method === 'POST' ? superagent.post(url).send(data) : superagent.get(url);
    const response = await req
      .set({
        Cookie: cookie,
        'User-Agent': USER_AGENT,
        Referer: `${PAN_ORIGIN}/`,
        Origin: PAN_ORIGIN,
        'Content-Type': 'application/json;charset=UTF-8',
      })
      .ok(() => true);

    updatePuusFromSetCookie(response.headers['set-cookie']);

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = response.body || {};
    if (body.code === 40001 || body.code === 10000) {
      throw new Error(`Cookie 已失效或登录过期，请重新获取（代码: ${body.code}）`);
    }
    return body;
  } catch (err) {
    const message = (err && err.message) || String(err);
    if (message.includes('Cookie 已失效')) throw err;
    if (retryCount < MAX_RETRY) {
      await sleep(RETRY_DELAY_MS);
      return quarkRequest(url, method, data, retryCount + 1);
    }
    throw new Error(`网络请求失败：${message}`);
  }
}
```

- [ ] **Step 2: 构建验证模块可打包**

Run: `npm run build`
Expected: 成功（即使运行时仍未接事件）

- [ ] **Step 3: Commit**

```bash
git add src/quark/net.js
git commit -m "feat: add quark HTTP client with retry and cookie refresh"
```

---

### Task 5: 夸克 API 封装

**Files:**
- Create: `src/quark/api.js`

**Interfaces:**
- Consumes: `quarkRequest`, constants
- Produces（参数名用 `shareId`，请求体映射 `pwd_id`）：
  - `apiGetToken(shareId, passcode) → { stoken, title, ... }`
  - `apiGetDetailPage(shareId, stoken, pdirFid, page) → { list, count, total }`
  - `apiSaveFiles(shareId, stoken, fidList, fidTokenList, toPdirFid) → taskId`
  - `apiPollTask(taskId, fileCount) → savedFids[]`（status 2 成功，3 失败）
  - `apiGetDownloadLinks(fids) → [{ download_url, file_name, size, ... }]`
  - `apiDeleteFiles(fids) → void`（失败只 warn）
  - `apiGetAvailableSpace() → number`（字节；失败返回 `-1`）
  - `apiListDir(pdirFid) → list[]`
  - `apiCreateFolder(pdirFid, name) → fid`
  - `ensureGopeedTempFid() → string`（根下找/建 `GopeedTemp`）

- [ ] **Step 1: 实现 API 函数**

关键端点（与社区可复现请求对齐）：

- Token: `POST ${PAN_ORIGIN}/1/clouddrive/share/sharepage/token?pr=ucpro&fr=pc` body `{ pwd_id: shareId, passcode }`
  - `code===31001` → `此分享需要提取码，请在链接末尾加上 ?pwd=提取码`
  - `code===31002` → `分享链接已失效或被取消`
  - 提取码错误：用接口 `message` 包装为「提取码错误，请检查链接中的 ?pwd=」
- Detail: `GET .../share/sharepage/detail?pr=ucpro&fr=pc&pwd_id=...&stoken=...&pdir_fid=...&_page=...&_size=${PAGE_SIZE}&_sort=file_type:asc,updated_at:desc`
- Save: `POST ${DRIVE_BASE}/1/clouddrive/share/sharepage/save?pr=ucpro&fr=pc`  
  body: `{ fid_list, fid_token_list, to_pdir_fid: toPdirFid, pwd_id: shareId, stoken, pdir_fid: "0", scene: "link" }`
- Task: `GET ${DRIVE_BASE}/1/clouddrive/task?pr=ucpro&fr=pc&task_id=...`  
  `status===2` → `save_as.save_as_top_fids`；`status===3` → 抛「转存失败，云端空间满或触发风控」
- Download: `POST ${DRIVE_BASE}/1/clouddrive/file/download?pr=ucpro&fr=pc` `{ fids }`  
  `code===23018` → 风控提示
- Delete: `POST ${DRIVE_BASE}/1/clouddrive/file/delete?pr=ucpro&fr=pc` `{ action_type: 2, filelist: fids, exclude_fids: [] }`
- Member: `GET ${DRIVE_BASE}/1/clouddrive/member?pr=ucpro&fr=pc&fetch_subscribe=true&fetch_identity=true` → `total_capacity - use_capacity`
- List: `GET ${DRIVE_BASE}/1/clouddrive/file/sort?pr=ucpro&fr=pc&pdir_fid=0&_page=1&_size=100&_sort=file_type:asc,file_name:asc`（实现时以抓包字段为准，按 `file_name===TEMP_FOLDER_NAME` 且 `dir` 匹配）
- Create folder: `POST ${DRIVE_BASE}/1/clouddrive/file?pr=ucpro&fr=pc` body 使用夸克创建目录惯例：`{ pdir_fid, file_name: TEMP_FOLDER_NAME, dir: true }` 或等价字段；以实际成功响应中的 `fid` 为准

`ensureGopeedTempFid`：

```js
export async function ensureGopeedTempFid() {
  const list = await apiListDir('0');
  const found = (list || []).find(
    (it) => it.dir && it.file_name === TEMP_FOLDER_NAME,
  );
  if (found) return found.fid;
  return apiCreateFolder('0', TEMP_FOLDER_NAME);
}
```

- [ ] **Step 2: 构建**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: Commit**

```bash
git add src/quark/api.js
git commit -m "feat: wrap quark share, transfer, and folder APIs"
```

---

### Task 6: 递归列目录

**Files:**
- Create: `src/quark/walk.js`
- Create: `tests/walk.test.js`

**Interfaces:**
- Consumes: `apiGetDetailPage`（测试时注入 mock）
- Produces:
  - `collectShareFiles({ shareId, stoken, pdirFid, maxCount, fetchPage }) → Array<{ fid, share_fid_token, file_name, size, path, dir }>`  
    其中文件项 `path` 为父相对路径（不含文件名）；文件夹递归进入

为可测，将分页拉取做成可注入：

```js
export async function collectShareFiles(options) {
  const {
    shareId,
    stoken,
    pdirFid = '',
    maxCount = 0,
    fetchPage,
  } = options;
  // fetchPage(shareId, stoken, pdirFid, page) → { list }
}
```

生产路径默认 `fetchPage = apiGetDetailPage` 的适配包装。

- [ ] **Step 1: 写失败测试（内存 mock 树）**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectShareFiles } from '../src/quark/walk.js';

test('递归收集并保留 path', async () => {
  const pages = {
    '': [{ fid: 'd1', file_name: 'sub', dir: true }, { fid: 'f1', file_name: 'a.txt', size: 1, dir: false, share_fid_token: 't1' }],
    d1: [{ fid: 'f2', file_name: 'b.txt', size: 2, dir: false, share_fid_token: 't2' }],
  };
  async function fetchPage(_s, _t, pdir) {
    return { list: pages[pdir || ''] || [] };
  }
  const files = await collectShareFiles({
    shareId: 's',
    stoken: 'st',
    pdirFid: '',
    maxCount: 0,
    fetchPage,
  });
  assert.equal(files.length, 2);
  assert.equal(files.find((f) => f.file_name === 'a.txt').path, '');
  assert.equal(files.find((f) => f.file_name === 'b.txt').path, 'sub');
});

test('maxCount 截断', async () => {
  async function fetchPage() {
    return {
      list: [
        { fid: '1', file_name: 'a', size: 1, dir: false, share_fid_token: 't' },
        { fid: '2', file_name: 'b', size: 1, dir: false, share_fid_token: 't' },
      ],
    };
  }
  const files = await collectShareFiles({
    shareId: 's',
    stoken: 'st',
    maxCount: 1,
    fetchPage,
  });
  assert.equal(files.length, 1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/walk.test.js`
Expected: FAIL

- [ ] **Step 3: 实现 walk（含分页循环 `_count < PAGE_SIZE` 结束）**

伪实现要点：对每个目录 `page=1..` 调 `fetchPage`；文件 push；目录则 `collectShareFiles` 子调用，`parentPath = join(parent, folderName)`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/walk.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/quark/walk.js tests/walk.test.js
git commit -m "feat: recursively list quark share files with paths"
```

---

### Task 7: 智能分批转存 / 取链 / 删除

**Files:**
- Create: `src/quark/transfer.js`
- Create: `tests/transfer.test.js`

**Interfaces:**
- Consumes: `apiSaveFiles`, `apiPollTask`, `apiGetDownloadLinks`, `apiDeleteFiles`, `ensureGopeedTempFid`, constants
- Produces:
  - `buildChunks(files, availableSpace, shouldDelete): { chunks, skippedCount }`（纯函数）
  - `processSmartChunks({ shareId, stoken, files, availableSpace, shouldDelete }): { finalParsedFiles, skippedCount }`  
    每项 `finalParsedFiles`：`{ name, size, path, url, savedFid, shareFid, shareFidToken }`

分批规则（写进测试）：

- `availableSpace === -1`：不按字节切，按 `DEFAULT_CHUNK_FILE_COUNT` 切批
- `availableSpace >= 0`：`maxChunkSize = max(0, availableSpace - SAFE_BUFFER_BYTES)`；单文件 `size > maxChunkSize` 计入 skipped
- `shouldDelete === false` 且累计将超过 `maxChunkSize`：后续文件 skipped
- `shouldDelete === true`：可多批轮转，每批体积不超过 `maxChunkSize`

匹配直链：优先 `file_name`+`size`，回退 size，再回退顺序占位。

- [ ] **Step 1: 写 `buildChunks` 测试**

签名：

```js
export function buildChunks(
  files,
  availableSpace,
  shouldDelete,
  bufferBytes = SAFE_BUFFER_BYTES,
  defaultCount = DEFAULT_CHUNK_FILE_COUNT,
)
```

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChunks } from '../src/quark/transfer.js';

test('跳过超过 maxChunkSize 的文件，其余按体积分批', () => {
  const files = [
    { fid: '1', file_name: 'big', size: 160, share_fid_token: 't' },
    { fid: '2', file_name: 'a', size: 10, share_fid_token: 't' },
    { fid: '3', file_name: 'b', size: 20, share_fid_token: 't' },
    { fid: '4', file_name: 'c', size: 140, share_fid_token: 't' },
  ];
  // available=200, buffer=50 → maxChunkSize=150
  const { chunks, skippedCount } = buildChunks(files, 200, true, 50, 50);
  assert.equal(skippedCount, 1);
  assert.equal(chunks.length, 2);
  assert.deepEqual(
    chunks[0].map((f) => f.fid),
    ['2', '3'],
  );
  assert.deepEqual(
    chunks[1].map((f) => f.fid),
    ['4'],
  );
});

test('容量未知时按 defaultCount 切批', () => {
  const files = Array.from({ length: 5 }, (_, i) => ({
    fid: String(i),
    file_name: `f${i}`,
    size: 1,
    share_fid_token: 't',
  }));
  const { chunks, skippedCount } = buildChunks(files, -1, true, 50, 2);
  assert.equal(skippedCount, 0);
  assert.equal(chunks.length, 3);
});
```

- [ ] **Step 2: 实现 `buildChunks` + `processSmartChunks`**

`processSmartChunks` 伪代码：

```js
export async function processSmartChunks(opts) {
  const { shareId, stoken, files, availableSpace, shouldDelete } = opts;
  const toPdirFid = await ensureGopeedTempFid();
  const { chunks, skippedCount } = buildChunks(files, availableSpace, shouldDelete);
  if (chunks.length === 0) {
    throw new Error(
      availableSpace >= 0
        ? `网盘空间不足（可用约 ${(availableSpace / 1073741824).toFixed(2)}GB），无法转存`
        : '没有可转存的文件',
    );
  }
  const finalParsedFiles = [];
  for (const chunk of chunks) {
    try {
      const taskId = await apiSaveFiles(
        shareId,
        stoken,
        chunk.map((f) => f.fid),
        chunk.map((f) => f.share_fid_token || f.fid_token),
        toPdirFid,
      );
      const savedFids = await apiPollTask(taskId, chunk.length);
      const links = await apiGetDownloadLinks(savedFids);
      // 匹配 push 到 finalParsedFiles，带 shareFid/shareFidToken/savedFid
      if (shouldDelete) await apiDeleteFiles(savedFids);
    } catch (e) {
      gopeed.logger.error(`批次失败：${e.message}`);
      // 若有 savedFids 尽量删除
    }
  }
  return { finalParsedFiles, skippedCount };
}
```

- [ ] **Step 3: 跑纯函数测试**

Run: `node --test tests/transfer.test.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/quark/transfer.js tests/transfer.test.js
git commit -m "feat: batch transfer to GopeedTemp and fetch download links"
```

---

### Task 8: `onResolve` / `onStart` 编排与 manifest

**Files:**
- Create: `src/quark/resolve.js`
- Create: `src/quark/start.js`
- Create: `manifest.json`
- Modify: `src/index.js`

**Interfaces:**
- Consumes: 前述全部模块
- Produces:
  - `handleResolve(ctx) → void`（写 `ctx.res`）
  - `handleStart(ctx) → void`（可能改 `ctx.task.meta.req.url`）
  - `manifest.json` 设置项：`cookie` / `delete_file` / `max_file_count`

- [ ] **Step 1: 实现 `resolve.js`**

流程按 spec 4.1：校验 Cookie → `parseShareUrl` → `apiGetToken` → `collectShareFiles` → `apiGetAvailableSpace` → `processSmartChunks` → 组装：

```js
ctx.res = {
  name: title,
  files: finalParsedFiles.map((item) => ({
    name: item.name,
    size: item.size,
    path: item.path || '',
    req: {
      url: item.url,
      labels: {
        [EXTENSION_LABEL]: '1',
        shareId,
        stoken,
        shareFid: item.shareFid,
        shareFidToken: item.shareFidToken,
        fid: item.savedFid || '',
      },
      extra: {
        header: {
          'User-Agent': USER_AGENT,
          Cookie: getEffectiveCookie(),
          Referer: `${PAN_ORIGIN}/`,
        },
      },
    },
  })),
};
```

错误用 `throw new Error(message)` 或 Gopeed `MessageError`（若全局可用则优先）。

- [ ] **Step 2: 实现 `start.js`**

```js
export async function handleStart(ctx) {
  const req = ctx.task.meta.req;
  const labels = req.labels || {};
  const expired = await isDownloadUrlExpired(req.url, req.extra?.header || {});
  if (!expired) return;

  // 1) 若 labels.fid 存在，尝试 apiGetDownloadLinks([fid])
  // 2) 失败则 apiSaveFiles 单文件到 GopeedTemp → poll → download → 按 settings.delete_file 删除 → 更新 req.url 与 labels.fid
}
```

`isDownloadUrlExpired`：解析 query `Expires`（秒）；未过期则 `Range: bytes=0-0` 探活；异常或非 2xx/3xx 视为过期。

- [ ] **Step 3: 写 `manifest.json` 与 `src/index.js`**

```json
{
  "name": "gopeed-extension-quark",
  "author": "Gwkang",
  "title": "夸克网盘下载",
  "description": "解析夸克网盘分享链接并下载，支持目录递归与转存清理。建议下载连接数 256。",
  "icon": "icon.png",
  "version": "1.0.0",
  "homepage": "https://github.com/igwkang/gopeed-extension-quark",
  "repository": {
    "url": "https://github.com/igwkang/gopeed-extension-quark"
  },
  "scripts": [
    {
      "event": "onResolve",
      "match": {
        "urls": ["*://pan.quark.cn/s/*", "*://drive.quark.cn/s/*"]
      },
      "entry": "dist/index.js"
    },
    {
      "event": "onStart",
      "match": {
        "labels": ["Gwkang@gopeed-extension-quark"]
      },
      "entry": "dist/index.js"
    }
  ],
  "settings": [
    {
      "name": "cookie",
      "title": "夸克 Cookie",
      "description": "浏览器登录 pan.quark.cn 后，从 list 请求头复制 Cookie（需包含 __puus）填入。",
      "type": "string",
      "value": ""
    },
    {
      "name": "delete_file",
      "title": "解析完毕后释放网盘空间",
      "description": "提取直链后自动删除 GopeedTemp 中的本次转存文件。",
      "type": "string",
      "value": "1",
      "options": [
        { "label": "开启（默认）", "value": "1" },
        { "label": "关闭", "value": "0" }
      ]
    },
    {
      "name": "max_file_count",
      "title": "最大解析文件数量",
      "description": "限制解析文件数量，0 表示不限制。",
      "type": "number",
      "value": "500"
    }
  ]
}
```

```js
import { handleResolve } from './quark/resolve.js';
import { handleStart } from './quark/start.js';

gopeed.events.onResolve(async (ctx) => {
  await handleResolve(ctx);
});

gopeed.events.onStart(async (ctx) => {
  await handleStart(ctx);
});
```

注意：Gopeed 的 `labels` 匹配通常要求 label **键名**为 `Gwkang@gopeed-extension-quark`。若实测需值匹配，按 Gopeed 文档调整为社区常用写法（键值均可被 match 的形式）。

- [ ] **Step 4: 全量测试 + 构建**

Run: `npm test`
Expected: 全部 PASS  
Run: `npm run build`
Expected: `dist/index.js` 更新

- [ ] **Step 5: Commit**

```bash
git add src/index.js src/quark/resolve.js src/quark/start.js manifest.json dist/index.js
git commit -m "feat: wire onResolve and onStart for quark downloads"
```

---

### Task 9: README、图标与手工验收清单

**Files:**
- Create: `README.md`
- Create: `LICENSE`（MIT，可从 gofile 仓库复制年份与作者后调整）
- Create: `icon.png`（可用简单夸克色块图标或从设计资源生成；勿使用未授权商标素材的高仿 logo）

**Interfaces:**
- Consumes: 已可安装扩展
- Produces: 用户文档

- [ ] **Step 1: 写 README（中文）**

必须包含：从 Git 安装、本地开发安装（连点 5 次开发者模式）、Cookie 获取步骤、链接示例（含 `?pwd=`）、`GopeedTemp`/删除说明、建议连接数 256、日志路径 `logs/extension.log`。

- [ ] **Step 2: 手工验收（真实环境）**

在 Gopeed 中安装本地扩展并验证：

1. 无提取码分享：递归下载，`path` 正确  
2. `?pwd=` 正确/错误/缺失  
3. 默认删除开启：转存被清  
4. 删除关闭：`onStart` 能用 `fid` 刷新  
5. Cookie 空 / 无 `__puus`：中文报错

- [ ] **Step 3: Commit**

```bash
git add README.md LICENSE icon.png dist/index.js
git commit -m "docs: add quark extension README and package assets"
```

---

## Spec Coverage Checklist

| Spec 要求 | Task |
| --- | --- |
| Cookie 设置鉴权 | 3, 8 |
| `__puus` 自动续期 | 3, 4 |
| `shareId` / `passcode` 命名与 URL 提取码 | 2, 5 |
| 递归 + `path` | 6, 8 |
| `GopeedTemp` | 5, 7 |
| 分批 + 边存边删 + 100MB 余量 | 7 |
| 容量失败降级 | 7（`-1` → 按文件数切批） |
| `onStart` 刷新 / 重转存 | 8 |
| 设置项三件套 | 8 |
| 中文文案 / README / dist 提交 | 1, 8, 9 |
| 错误场景提示 | 5, 8 |

## Self-Review Notes

- 已消除「实现时再定」类占位；创建目录 API 字段若与抓包不一致，仅允许在 Task 5 内按实际响应微调字段名，不改变 `ensureGopeedTempFid` 对外行为。
- `labels` 匹配键名以 Gopeed 运行时为准，Task 8 含验证说明。
- 纯函数可单测；真实 Cookie 流程留在 Task 9 手工验收（符合 spec 不做线上自动化）。
