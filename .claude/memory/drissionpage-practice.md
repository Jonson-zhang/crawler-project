---
name: drissionpage-practice
description: DrissionPage 踩坑汇总——API 陷阱、进程管理、Cookie 读取
metadata:
  type: project
---

## 基本配置（能过阿里云 WAF）

```python
from DrissionPage import ChromiumPage, ChromiumOptions

co = ChromiumOptions()
co.set_browser_path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
co.set_user_data_path(PROFILE_DIR)   # 持久化 Cookie
co.auto_port()                        # 自动选端口（非 set_local_port）
co.headless(True)                     # 无头模式
co.set_user_agent(                    # 覆盖默认 HeadlessChrome UA
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
co.set_argument("--no-sandbox")
co.set_argument("--disable-gpu")
co.set_argument("--disable-blink-features=AutomationControlled")  # 去 webdriver 标记
co.set_argument("--window-size=412,915")
```

**三个缺一不可**：`headless(True)` + 伪装 Chrome UA + `--disable-blink-features=AutomationControlled`。

## API 陷阱

### `rect.size` 是 tuple，不是对象

- ✅ `w, h = element.rect.size` / `element.rect.size[0]`
- ❌ `element.rect.width` / `element.rect.height` — 不存在，报 `ElementRect has no attribute 'width'`

### 坐标用 `rect.corners` 和 `rect.viewport_midpoint`

- `rect.corners` → `[(左上x, 左上y), (右上x, 右上y), ...]`
- `rect.viewport_midpoint` → `(viewportX, viewportY)` — **drag 需要用这个坐标**

### `run_js` 的 async 需要 `as_expr=True`

```python
# ✅ async IIFE + as_expr=True
page.run_js(
    "(async () => { const r = await fetch(...); return ...; })();",
    as_expr=True,
)
# ❌ 不加 as_expr → await 报 SyntaxError（JS 被包进 function(){}）
# ❌ run_js 里传 arguments → as_expr 模式下不能用 arguments
```

**正确传参方式**：先用 `page.run_js("window._data = arguments[0];", data)` 把值放到 `window` 上，再用 `as_expr=True` 的 IIFE 引用 `window._data`。

### Cookie 需要先加载页面才能读取

```python
page = ChromiumPage(co)
# ❌ page.cookies() → 返回空列表
page.get("https://target.com/any-page")
page.wait(2)
# ✅ page.cookies() → 正常读取
```

DrissionPage 在导航到目标域名之前，Cookie jar 是空的（即使 profile 里有持久化 Cookie）。

### `auto_port` + `set_user_data_path` 兼容性

`co.auto_port()` 后不要手动 `co.set_local_port()`，否则 address 会变空字符串导致 `ValueError: not enough values to unpack`。

## 进程管理

### Chrome 残留问题

DrissionPage 的 `page.quit()` **不保证 Chrome 进程完全退出**。连续测试会导致残留进程堆积，每个残留进程可能持续发请求，触发 WAF 风控。

**每次测试前强制清理**：

```bash
taskkill /F /IM chrome.exe
```

**代码内安全退出**：

```python
try:
    page.quit()
except Exception:
    pass
time.sleep(2)  # 等 Chrome 真正退出
```

## 滑块拖拽

`el.drag(x, y, duration)` 对阿里云滑块验证码**无效**。阿里云 WAF 检测 CDP 合成事件。不要试图攻克滑块——出现滑块说明 IP 已被标记，等待冷却才是正解。见 [[waf-rate-limiting]]。

## DrissionPage 版本

当前使用 4.1.1.4。API 变化频繁，升级时注意检查 `rect` 和 `run_js` 的行为。

**Why**: 东航项目的 DrissionPage 调试花费了大量时间在 API 细节上。这些陷阱在官方文档中没有明确说明。

**How to apply**: 使用 DrissionPage 时参考此文档避坑。遇到版本升级先跑快速对照测试。

[[waf-browser-engine]] [[waf-rate-limiting]]
