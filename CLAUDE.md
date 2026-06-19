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
├── .mcp.json                        # MCP 服务器启动配置（git 追踪）
├── .gitignore                       # 排除安装产物，保留声明文件
├── pyproject.toml / uv.lock         # Python 项目依赖
├── main.py                          # 项目入口
│
├── .vscode/
│   └── tasks.json                   # 打开文件夹时自动 git pull
│
├── .githooks/
│   ├── post-commit                  # commit 后自动 git push
│   └── pre-push                     # push 前自动提交 settings 变更
│
├── .claude/
│   ├── settings.json                # 全局权限配置
│   ├── settings.local.json          # 本地权限配置（项目专属）
│   │
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

# 3. 一键安装 MCP + Skills（Git Bash 版本）
bash .claude/install-mcp.sh

# 4. 用 VSCode 打开
code .
```

完成后重启 VSCode 即可使用全部功能。

### 3.3 国内用户：配置代理

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

| 触发时机 | 自动动作 | 实现 |
|---------|---------|------|
| 打开 VSCode | `git pull --rebase` | `.vscode/tasks.json` |
| `git commit` 后 | 自动 `git push` | `.githooks/post-commit` |
| `git push` 前 | 自动提交 settings 变更 | `.githooks/pre-push` |

### 4.2 完整闭环

```
电脑 A                        电脑 B
──────                        ──────
写代码                          打开 VSCode
git commit -m "xxx"            → tasks.json 自动 git pull
→ post-commit 自动 push →      → settings / memory 同步到最新
→ pre-push 顺带提交 settings
→ GitHub 更新 ✅
```

### 4.3 备份内容

git push 即备份，以下内容随仓库走：

- **配置文件**：`.mcp.json`、`settings.json`、`settings.local.json`
- **声明文件**：`package.json`、`package-lock.json`、`pyproject.toml`、`uv.lock`
- **经验库**：`.claude/memory/` 下全部 `.md` 文件
- **wasm-reverse skill**：SKILL.md + gen_stub_template.js
- **Git hooks**：`.githooks/` 下全部脚本
- **VSCode 配置**：`.vscode/tasks.json`

以下**不需要备份**（`install-mcp.sh` 一键恢复）：

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

### Q5: 换电脑后想保留 settings.local.json

已在 `.gitignore` 中排除 `.claude/settings.local.json`？检查确认它已被 git 追踪：
```bash
git ls-files .claude/settings.local.json
```
若未被追踪，手动添加：`git add -f .claude/settings.local.json`

---

## 十、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-06-19 | 初始版本：MCP × 2、Skill × 2、Memory 两级索引、自动备份 |
