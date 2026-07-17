# 夸克网盘分享下载扩展 — 设计说明

日期：2026-07-17  
仓库：`gopeed-extension-quark`  
参考：`gopeed-extension-gofile`（工程骨架）、社区夸克 Gopeed 扩展（完整能力）

## 1. 目标

在空仓库中实现 Gopeed 扩展：解析夸克网盘分享链接，递归列出目录，转存后取直链交给 Gopeed 下载，并默认清理转存以节约空间。

### 1.1 范围内

- 链接：`*://pan.quark.cn/s/*`、`*://drive.quark.cn/s/*`
- 提取码：仅从 URL 查询参数（如 `?pwd=`）读取，无全局默认提取码
- 鉴权：扩展设置粘贴 Cookie；运行期自动合并响应中的 `__puus`
- 递归列目录；本地用 `path` 保留相对目录结构
- 转存目标：网盘根目录下固定文件夹 `GopeedTemp`（不存在则创建）
- 按可用空间智能分批转存；默认取直链后删除本批转存
- 事件：`onResolve`（解析）+ `onStart`（直链过期刷新；必要时单文件重转存）

### 1.2 范围外（第一版不做）

- UC 网盘
- 扫码登录 / 自动抓取 Cookie
- 全局默认提取码设置
- 针对真实夸克接口的自动化测试套件

## 2. 术语

| 名称 | 含义 |
| --- | --- |
| `shareId` | 分享链接路径中的 ID（`/s/{shareId}`）。**不是**提取码 |
| `passcode` | 提取码，仅来自 URL（如 `?pwd=`） |
| `stoken` | 分享访问令牌（由 token 接口返回） |
| `GopeedTemp` | 网盘根下固定临时转存目录名 |

说明：夸克官方接口请求体可能仍使用字段名 `pwd_id` 表示分享 ID。代码与文档对外统一使用 `shareId`；仅在构造 API 请求时映射为接口要求的字段名，禁止把 `pwd_id` 当作提取码。

## 3. 架构

```text
Gopeed
  ├─ onResolve  → 解析分享 → 递归文件列表 → 分批转存/取链/清理 → ctx.res.files
  └─ onStart    → 检查直链 → 过期则按 labels 重取（必要时重转存）→ 更新 req.url
```

### 3.1 模块划分

| 模块 | 职责 |
| --- | --- |
| `src/index.js` | 注册 `onResolve` / `onStart` |
| `src/quark/url.js` | 解析 `shareId`、`passcode`、可选 hash 子目录入口 |
| `src/quark/cookie.js` | Cookie 读取、校验、`__puus` 合并与持久化 |
| `src/quark/net.js` | API 请求封装、重试、中文网络错误 |
| `src/quark/api.js` | token / detail / save / task / download / delete / capacity / mkdir |
| `src/quark/walk.js` | 分页 + 递归收集分享文件 |
| `src/quark/transfer.js` | 确保 `GopeedTemp`、智能分批、边存边取边删 |
| `src/quark/resolve.js` | 编排 `onResolve` 主流程 |
| `src/quark/start.js` | 编排 `onStart` 直链刷新 |
| `src/quark/constants.js` | API 基址、UA、临时目录名、存储键等 |

工程形态对齐 `gopeed-extension-gofile`：webpack + babel + `gopeed-polyfill-webpack-plugin`；入口产物为 `dist/index.js`（Git 安装必须提交该文件）。面向用户文案默认中文。

### 3.2 Manifest 要点

- `onResolve.match.urls`：夸克分享 URL 模式
- `onStart.match.labels`：扩展标识（与 `manifest.name` / author 组合一致，例如 `Gwkang@gopeed-extension-quark`），与文件 `req.labels` 一致
- 设置项见第 5 节

## 4. 数据流

### 4.1 `onResolve`

1. 校验 Cookie（缺失或明显缺少 `__puus` 时给出可操作的中文提示）
2. 从链接解析 `shareId`；`passcode` 仅来自 URL（无则空字符串）
3. 调用分享 token 接口 → `stoken` + 分享标题
4. 若 URL hash 指向子目录，则从该目录起递归；否则从根递归
5. 分页列出并递归子文件夹；遵守 `max_file_count`（`0` 表示不限制）
6. 查询网盘可用容量
7. 确保根下存在 `GopeedTemp`
8. 智能分批处理（见 4.3）
9. 组装 `ctx.res`：
   - `name`：分享标题（回退到 `shareId`）
   - `files[]`：`name` / `path` / `size` / `req`（含 url、header、labels）

### 4.2 `onStart`

每个文件 `req.labels` 至少携带：

- 扩展匹配用 label
- `shareId`、`stoken`
- 分享侧文件标识（如 `shareFid` / `shareFidToken`）
- 转存后 `fid`（未删除时可直接重取链）

流程：

1. 探活当前直链；未过期则直接开始
2. 过期且本地 `fid` 仍可用 → 调用下载接口重取
3. 若已删除或重取失败 → 单文件重转存到 `GopeedTemp` → 取新链 → 按设置删除转存 → 更新 `req.url`

### 4.3 智能分批与清理

- 以「可用空间 − 安全余量」为单批体积上限；安全余量默认 `100MB`（实现常量，可按实测微调）
- 单文件大于上限：跳过并记警告日志，不中止整次解析（若全部被跳过则报错）
- 查询容量失败时：不启用按空间切批（视为空间未知），仍按合理默认批大小（如按文件个数上限）转存；删除策略不变
- 可用空间已知且无法容纳任意一个待处理文件：中止并提示空间不足
- 每批：`save` → 轮询任务 → `download` 取直链 →（`delete_file` 开启时）删除本批转存 fid
- `GopeedTemp` 文件夹本身保留；只删除本次转存产生的内容

关闭删除时：转存文件保留在 `GopeedTemp`，`onStart` 可优先用 `fid` 重取链。

## 5. 设置项

| name | 标题 | 说明 | 默认 |
| --- | --- | --- | --- |
| `cookie` | 夸克 Cookie | 浏览器登录 `pan.quark.cn` 后，从 list 类请求头复制；需包含 `__puus` | 空 |
| `delete_file` | 解析完毕后释放网盘空间 | 取直链后是否删除转存 | 开启（`"1"`） |
| `max_file_count` | 最大解析文件数量 | `0` 表示不限制 | `500` |

Cookie 运行期策略：设置项为基底；`gopeed.storage` 保存最新 `__puus`；后续请求用存储值覆盖 Cookie 中的 `__puus`。

## 6. 链接形态

- `https://pan.quark.cn/s/{shareId}`
- `https://pan.quark.cn/s/{shareId}?pwd={passcode}`
- `https://drive.quark.cn/s/{shareId}`（及带 `pwd` 变体）
- 可选 hash 子目录入口（与社区扩展行为对齐，实现时按官方前端 hash 格式解析）

## 7. 错误处理

| 场景 | 行为 |
| --- | --- |
| 未配置 Cookie / 缺少 `__puus` | 解析前失败，说明如何从浏览器复制 |
| Cookie 失效 | 提示重新抓取 Cookie |
| 分享不存在 / 过期 / 取消 | 明确提示链接无效 |
| 需要提取码但 URL 无 `pwd` | 提示在链接附加 `?pwd=` |
| 提取码错误 | 提示检查提取码 |
| 空间不足（连单文件都无法转存） | 中止并提示 |
| 过大文件被跳过 | 日志警告；若结果为空则报错 |
| 转存/任务轮询超时 | 有限重试后失败；尽量清理已转存 fid |
| 某批取链失败 | 尽量删除该批转存；已成功批次仍可返回 |
| `onStart` 刷新最终失败 | 抛出可见错误 |

网络层：有限次重试 + 退避；每次响应尝试更新 `__puus`。

## 8. 验收标准

1. 无提取码分享：可递归解析并下载，本地目录结构正确
2. 带 `?pwd=` 分享：正确可下；错误/缺失有清晰中文报错
3. 嵌套目录：`path` 保留相对路径
4. 默认开启删除：解析后本次转存从 `GopeedTemp` 清理（目录可保留）
5. 关闭删除：转存保留，且 `onStart` 可用 `fid` 重取链
6. 大分享 + 空间有限：按容量分批「边存边取边删」
7. `__puus` 更新后后续请求使用新值
8. `npm run build` 产出可安装的 `dist/index.js`；README 含安装、Cookie、建议连接数（如 256）

实现阶段以 Gopeed 开发者模式 + 真实 Cookie/测试分享做手工验收；第一版不强制自动化对接夸克线上接口。

## 9. 实现约束

- 不提交或记录用户 Cookie / 提取码等秘密到仓库或日志明文长期存储（运行期 storage 仅存必要的 `__puus` 片段）
- API 细节以实现时对照夸克前端/社区可复现请求为准；本设计固定产品行为与模块边界，不锁定易变的 URL 查询串细节
- 作者/仓库 URL 以实际发布信息写入 `manifest.json`（实现时填充）
