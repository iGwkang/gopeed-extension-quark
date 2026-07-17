# Gopeed 扩展 — 夸克网盘下载

将夸克网盘分享链接粘贴到 Gopeed，扩展会递归解析目录、临时转存文件并获取下载直链，同时用 `path` 保留原有目录结构。

支持：

- `pan.quark.cn/s/*` 和 `drive.quark.cn/s/*` 分享链接
- URL 中的提取码（`?pwd=`）
- 目录递归与相对路径保留
- 按网盘可用空间分批转存
- 下载直链过期后自动刷新

## 安装

### 从 Git 安装（推荐）

1. 打开 Gopeed → **扩展**。
2. 粘贴以下仓库地址并安装：

```text
https://github.com/igwkang/gopeed-extension-quark
```

通过 Git 安装时，Gopeed 不会执行 `npm install`；仓库已提交构建产物 `dist/index.js`。

### 本地开发安装

1. 安装依赖并构建：

```bash
npm install
npm run build
```

2. 在 Gopeed 的 **扩展**页连续点击 **安装** 按钮 **5 次**，开启开发者模式。
3. 选择本项目根目录（包含 `manifest.json` 的文件夹）。
4. 开发时可运行 `npm run dev` 监听源码并重新构建。

## 配置 Cookie

扩展需要使用你自己的夸克网盘 Cookie 完成转存和取直链，不支持扫码登录或自动抓取 Cookie。

1. 在浏览器中登录 [夸克网盘](https://pan.quark.cn/)。
2. 按 `F12` 打开开发者工具，切换到 **网络（Network）**。
3. 刷新网盘页面，在请求列表中选择名称含 `list` 或 `sort` 的网盘文件列表请求。
4. 在 **请求标头（Request Headers）** 中复制完整的 `Cookie` 值，确认其中包含 `__puus=`。
5. 打开 Gopeed → **扩展** → **夸克网盘下载** → **设置**，将其粘贴到“夸克 Cookie”并保存。

Cookie 等同于登录凭据，请勿发送给他人、写入日志或提交到仓库。Cookie 失效时请重新复制；接口响应中的新 `__puus` 会由扩展自动续期使用。

## 使用方法

在 Gopeed 中用分享链接新建下载任务（不要选择“直接下载”），例如：

```text
https://pan.quark.cn/s/abcdef123456
https://pan.quark.cn/s/abcdef123456?pwd=7x9k
https://drive.quark.cn/s/abcdef123456?pwd=7x9k
```

提取码只从链接的 `?pwd=` 参数读取。需要提取码的分享若没有该参数，请在链接末尾补充 `?pwd=提取码`。

建议在 Gopeed 的任务设置中将**连接数设为 256**，以改善夸克直链的下载速度；实际速度仍取决于网络和账号限制。

## 临时转存与清理

解析时，扩展会把分享文件分批转存到你网盘根目录下的 `GopeedTemp`，取得直链后再交给 Gopeed 下载。

- 默认开启“解析完毕后释放网盘空间”：每批取得直链后删除本次转存的文件，但保留 `GopeedTemp` 文件夹。
- 关闭该设置：转存文件会保留在 `GopeedTemp`；直链过期时，`onStart` 会优先使用保留的文件 ID 刷新直链。
- 删除开启时若直链过期，扩展会按需重新转存单个文件、刷新直链并再次清理。

请勿依赖 `GopeedTemp` 存放重要文件。

## 调试

日志位于 Gopeed 安装目录下的：

```text
logs/extension.log
```

开发者模式安装时可获得更完整的调试日志。真实账号验收步骤见 [`docs/manual-acceptance.md`](docs/manual-acceptance.md)。

## 开发命令

- `npm run build`：构建 `dist/index.js`
- `npm run dev`：监听文件变化并重新构建
- `npm test`：运行自动化测试

## 许可证

MIT
