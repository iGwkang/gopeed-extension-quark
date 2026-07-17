## Learned User Preferences

- 夸克鉴权采用扩展设置里粘贴 Cookie（从浏览器复制），不要求第一版做扫码或本地自动抓取。
- 提取码仅从分享链接解析（如 `?pwd=`），不要提供全局默认提取码设置项。
- 下载路径优先「转存到自己网盘 → 取直链 → 删除转存」以节约空间；临时目录固定用网盘根下 `GopeedTemp`。
- 本地保存保留相对目录结构（递归展开并用 `path`），不要拍平成单层文件名；单根文件夹应 unwrap，且任务名与 `path` 首层相同时剥离冗余前缀，避免双层同名目录。
- 第一版按社区完整能力做：按可用空间分批转存、边存边取边删、`onStart` 直链刷新、响应里自动续期 `__puus`。
- 面向用户的文案（manifest、README、设置项描述、错误提示）优先使用中文。
- URL 路径 `/s/{id}` 中的 id 是分享链接 ID，应命名为 `shareId`；提取码单独叫 `passcode`。接口请求体若仍用 `pwd_id` 字段名，勿在代码/文档里把它当成提取码。
- 解析失败时只应弹出提示，不要进入创建任务/下载页；用户可见错误须抛 `MessageError`（勿用普通 `Error`）。

## Learned Workspace Facts

- 本仓库是新建的 Gopeed 扩展，目标是解析并下载夸克网盘分享链接（`pan.quark.cn/s/*`、`drive.quark.cn/s/*`），支持目录递归。
- 工程骨架与模块划分对齐参考仓库 `D:\work\project\gopeed-extension-gofile`（webpack、`onResolve`/`onStart`、`src/<provider>/*` 拆分）；能力对齐社区夸克扩展（如分批转存与直链刷新）。
- 解析主流程：校验 Cookie → 取 `stoken` → 递归列目录 → 转存到 `GopeedTemp` → 取直链 →（默认）删除转存 → 回传文件列表；`onStart` 负责直链过期刷新。
- 通过 Git 安装时需提交构建产物 `dist/index.js`，因为 Gopeed 安装扩展时不会执行 `npm install`。
- Gopeed 从 Git 更新扩展时以 `manifest.json` 的 `version` 为准；推送修复后须递增该版本，否则客户端认为无更新。
- `onResolve` 抛普通 `Error` 时，Gopeed 可能把分享 URL 当普通文件并落到创建任务页；`MessageError` 才会只弹提示并中止。
- 远程仓库为 `https://github.com/iGwkang/gopeed-extension-quark`。
