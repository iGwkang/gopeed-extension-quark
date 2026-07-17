# Task 4 Report: 网络层（superagent + 重试）

## Status

**DONE**

## What Was Implemented

按 task brief 新增夸克 API HTTP 客户端：

| 文件 | 职责 |
|------|------|
| `src/quark/net.js` | `quarkRequest`：superagent 封装、Cookie 校验、__puus 刷新、有限重试、中文错误 |

### `quarkRequest(url, method, data?)`

- 请求前 `assertCookieConfigured(getEffectiveCookie())`
- Header：`Cookie`、`User-Agent`、`Referer`、`Origin`、`Content-Type`
- `.ok(() => true)` 手动处理 HTTP status
- 响应 `set-cookie` → `updatePuusFromSetCookie`
- `body.code === 40001 || 10000` → 抛 Cookie 失效（不重试）
- 其它错误 sleep `RETRY_DELAY_MS` 后递归重试至多 `MAX_RETRY` 次
- 最终失败 → `网络请求失败：…`

## Build Results

### npm run build
```
webpack 5.108.4 compiled successfully
Exit code: 0
```

## Files Changed

**新增（已提交）：**
- `src/quark/net.js`

## Commit

- **SHA:** `8d491f4`
- **Subject:** `feat: add quark HTTP client with retry and cookie refresh`
- **Branch:** `feature/quark-share-download`

## Self-Review

### Completeness
- [x] brief 指定接口与实现要点均已覆盖
- [x] 实现与 brief 示例代码一致
- [x] `npm run build` 成功
- [x] 已按 brief 仅提交 `src/quark/net.js`

### Quality / YAGNI
- 无额外抽象；`sleep` 为 brief 内联 helper
- Cookie 失效与网络错误分离，符合设计文档第 7 节
- 每次重试重新读取 Cookie（含可能已刷新的 __puus）

### Concerns
- 未单测 `quarkRequest`（brief 不要求）；依赖 Task 5+ API 层集成验证
- GET 请求仍带 `Content-Type: application/json`（与 brief 一致，夸克接口通常可接受）
- 业务层 API 非 0 `code`（除 40001/10000）未在此层统一处理，留给 `api.js`

## Next Steps (for later tasks)

- Task 5：`api.js` 调用 `quarkRequest` 封装 token / detail / save 等接口
- 集成时验证 __puus 自动续期与 Cookie 失效提示

---

## Review Fix (Task 4)

**Date:** 2026-07-17

### Changes

1. **`src/quark/net.js`** — 先解析 `body` 并检查 `body.code === 40001 || 10000`（Cookie 失效，不重试），再判断 `response.status >= 400`，避免 HTTP 错误掩盖 Cookie 过期业务码。
2. **`src/index.js`** — 导入 `{ quarkRequest }` 并以 `void quarkRequest` 引用，确保 webpack 打包包含 `net.js` 及 superagent 依赖。
3. **`src/quark/net.js`** — 行尾规范为 LF。

### Verification

#### npm run build
```
webpack 5.108.4 compiled successfully
asset index.js 70.4 KiB [emitted] [minimized] (name: main)
modules by path ./node_modules/superagent/lib/*.js 53.9 KiB 5 modules
./src/index.js + 3 modules 5.72 KiB [built] [code generated]
Exit code: 0
dist/index.js size: 72052 bytes (含 superagent)
```

#### npm test
```
✔ 7 tests passed, 0 failed
Exit code: 0
```

### Fix Commit

- **SHA:** `e3e9304`
- **Subject:** `fix: check quark cookie expiry before HTTP status`
- **Branch:** `feature/quark-share-download`
