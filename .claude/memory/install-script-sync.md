---
name: install-script-sync
description: 安装新 MCP/Skill 时必须同步更新 install.config.json 和 .gitignore
metadata:
  type: project
---

当用户要求安装新的 MCP 或 Skill 时，必须同时完成以下步骤，缺一不可：

1. **安装本身**（git clone / npm install / pip install 等）
2. **更新 `.claude/install.config.json`** — 在 `mcpServers[]` 或 `skills[]` 中添加条目（按 type 选择：`python-git` / `npm` / `git-clone` / `git-extract`）
3. **更新 `.gitignore`** — 排除安装产物（如 `node_modules/`、`.venv/`、整个 clone 的目录）
4. **如果是新 MCP 且需要 `.mcp.json` 注册**：更新 `.claude/fix-paths.py`，添加对应的 mcpServers 条目

**Why:** `install.config.json` 是 `install-mcp.sh` 和 `install-mcp.ps1` 共同读取的安装清单。新增条目只需改 JSON，脚本本身不用动。`.gitignore` 不更新则会导致安装产物被 GitDoc 同步到 GitHub。

**How to apply:** 安装完成后，立即打开 `install.config.json`、`.gitignore`（和 `fix-paths.py` 如果是新 MCP），对照现有格式添加对应条目。完成后向用户确认"步骤都已完成"。
