# Final whole-branch review fixes

## 2026-07-17 Important findings

- Cookie：`gopeed.settings.cookie` 始终作为基底；存储仅保留并覆盖 `__puus`，同时兼容读取旧的完整 Cookie 存储值。
- 直链匹配：删除无条件位置兜底，仅保留“文件名 + 大小”和“大小”匹配；无法可靠匹配的文件跳过并由现有日志报告。
- 回归测试：新增设置 Cookie 不被存储遮蔽、仅持久化 `__puus`、不按位置错配直链的覆盖。

### 验证

命令：`npm test`

输出摘要：

```text
tests 31
pass 31
fail 0
duration_ms 293.8274
```

命令：`npm run build`

输出摘要：

```text
asset index.js 91.3 KiB [emitted] [minimized] (name: main)
webpack 5.108.4 compiled successfully in 1456 ms
```

两条命令均以退出码 `0` 完成。npm 输出了一条现有环境配置警告：`Unknown env config "devdir"`。
