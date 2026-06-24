---
name: default-cloakbrowser
description: 自动化浏览器默认使用 cloakbrowser
metadata:
  type: project
---

# 自动化浏览器：默认 cloakbrowser

需要弹浏览器（登录、验证码绕过、环境截图等）时，默认用 `cloakbrowser`：

```python
from cloakbrowser import launch
b = launch(headless=False)
p = b.new_page()
# ... 操作完成后 ...
b.close()
```

**Why:** `cloakbrowser` 是 Camoufox 旧版包名（Chromium 引擎），本项目依赖的 `camoufox-reverse-mcp` 使用的是此版本。新版 `camoufox` 包 API 不兼容（`Camoufox(...)` 上下文管理器），不能混用。

**How to apply:** 写爬虫/逆向代码涉及到浏览器自动化时，直接用 `cloakbrowser`。不要用 Playwright 裸调、不要用新版 `camoufox` 包。相关 memory：[[camoufox-version-issue]]。
