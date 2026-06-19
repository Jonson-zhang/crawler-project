# 通用经验

> 领域专用 memory 在子目录下，不会自动加载到每次会话。做特定领域逆向时，Agent 检测到关键词后主动读对应子索引：
> - WASM → `memory/wasm/MEMORY.md`
> - （未来：`js/` `android/` …）

- [Crawler 项目约定](crawler-conventions.md) — 工具链、代码组织、输出方式的默认约定
- [换电脑恢复流程](backup-restore.md) — git push 即备份，bash install-mcp.sh 即恢复
