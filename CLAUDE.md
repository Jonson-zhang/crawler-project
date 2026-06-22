# Crawler 项目安装与使用规范

## 一、环境概述

本项目基于 **Claude Code**（VSCode 扩展），集成三个核心系统完成 JS 逆向工程：

| 系统 | 作用 | 存放位置 |
|------|------|---------|
| **MCP** | 浏览器调试、JS 分析、网络抓包（工具层） | `.claude/mcp-servers/` |
| **Skills** | 逆向方法论、工作流程、经验库（知识层） | `.claude/skills/` |
| **Memory** | 项目约定、踩坑记录、领域经验（持久层） | `.claude/memory/` |

三者关系：MCP 提供工具、Skill 指挥流程、Memory 记录经验。

---

## 二、目录结构

```
项目根/
├── .mcp.json                        # MCP 服务器配置（机器相关，install-mcp.sh 生成，不追踪）
├── .gitignore                       # 排除安装产物 + 机器相关文件
├── pyproject.toml / uv.lock         # Python 项目依赖
├── main.py                          # 项目入口
│
├── .vscode/
│   ├── settings.json                # GitDoc 配置 + 解释器路径（${workspaceFolder} 可移植）
│   ├── tasks.json                   # VSCode 任务（预留）
│   └── extensions.json              # 推荐扩展列表（含 GitDoc）
│
├── .claude/
│   ├── settings.json                # 全局权限配置
│   ├── settings.local.json          # 本地权限配置（项目专属）
│   │
│   ├── fix-paths.py                 # 安装脚本：生成本机 .mcp.json
│   ├── install-mcp.sh               # 一键恢复脚本（Git Bash）
│   ├── install-mcp.ps1              # 一键恢复脚本（PowerShell）
│   │
│   ├── mcp-servers/                 # MCP 服务器（部分被 gitignore 排除）
│   │   ├── .venv/                   # Python 虚拟环境（安装产物，不追踪）
│   │   ├── camoufox-reverse-mcp/    # git clone 获取（不追踪）
│   │   └── js-reverse-mcp/          # npm 安装（仅追踪 package.json）
│   │       ├── package.json         # npm 依赖声明（git 追踪）
│   │       ├── package-lock.json    # npm 锁定版本（git 追踪）
│   │       └── node_modules/        # 安装产物（不追踪）
│   │
│   ├── skills/
│   │   ├── hello_js_reverse_skill/  # git clone 获取（不追踪）
│   │   └── wasm-reverse/            # 手动资产，直接 git 追踪
│   │       ├── SKILL.md
│   │       └── gen_stub_template.js
│   │
│   └── memory/
│       ├── MEMORY.md                # 一级索索引（git 追踪）
│       ├── backup-restore.md        # 备份恢复说明
│       ├── crawler-conventions.md   # 项目约定
│       └── wasm/                    # WASM 领域经验子索引
│           ├── MEMORY.md            # 二级索引
│           ├── trace-first.md
│           ├── stub-template.md
│           ├── no-wasmtime.md
│           ├── string-abi.md
│           ├── memory-buffer.md
│           └── utf8-str-len.md
```

---

## 三、新电脑安装（首次）

### 3.1 前置依赖

- **VSCode** + Claude Code 扩展
- **Git for Windows**（自带 Git Bash）
- **Python 3.10+**（`python` 可在终端直接运行）
- **Node.js 20+**（`node` 可在终端直接运行）

### 3.2 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/Jonson-zhang/crawler-project.git
cd crawler-project

# 2. 恢复 Python 环境（uv.lock → 虚拟环境）
uv sync

# 3. 一键安装 MCP + Skills + 生成本机 .mcp.json
bash .claude/install-mcp.sh

# 4. 用 VSCode 打开
code .
```

完成后重启 VSCode 即可使用全部功能。

> **注意**：`.mcp.json` 被 `.gitignore` 排除（含本机绝对路径），`install-mcp.sh` 第 5 步自动生成。

### 3.3 Python 包管理规范 ⚠️

**永远使用 `uv` 安装 Python 包，不要用 `pip install`。**

```bash
# ✅ 正确：uv 自动更新 pyproject.toml + uv.lock
uv add DrissionPage

# ✅ 正确：同步锁文件到当前环境
uv sync

# ❌ 错误：绕过了 pyproject.toml，换电脑后丢失
pip install DrissionPage
```

**为什么**：`uv add` 会同时更新 `pyproject.toml` 和 `uv.lock`，git 同步后另一台电脑执行 `uv sync` 即可恢复完全一致的环境。`pip install` 只装到当前环境，不更新任何锁文件——下次换电脑就报 `ModuleNotFoundError`。

### 3.4 国内用户：配置代理

GitHub 被墙时，需要先配代理再操作：

```bash
# 配置 git 代理
git config http.proxy http://127.0.0.1:10808
git config https.proxy http://127.0.0.1:10808

# 带代理安装
USE_PROXY=1 bash .claude/install-mcp.sh
```

---

## 四、自动备份机制

### 4.1 原理

使用 **GitDoc** 插件（VSCode 扩展），保存文件即自动提交推送：

| 触发时机 | 自动动作 | 实现 |
|---------|---------|------|
| 保存文件 | 5 秒后自动 `git commit` | GitDoc `autoCommitDelay: 5000` |
| commit 后 | 自动 `git push` | GitDoc `autopush: "onCommit"` |
| push 后 | 自动 `git pull` | GitDoc `autopull: "onPush"` |
| 打开项目 | 自动 `git pull` | GitDoc `pullOnOpen: true` |
| 关闭 VSCode | 提交未保存的变更 | GitDoc `commitOnClose: true` |

### 4.2 监控范围

监控整个工作区（`gitdoc.filePattern` 未设置，默认全部文件）。

`.gitignore` 排除的内容不会提交（`node_modules/`、`.venv/` 等）。

### 4.3 完整闭环

```
电脑 A                        电脑 B
──────                        ──────
保存文件                          打开 VSCode
→ GitDoc 5s 后 commit         → GitDoc 自动 pull
→ GitDoc 自动 push             → 所有变更同步到最新
→ GitHub 更新 ✅
```

### 4.4 备份内容

git push 即备份，以下内容随仓库走：

- **配置文件**：`settings.json`、`settings.local.json`
- **声明文件**：`package.json`、`package-lock.json`、`pyproject.toml`、`uv.lock`
- **经验库**：`.claude/memory/` 下全部 `.md` 文件
- **wasm-reverse skill**：SKILL.md + gen_stub_template.js
- **VSCode 配置**：`.vscode/settings.json`、`.vscode/tasks.json`、`.vscode/extensions.json`
- **业务模板**：各站点 `config.example.json`、`cookies.example.json`（不含实际 cookie）

以下**不需要备份**（`install-mcp.sh` 一键恢复）：

- `.mcp.json`（每台机器 `fix-paths.py` 生成本机绝对路径）
- `node_modules/`、`.venv/`
- `camoufox-reverse-mcp/`（GitHub clone）
- `hello_js_reverse_skill/`（GitHub clone）

---

## 五、MCP 服务器

### 5.1 当前 MCP 列表

| MCP Server | 类型 | 用途 | 来源 |
|-----------|------|------|------|
| `camoufox-reverse` | Python | 反检测浏览器 + 35 个逆向工具 | [GitHub](https://github.com/WhiteNightShadow/camoufox-reverse-mcp) |
| `js-reverse` | Node.js | Chrome DevTools 调试 + JS 分析与 Hook | [npm](https://www.npmjs.com/package/js-reverse-mcp) |

### 5.2 配置文件

`.mcp.json` 是 MCP 的声明文件，被 git 追踪。VSCode/Claude Code 启动时自动加载。

配置要点：
- `command` 和 `args` 必须使用**绝对路径**，避免工作目录差异导致找不到可执行文件
- Python MCP 通过 `-m` 模块方式运行，依赖提前 `pip install -e` 安装
- Node.js MCP 直接指向 `node_modules` 中的入口 JS 文件

### 5.3 如何新增 MCP

```bash
# 1. 在 .claude/mcp-servers/ 下安装
# 2. 如果是 bash 脚本安装的，写进 install-mcp.sh
# 3. 更新 .gitignore（排除安装产物，保留声明文件）
# 4. 在 .mcp.json 中注册
```

---

## 六、Skills（技能）

### 6.1 当前 Skill 列表

| Skill | 调用方式 | 用途 | 来源 |
|-------|---------|------|------|
| `hello_js_reverse_skill` | `/hello_js_reverse_skill` | JS 逆向全流程（JSVMP/混淆/环境伪装） | [GitHub](https://github.com/WhiteNightShadow/hello_js_reverse_skill) |
| `wasm-reverse` | `/wasm-reverse` | WASM 签名逆向（wbg stub / 环境补丁） | 手动置入仓库 |

### 6.2 Skill 存放规则

- **来自 GitHub**：由 `install-mcp.sh` 克隆，`.gitignore` 排除
- **手动维护**：直接放在 `.claude/skills/<name>/`，git 追踪

### 6.3 如何新增 Skill

**来自 GitHub**（推荐）：
```bash
# 1. 在 install-mcp.sh 中添加 git clone 命令
# 2. 在 .gitignore 中排除该目录
```

**手动创建**：
```
.claude/skills/<skill-name>/
├── SKILL.md          # 必选：技能主文件（含硬约束、流程、经验法则）
├── references/       # 可选：按需加载的参考文档
├── cases/            # 可选：案例经验库
│   ├── _template.md
│   └── README.md
├── templates/        # 可选：代码模板
└── scripts/          # 可选：辅助脚本
```

---

## 七、Memory（经验记忆）

### 7.1 Memory 结构

```
.claude/memory/
├── MEMORY.md              # 一级索引（每次会话自动加载）
├── crawler-conventions.md # 项目约定
├── backup-restore.md      # 恢复说明
└── wasm/
    ├── MEMORY.md          # 二级索引（Agent 检测到 WASM 场景时主动加载）
    ├── trace-first.md
    ├── stub-template.md
    ├── no-wasmtime.md
    ├── string-abi.md
    ├── memory-buffer.md
    └── utf8-str-len.md
```

### 7.2 加载机制

| Memory 文件 | 加载方式 |
|------------|---------|
| `.claude/memory/MEMORY.md` | **每次会话自动加载** |
| `.claude/memory/wasm/MEMORY.md` | **被动加载**：Agent 检测到 WASM 关键词时主动 `Read` |
| 领域记忆（具体 `.md`） | **被动加载**：Agent 按需从索引中找到并 `Read` |

### 7.3 Memory 文件格式

```markdown
---
name: <kebab-case-slug>
description: <一句话描述>
metadata:
  type: project | feedback | user | reference
---

<事实内容>

**Why:** <为什么是这个规则>
**How to apply:** <如何应用>
```

### 7.4 如何新增 Memory

```bash
# 1. 新建 .md 文件到对应层级
# 2. 更新所在目录的 MEMORY.md 索索引
# 3. git commit 即自动备份
```

规则：
- 不要记录代码结构、git 历史等仓库已有的信息
- 记录「非显而易见」的经验：踩过的坑、不这样做的后果
- 关联记忆用 `[[name]]` 语法互链

---

## 八、代理配置（国内用户）

### 8.1 MCP 代理

在 `.mcp.json` 的 `camoufox-reverse` 参数中传入：
```json
"args": ["-m", "camoufox_reverse_mcp", "--proxy", "http://127.0.0.1:10808"]
```

### 8.2 Git 代理（首次配置，项目内持久化）

```bash
git config http.proxy http://127.0.0.1:10808
git config https.proxy http://127.0.0.1:10808
```

### 8.3 Git 代理（全局一次性）

```bash
git config --global http.proxy http://127.0.0.1:10808
git config --global https.proxy http://127.0.0.1:10808
```

### 8.4 uv 代理

```bash
set HTTPS_PROXY=http://127.0.0.1:10808
set HTTP_PROXY=http://127.0.0.1:10808
uv sync
```

---

## 九、常见问题

### Q1: 新电脑打开 VSCode 后 MCP 连接失败

**原因**: 未运行 `install-mcp.sh`。
**解决**: 关闭 VSCode，运行 `bash .claude/install-mcp.sh`，重新打开。

### Q2: git push 失败

**原因**: 网络问题或未配代理。
**解决**: 检查 `git config http.proxy`。不影响本地工作，下次 commit 会自动重试。

### Q3: Skill 未加载

**原因**: Skill 目录不在 `.claude/skills/` 下，或 SKILL.md 格式错误。
**解决**: 确认目录结构正确，检查 `.gitignore` 是否误排除了该 Skill。

### Q4: Memory 未自动加载

**原因**: 一级索引 `MEMORY.md` 未在 `.claude/memory/` 下，或二级索引需要 Agent 手动触发。
**解决**: 确认文件路径正确，检查 `.gitignore`。

### Q5: 换电脑后报 `ModuleNotFoundError`

**原因**: Python 依赖未同步。
**解决**: 运行 `uv sync`。如果缺少的是 DrissionPage 等爬虫依赖，确认 `pyproject.toml` 里已声明，并重新 `uv sync`。**不要用 `pip install`**（绕过锁文件，下次换电脑又丢）。

### Q6: `.mcp.json` 不存在

**原因**: 这是正常现象。`.mcp.json` 已被 `.gitignore` 排除（含本机绝对路径）。
**解决**: 运行 `bash .claude/install-mcp.sh`，最后一步会自动生成。

---

## 十、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.2 | 2026-06-22 | 跨机器同步清理：`.mcp.json` 不再追踪（fix-paths.py 生成）；移除废弃文件（save/null/tools/.githooks）；`uv add` 包管理规范写入 CLAUDE.md；`.vscode/settings.json` 改用 `${workspaceFolder}` 可移植路径 |
| 1.1 | 2026-06-22 | 自动备份迁移至 GitDoc 插件：保存即 commit + push，替代 auto-watch.py + tasks.json 轮询 |
| 1.0 | 2026-06-19 | 初始版本：MCP × 2、Skill × 2、Memory 两级索引、自动备份 |
