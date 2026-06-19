---
name: backup-restore
description: 换电脑后如何一键恢复整个逆向工作环境（MCP + Skills + Memory）
metadata:
  type: project
---

**备份 = git push。恢复 = git clone + bash .claude/install-mcp.sh**

**Why:** 用户不希望每次换电脑手动重装 MCP 和 Skills。类比 `uv.lock`——追踪声明文件，排除安装产物，一条命令恢复。

**How to apply:**
- 换电脑前：`git push`（源文件已在仓库中）
- 换电脑后：`git clone <repo> && bash .claude/install-mcp.sh`
- 需要代理时：`USE_PROXY=1 bash .claude/install-mcp.sh`

## 设计原则

参照 `uv.lock` / `package-lock.json` 模式：
- **追踪声明文件**（git）— `.mcp.json`、`package.json`、`pyproject.toml`、`SKILL.md`
- **排除安装产物**（`.gitignore`）— `node_modules/`、`.venv/`、克隆的源码
- **一条命令恢复**（`install-mcp.sh`）— 重装所有依赖

## 追踪清单（git push 即备份）

| 内容 | 路径 | 说明 |
|------|------|------|
| MCP 配置 | `.mcp.json` | 两个 MCP 服务器的启动参数 |
| MCP: js-reverse 声明 | `.claude/mcp-servers/js-reverse-mcp/package.json` | npm 依赖声明 |
| Memory 全量 | `.claude/memory/**/*.md` | 所有项目经验和约定 |
| Skill: wasm-reverse | `.claude/skills/wasm-reverse/` | 无嵌套 .git，直接被 git 追踪 |
| 恢复脚本 | `.claude/install-mcp.sh` | 一键安装 MCP + Skills |
| 权限配置 | `.claude/settings.json` / `settings.local.json` | MCP 工具权限 |
| 排除规则 | `.gitignore` | 确保不提交安装产物 |

## 恢复清单（install-mcp.sh 执行）

| 内容 | 方式 |
|------|------|
| camoufox-reverse-mcp | `git clone` + `pip install -e` |
| js-reverse-mcp | `npm install`（从 package-lock.json） |
| hello_js_reverse_skill | `git clone` |
| Python venv | `python -m venv` |

## 自动备份（git push 自动化）

每次 `git commit` 后自动 `git push`。

**原理**: `.githooks/post-commit` → 后台异步 git push，不阻塞提交，网络异常也不影响本地工作。

**换机后启用**: `install-mcp.sh` 已包含 `git config core.hooksPath .githooks`，自动生效。

**手动启用**（如未运行 install 脚本）:
```bash
git config core.hooksPath .githooks
```

国内需先配代理才能推送:
```bash
git config http.proxy http://127.0.0.1:10808
git config https.proxy http://127.0.0.1:10808
```

## 为什么这样设计

- `camoufox-reverse-mcp` 不在 PyPI 上，必须 git clone
- `hello_js_reverse_skill` 有嵌套 `.git`，git 不能作为普通文件追踪，只能 install 脚本克隆
- `wasm-reverse` 是手动放置的文件（无嵌套 .git），直接 git 追踪即可
- `node_modules/` 和 `.venv/` 体积巨大（数百 MB），不可提交
