---
name: install-script-sync
description: 安装新 MCP/Skill 时必须同步更新 install-mcp.sh 和 .gitignore
metadata:
  type: project
---

当用户要求安装新的 MCP 或 Skill 时，必须同时完成三件事，缺一不可：

1. **安装本身**（git clone / npm install / pip install 等）
2. **更新 `.gitignore`** — 排除安装产物（如 `node_modules/`、`.venv/`、整个 clone 的目录）
3. **更新 `install-mcp.sh`** — 在对应章节加入安装命令，确保换电脑后一键恢复

**Why:** `install-mcp.sh` 是"换电脑后一键恢复"的唯一入口。如果装了东西但没写进脚本，换电脑后 `bash .claude/install-mcp.sh` 会漏装，导致 MCP/Skill 缺失。`.gitignore` 不更新则会导致安装产物被 GitDoc 同步到 GitHub。

**How to apply:** 安装完成后，立即打开 `.gitignore` 和 `install-mcp.sh`，对照现有格式添加对应条目。完成后向用户确认"三个步骤都已完成"。
