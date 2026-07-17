# Task 5 实施报告：夸克 API 封装

## 状态

已完成 `src/quark/api.js`，实现任务简报要求的全部 10 个导出函数：

- 分享 token、分页详情
- 转存、任务轮询、下载直链
- 删除临时文件、查询可用容量
- 目录列表、创建目录、确保 `GopeedTemp`

JS 对外参数统一使用 `shareId`，仅在夸克接口查询参数和请求体中映射为 `pwd_id`。错误处理已覆盖简报指定的 `31001`、`31002`、`23018`，以及转存失败、轮询超时和响应缺少关键字段等场景。

## 验证

- `npm run build`：成功，webpack 5.108.4 编译完成。
- `npm test`：成功，7/7 测试通过。
- `node -e "import('./src/quark/api.js')..."`：成功，模块可正常导入。
- IDE lint：无错误。
- 自审：逐项核对简报中的函数签名、端点、请求字段、返回值和中文错误信息，未发现阻塞问题。

## 提交

- `b4bdae9 feat: wrap quark share, transfer, and folder APIs`

提交仅包含 `src/quark/api.js`；工作区中其他任务遗留文件未纳入提交。

## 接口假设与关注点

- 目录列表采用 `GET /1/clouddrive/file/sort`，读取 `data.list`，固定单页 100 条；当前仅用于根目录寻找 `GopeedTemp`。
- 创建目录采用 `POST /1/clouddrive/file`，请求体为 `{ pdir_fid, file_name, dir: true }`；响应兼容 `data.fid` 和 `data.file.fid`。
- 分享详情总数优先读取 `data.metadata._total`，并兼容 `data.total`；下载响应兼容 `data` 数组和 `data.list`。
- 任务轮询间隔为 1 秒，最少 15 次，并按文件数量增加次数。接口字段若被夸克前端调整，需用真实 Cookie 抓包复核目录创建和任务响应结构。
- 第一版设计明确不强制真实夸克接口自动化测试；本次未连接线上账号，未进行真实转存/删除验证。

## 评审修复

- API 成功响应现在严格要求 `body.code === 0`，缺少 `code` 不再视为成功，错误提示保持中文。
- 新增 `createQuarkApi(request)` 轻量依赖注入入口，生产环境原有导出函数及调用方式保持不变。
- 新增聚焦单元测试，覆盖分享 token 参数映射、`31001`/`31002`、转存成功/失败、临时目录查找/创建和缺少 `code` 的响应。
- 转存任务在 `fileCount > 0` 但 `save_as_top_fids` 为空时抛出明确中文错误。
- `npm test`：成功，17/17 测试通过。
- `npm run build`：成功，webpack 5.108.4 编译完成。
