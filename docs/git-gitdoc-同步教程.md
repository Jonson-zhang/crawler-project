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

## 三、动手实践：在两台电脑上设置同步

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

## 四、常见问题

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

## 五、一句话总结

| 你做的 | GitDoc 自动做的 |
|-------|---------------|
| Ctrl+S 保存 | 等 5 秒 → commit → push → pull |
| 打开 VSCode | pull 最新代码 |
| 关闭 VSCode | commit 还没保存的修改 |

**你只需要写代码和按 Ctrl+S，剩下的 GitDoc 全包了。**
