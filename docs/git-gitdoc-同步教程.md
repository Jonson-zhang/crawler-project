# Git + GitDoc 跨电脑同步教程

> 写给小白：读完这篇，你就能在两台电脑之间无缝同步代码了。

---

## 一、先理解两个概念

### 1.1 Git 是什么

想象你在写一篇小说。你改来改去，有时候改坏了想回到之前的版本，怎么办？

Git 就是一个**版本记录器**。它把你的每次修改都拍一张快照（叫 commit），你随时可以翻看历史、回到过去。

```
写作过程:  v1 ──→ v2 ──→ v3 ──→ v4（当前）
             ↓        ↓        ↓
Git 记录:   快照1    快照2    快照3     ← 每个快照都可以随时恢复
```

### 1.2 本地 vs 远程

Git 本身只在你的电脑上工作。那么另一台电脑怎么拿到你的代码？

需要一个**中间人**——GitHub（一个放代码的网站）：

```
电脑 A                     GitHub                    电脑 B
──────      push→        ──────        pull→        ──────
本地代码   ←──── 上传    远程仓库    下载 ────→    本地代码
```

- **push**（推送）：把你的修改上传到 GitHub
- **pull**（拉取）：从 GitHub 下载别人的修改

### 1.3 GitDoc 是什么

手动 `git commit` + `git push` 很麻烦，而且容易忘记。

GitDoc 是一个 VSCode 插件，它**自动帮你做这些事**：

```
你按下 Ctrl+S 保存
         │
         ↓
    GitDoc 等待 5 秒
         │
         ↓
    git commit（记录修改）
         │
         ↓
    git push（上传到 GitHub）
         │
         ↓
    git pull（顺便拉取别人可能的新修改）
```

你只需要**保存文件**，剩下全部自动完成。

---

## 二、这个项目是怎么配的

### 2.1 需要安装的东西

| 软件 | 干什么的 |
|------|---------|
| **Git for Windows** | Git 本身（命令行工具） |
| **VSCode** | 编辑器 |
| **GitDoc 插件** | VSCode 里自动执行 Git 命令 |

### 2.2 工作流程（你每天实际要做的）

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   电脑 A                                              │
│   ──────                                              │
│   1. 打开 VSCode → GitDoc 自动 pull 最新代码           │
│   2. 写代码...                                        │
│   3. Ctrl+S 保存                                      │
│   4. GitDoc 5秒后自动 commit + push + pull            │
│   5. 关闭 VSCode → GitDoc 自动 commit 未保存的变更     │
│                                                      │
│                         GitHub                       │
│                           ↕                           │
│                                                      │
│   电脑 B                                              │
│   ──────                                              │
│   1. 打开 VSCode → GitDoc 自动 pull（拿到电脑A的修改）  │
│   2. 继续写代码...                                    │
│   3. Ctrl+S 保存 → 自动同步回去                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 2.3 配置项解释

这是项目 `.vscode/settings.json` 中的 GitDoc 配置：

```jsonc
// 开启 GitDoc
"gitdoc.enabled": true,

// 保存后等 5 秒再提交（避免频繁保存触发太多次）
"gitdoc.autoCommitDelay": 5000,

// commit 信息格式：auto: sync [06-22 22:30]
"gitdoc.commitMessageFormat": "auto: sync [MM-DD HH:mm]",

// push 时机：每次 commit 后自动 push
"gitdoc.autopush": "onCommit",

// pull 时机：每次 push 后自动 pull
"gitdoc.autopull": "onPush",

// 打开项目时自动 pull
"gitdoc.pullOnOpen": true,

// 关闭 VSCode 时把没保存的也提交
"gitdoc.commitOnClose": true
```

---

## 三、哪些文件不会自动同步（以及为什么）

### 3.1 一个关键概念：`.gitignore`

Git 不会自动决定哪些文件该同步、哪些不该。你需要给它一份**排除清单**，告诉它"这些文件和目录请无视"。

这份清单就是项目根目录下的 `.gitignore` 文件。

```
你的项目文件夹
├── main.py           ✅ 同步
├── .vscode/
│   └── settings.json ✅ 同步
├── .venv/            ❌ 不同步（被 .gitignore 排除）
├── .mcp.json         ❌ 不同步（被 .gitignore 排除）
├── node_modules/     ❌ 不同步（被 .gitignore 排除）
└── __pycache__/      ❌ 不同步（被 .gitignore 排除）
```

### 3.2 本项目排除的内容（逐条解释）

以下是 `.gitignore` 中的每一类，以及**为什么不能同步**：

#### 📦 第一类：Python 运行产物

```gitignore
__pycache__/
*.py[oc]
build/
dist/
wheels/
*.egg-info
```

**为什么排除**：这些是 Python 运行后自动生成的中间文件。每台电脑上的版本不同，同步了反而会互相覆盖、报错。而且它们**不是源代码**，没有备份价值。

#### 🐍 第二类：Python 虚拟环境

```gitignore
.venv
```

**为什么排除**：虚拟环境里是几百 MB 的第三方包（`numpy`、`DrissionPage` 等），直接同步太慢也太浪费。正确的做法是用 `uv.lock` 记录依赖清单，换电脑后一条命令重建。

> ⚠️ **重要**：`.venv` 不同步，但它依赖的清单文件 `pyproject.toml` 和 `uv.lock` **会同步**。换电脑后用 `uv sync` 即可重建一模一样的环境。

#### ⚙️ 第三类：机器相关配置

```gitignore
.mcp.json
```

**为什么排除**：`.mcp.json` 里写的是 MCP 服务器的**本机绝对路径**（比如 `H:\Crawler\.claude\...`），换一台电脑路径就变了。这个文件由 `install-mcp.sh` 脚本在每台电脑上自动生成。

#### 📥 第四类：MCP 服务器安装产物

```gitignore
.claude/mcp-servers/**/node_modules/
.claude/mcp-servers/**/.venv/
.claude/mcp-servers/camoufox-reverse-mcp/
```

**为什么排除**：MCP 服务器是第三方工具，体积大（node_modules 几百 MB），通过 `install-mcp.sh` 一键安装即可。它们不是你的项目代码，不需要备份。

> 💡 但 `package.json` 和 `package-lock.json` **会同步**——它们记录了依赖清单，和 `uv.lock` 同理。

#### 🧩 第五类：Skills 技能库

```gitignore
.claude/skills/hello_js_reverse_skill/
.claude/skills/ast-deobfuscation/
.claude/skills/web-reverse-algorithm/
.claude/skills/web-reverse-env/
.claude/skills/playwright-skill/
```

**为什么排除**：这些是从 GitHub 克隆的第三方技能库，`install-mcp.sh` 一键恢复。它们会独立更新，不应该混在你的项目 git 历史里。

> 💡 **例外**：`wasm-reverse` 这个 skill 是我们自己写的，所以**不在排除列表中**，它会同步。

#### 🌐 第六类：浏览器运行残留

```gitignore
browser_cookies.txt
*/browser_profile/
*/dp_user_data/
```

**为什么排除**：爬虫运行时会启动浏览器，产生 cookie 文件、浏览器缓存、用户数据目录。这些是运行时产物，而且**含有你的登录信息**，绝对不该上传到公开的 GitHub。

### 3.3 换电脑后如何恢复这些被排除的内容

所有被排除的文件都有一键恢复方案：

| 被排除的内容 | 恢复方式 | 命令 / 步骤 |
|-------------|---------|-------------|
| `.venv`（Python 包） | `uv sync` 重建 | `uv sync` |
| `node_modules`（JS 包） | `npm install` 重建 | `cd .claude/mcp-servers/js-reverse-mcp && npm install` |
| `.mcp.json` | `install-mcp.sh` 自动生成 | `bash .claude/install-mcp.sh` |
| MCP 服务器 | `install-mcp.sh` 克隆安装 | `bash .claude/install-mcp.sh` |
| Skills | `install-mcp.sh` 克隆安装 | `bash .claude/install-mcp.sh` |
| 浏览器残留 | 不需要恢复，运行时自动生成 | 无需操作 |

**所以换新电脑的完整恢复步骤只有两条命令**：

```bash
uv sync                       # 恢复 Python 环境
bash .claude/install-mcp.sh   # 恢复 MCP + Skills + 生成本机配置
```

### 3.4 如果你需要新增排除规则

假设你开始在某站写爬虫，产生了一个 `某站/cookies.json`，你不想把它同步到 GitHub（含敏感信息）。

在 `.gitignore` 末尾加一行：

```gitignore
某站/cookies.json
```

或者更彻底，排除整个站点的运行产物目录：

```gitignore
# XX站点运行产物（含敏感信息）
某站/logs/
某站/cookies.json
某站/browser_profile/
```

**规则**：修改 `.gitignore` 本身**会被同步**到 GitHub，这样另一台电脑也会自动遵守这些规则。

---

## 四、动手实践：在两台电脑上设置同步

### 第一台电脑（已配置好）

假设你的主电脑已经配好了这个项目。什么都不用做，写代码就行。

### 第二台电脑（新电脑）

**第 1 步：安装 Git**

去 [git-scm.com](https://git-scm.com) 下载安装，一路默认即可。

**第 2 步：克隆项目**

打开 Git Bash，输入：

```bash
cd ~/Desktop
git clone https://github.com/Jonson-zhang/crawler-project.git
```

把你的 GitHub 用户名替换掉。

**第 3 步：安装 VSCode + Claude Code 扩展**

**第 4 步：安装 GitDoc 插件**

VSCode 左侧点扩展图标 → 搜索 `GitDoc` → 安装（作者是 `vsls-contrib`）。

**第 5 步：用 VSCode 打开项目**

```bash
code crawler-project
```

打开的一瞬间，GitDoc 会自动 `git pull`，所有代码都是最新的。

**第 6 步：完成后**

开发不需要手动记任何 Git 命令。保存 → GitDoc 自动同步 → 换电脑 → 打开时自动拿到最新代码。

---

## 五、常见问题

### Q1: 怎么知道同步成功了？

看 VSCode 左下角状态栏：

```
🔄 正在同步...    → 同步中
📤 已推送          → 上传成功
📥 已拉取          → 下载成功
✅ 已同步          → 全部完成
```

### Q2: git push 失败怎么办？

最常见原因是**网络问题**（GitHub 偶尔连不上）。

**不用担心**：失败后 GitDoc 会在下次保存时自动重试。你继续写你的代码就行。

如果是国内网络被墙，需要配代理：

```bash
git config http.proxy http://127.0.0.1:10808
git config https.proxy http://127.0.0.1:10808
```

### Q3: 两台电脑同时改了同一个文件怎么办？

这种情况会出现**冲突**。

GitDoc 遇到冲突时不会自动处理，你需要手动解决。如果你刚开始用 Git，最好的做法是：

> **不同时在两台电脑上改同一个文件。** 在一台上写完了、保存、等几秒确认同步，再去另一台打开。

### Q4: 我想看修改历史，怎么看？

VSCode 左侧点 Git 图标（三个点连起来的方块）→ **Timeline**（时间线），就能看到每次保存的历史。

或者安装扩展 **GitLens**，功能更强。

### Q5: 我不想每次都自动提交怎么办？

把 `"gitdoc.enabled": true` 注释掉或改为 `false`：

```jsonc
// "gitdoc.enabled": true,
```

之后需要手动在终端输入：

```bash
git add -A
git commit -m "描述你改了什么"
git push
```

---

## 六、一句话总结

| 你做的 | GitDoc 自动做的 |
|-------|---------------|
| Ctrl+S 保存 | 等 5 秒 → commit → push → pull |
| 打开 VSCode | pull 最新代码 |
| 关闭 VSCode | commit 还没保存的修改 |

**你只需要写代码和按 Ctrl+S，剩下的 GitDoc 全包了。**
