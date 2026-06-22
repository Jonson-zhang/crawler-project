---
name: camoufox-version-issue
description: Camoufox 库升级导致代码失效——包名改名 + API 变更
metadata:
  type: project
---

## 问题

`install-mcp.sh` 从 GitHub 拉取最新版 Camoufox，导致新电脑上的代码直接挂掉：

| 变更 | 旧 API | 新 API |
|------|--------|--------|
| 包名 | `cloakbrowser` | `camoufox` |
| 入口函数 | `cloakbrowser.launch(headless=True, ...)` | `camoufox.sync_api.Camoufox(**opts)` |
| 浏览器对象 | `launch()` 返回 Browser | `Camoufox.__enter__()` 返回 Browser/BrowserContext |
| 关闭方法 | `browser.close()` | `cm.__exit__(None, None, None)` |
| 持久化 | 手动 cookies.json | `persistent_context=True + user_data_dir` |

## 修复

```python
# 旧
launch = __import__("cloakbrowser").launch
b = launch(headless=True, locale="zh-CN")

# 新
from camoufox.sync_api import Camoufox
cm = Camoufox(headless=True, locale="zh-CN")
b = cm.__enter__()
# ...
cm.__exit__(None, None, None)
```

## 教训

`install-mcp.sh` 无版本锁定（`git clone` 默认拉 `main` 分支最新版），上游 API 变化会导致所有依赖代码失效。如果要保持 Camoufox 稳定可用：

1. 在 `install-mcp.sh` 中 `git clone` 后 `git checkout <已知可用的 commit>`
2. 或改用不随上游变化的替代方案（如 DrissionPage 依赖 PyPI 版本号，相对稳定）

**Why**: 换电脑后东航爬虫直接 ModuleNotFoundError，排查后发现是库升级导致。若有 commit 锁定可避免。

**How to apply**: 依赖 GitHub 仓库的 MCP/Skill 都应该在 install 脚本中锁定到已知可用的 commit，而非默认 `main`。

[[drissionpage-practice]]
