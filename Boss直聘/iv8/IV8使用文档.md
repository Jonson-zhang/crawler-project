# iv8 使用文档 — Boss直聘逆向

## 一、iv8 是什么、不是什么

### 1.1 iv8 的定位：JS 运行时（补环境引擎）

[iv8](https://github.com/HanZzzzz000/iv8) 是 Python 原生 C++ 扩展，
嵌入 Chrome 同款 **V8 JavaScript 引擎**，并在 **C++ 层** 实现浏览器 API。

```
Python 代码                           iv8 的职责边界
──────────                           ────────────────
ctx.eval("new ABC().z(seed, ts)")    ✅ 创建 V8 Isolate
                                     ✅ 加载 JS 源码并执行
┌─────────────────────────────────┐  ✅ 提供 navigator/document/canvas 等浏览器 API
│  iv8 C++ Bridge                 │  ✅ 管理事件循环 (setTimeout/Promise)
├─────────────────────────────────┤  ✅ ctx.eval() 返回 JS 表达式结果
│  V8 引擎 (Chrome 同款)           │
│  ├── BOM API (navigator/screen) │  ❌ 发起 HTTPS 请求
│  ├── DOM API (document/Element) │  ❌ TLS 握手 / 指纹伪装
│  ├── Canvas/WebGL               │  ❌ Cookie Jar 管理
│  ├── Crypto / Performance       │  ❌ DOM 渲染 / 用户交互
│  └── 事件循环                   │  ❌ 接收 Set-Cookie / 处理 302 跳转
└─────────────────────────────────┘
```

**iv8 本质上是"在 C++ 层补环境"**——它没有消灭补环境这个环节，而是把原来你手写 40 行 JS stub（`window={}`/`location={}`/…）的工作变成了 C++ 层自带。对比三种补环境方式：

| | 手写 JS stub（Node.js vm） | jsdom | iv8 |
|---|---|---|---|
| **补环境代码量** | 40+ 行 JS | 1 行 `new JSDOM()` | 0 行 — C++ 内置 |
| **API 实现层** | JS 层 (`Object.defineProperty`) | JS 层 | **C++ 层（V8 引擎内部）** |
| `typeof navigator` | `"object"` ✅ | `"object"` ✅ | `"object"` ✅ |
| `navigator.toString()` | 需手动伪装 | 可能暴露 | 天然 `[native code]` |
| **原型链** `navigator.__proto__` | 需手动构造 | jsdom 构造 | 天然正确 |
| `{}` 的 hidden class | Node.js 的 | jsdom 的 | **Chrome 的** |
| **属性描述符** `getOwnPropertyDescriptor` | 手动 | 部分缺失 | 天然正确 |
| **Canvas 指纹** | 需手动拼接 base64 | 需手动拼接 | 内置可配置 |
| **Proxy 陷阱** 检测 | 会被检测到 | 会被检测到 | 与真实浏览器一致 |

iv8 因为 API 在 C++ 层实现，**VMP 的所有环境检测手段（typeof / toString / 原型链 / hidden class / 属性描述符 / Proxy 陷阱）天然通过**。

### 1.2 iv8 的能力边界

iv8 是"阶段一之后"的工具。完整的逆向流程分为三个阶段，iv8 只负责最后一个：

```
阶段零：勘探采集                      阶段一/二：本地计算
（需要网络层 + 渲染层）               （只需 JS 执行环境）
─────────────────────                ────────────────────
• 发起 HTTPS 请求（TLS 握手）         • 加载 JS 源码到 V8
• 接收 Set-Cookie、管 Cookie Jar       • 执行加密/签名/Token 生成
• 渲染页面、获取动态 chunk URL         • 返回结果给 Python
• 提取 Canvas 指纹样本                 • 复用 V8 Isolate（一次创建，多次调用）
• 用户交互（登录、过验证码）

        ↓                                    ↓
  用什么：requests / cloakbrowser          用什么：iv8 / Node.js vm
  角色：采集原料                           角色：加工原料
  产出：Cookie + JS 文件 + 指纹样本         产出：签名 / Token
```

**核心原则**：iv8 不能替代浏览器做勘探——它没有 HTTP 客户端、TLS 指纹伪装、Cookie Jar、DOM 渲染引擎。但当勘探完成后，iv8 是执行本地签名的最佳选择：纯 Python、无跨进程、初始化 3ms、后续调用 ~1ms。

Boss直聘的 iv8 流程中，以下步骤在 iv8 **之外**：

| 步骤 | 用什么 | 说明 |
|------|--------|------|
| GET API → 拿到 code=37 + seed | `requests`（Python HTTP 库）| iv8 不做网络请求 |
| 下载 security JS | `requests` | URL 来自 API 返回的 `name` 字段 |
| 获取 Canvas 指纹样本 | 浏览器 DevTools 一次性提取 | 取一次保存到 `_canvas_png.txt`，之后永久复用 |
| 执行 `new ABC().z()` | iv8 | V8 中执行混淆 JS，生成 token |
| 携带 token 重试 API | `requests` | iv8 只算 token，不调 API |

每一个网络 I/O 步骤都用 `requests`，iv8 只在"把 JS 源码执行出 token"这一步介入。

---

## 二、安装

### 系统要求

| 平台 | 要求 |
|------|------|
| Windows x64 | Python 3.9 – 3.14 |
| Linux x64 | Python 3.9 – 3.14 (CentOS/Ubuntu/Debian/Fedora) |
| macOS ARM64 | Python 3.11 – 3.14, macOS 14+ (实验性) |

### 安装命令

```bash
pip install iv8 requests
```

> iv8 是预编译 wheel（~50MB），内嵌完整 V8 引擎，**无需安装 Node.js、Chrome 或任何浏览器**。

### 验证安装

```python
import iv8
with iv8.JSContext() as ctx:
    print(ctx.eval("1 + 2"))            # 3
    print(ctx.eval("navigator.userAgent"))  # Mozilla/5.0 ...
    print(ctx.eval("navigator.webdriver"))  # False
```

---

## 三、核心概念

### 3.1 JSContext

```python
import iv8

with iv8.JSContext() as ctx:
    result = ctx.eval("1 + 1")
# 退出 with 块时，V8 Isolate 被释放
```

每个 `JSContext` 独占一个 V8 Isolate（独立堆内存），多个 Context 可在不同线程并行执行。

### 3.2 ctx.eval()

```python
# 基本类型自动转换
ctx.eval("42")        # → int 42
ctx.eval("'hello'")   # → str "hello"
ctx.eval("[1,2,3]")   # → list [1,2,3]

# 复杂对象递归转换
data = ctx.eval("({name: 'test', items: [1,2,3]})", to_py=True)
print(data["items"])  # [1, 2, 3]

# JS 函数返回值
token = ctx.eval("encodeURIComponent('hello world')")
# → str "hello%20world"
```

### 3.3 浏览器指纹配置 — `environment`

iv8 内置一套 Chrome/Windows 默认指纹（200+ 字段）。通过 `environment` 参数选择性覆盖：

```python
environment = {
    # location — 页面 URL
    "location": {
        "href": "https://www.example.com/page",
        "origin": "https://www.example.com",
        "protocol": "https:",
        "host": "www.example.com",
        "hostname": "www.example.com",
        "port": "",
        "pathname": "/page",
        "search": "?q=test",
        "hash": "",
    },

    # navigator — 覆盖浏览器属性
    "navigator": {
        "userAgent": "Mozilla/5.0 ...",
        "platform": "Win32",
        "language": "zh-CN",
        "languages": ["zh-CN", "en-US"],
        "hardwareConcurrency": 8,
    },

    # screen — 屏幕尺寸
    "screen": {
        "width": 1920,
        "height": 1080,
        "colorDepth": 24,
    },

    # canvas — 画布指纹（关键检测点）
    "canvas": {
        "fingerprint": {
            "toDataURL": {
                "png": "data:image/png;base64,iVBORw0KGgo..."
            }
        }
    },

    # window — 窗口属性
    "window": {
        "origin": "https://www.example.com",
    },

    # webgl — GPU 参数
    "webgl": {
        "vendor": "Google Inc. (NVIDIA)",
        "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)",
    },
}

ctx = iv8.JSContext(
    environment=environment,
    config={"timezone": "Asia/Shanghai"},
)
```

**查看所有可配置项**：

```python
for path, value in sorted(iv8.JSContext.get_defaults().items()):
    print(f"{path} = {value!r}")
```

### 3.4 HTML 页面加载 — `page.load()`

```python
html_page = """
<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body>
<script src="https://example.com/app.js"></script>
</body></html>
"""

ctx.expose(
    {
        "baseURL": "https://example.com",
        "html": html_page,
        "headers": [],
        "resources": {
            "https://example.com/app.js": "var APP = true;"  # 外联 JS 内容
        },
    },
    "snapshot",
)

# 流式解析 HTML → 执行 script → 派发 DOMContentLoaded/load 事件
ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")

# 之后可以访问 DOM
ctx.eval("window.APP")   # True
ctx.eval("document.title")  # ""
```

**`page.load()` 参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `baseURL` | string | 是 | 页面 URL |
| `html` | string | 是 | HTML 源码 |
| `resources` | object | 否 | 外联资源映射，URL → 内容 |
| `headers` | array | 否 | 主文档响应头 |

**`resources` 格式**：

```python
{
    "url": "内容字符串",                    # 简写
    "url": {"body": "...", "status": 200,  # 完整格式
            "headers": [["content-type", "application/javascript"]]}
}
```

### 3.5 事件循环控制

```python
with iv8.JSContext(time_mode="logical") as ctx:
    ctx.eval("""
        setTimeout(() => window.done = true, 5000);
    """)
    # 瞬间跳进 5 秒
    ctx.eval("__iv8__.eventLoop.advance(5000)")
    ctx.eval("window.done")  # True
```

**时间模式**：

| 模式 | `sleep(5000)` | 适用场景 |
|------|:--:|------|
| `logical`（默认） | 瞬间完成 | 自动化、签名计算 |
| `system` | 真实等待 5s | 时间敏感（POW、时间差校验） |

---

## 四、Boss直聘完整示例

### 4.0 工具分工一览

整个流程中每个步骤的工具选择：

```
步骤 1  POST API          → requests     (HTTP 客户端)
       ← code=37, seed                                   ───── 网络层
步骤 3  GET security JS    → requests     (HTTP 客户端)         ───/


步骤 4  new ABC().z()      → iv8          (V8 引擎)       ───── 计算层
       ← token                                             ───/


步骤 5  POST API + token   → requests     (HTTP 客户端)   ───── 网络层
       ← code=0 ✅                                          ───/
```

iv8 只在步骤 4 介入——它不参与任何网络通信，只管把下载好的 JS 在类浏览器环境中执行出 token。

### 4.1 最简可用代码

```python
"""
Boss直聘 __zp_stoken__ — iv8 方案
依赖: pip install iv8 requests
"""
import json
from pathlib import Path
from urllib.parse import quote

import requests
import iv8

API_URL = "https://www.zhipin.com/wapi/zpgeek/search/joblist.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

HEADERS = {
    "user-agent": UA,
    "accept": "application/json, text/plain, */*",
    "content-type": "application/x-www-form-urlencoded",
    "origin": "https://www.zhipin.com",
    "referer": "https://www.zhipin.com/web/geek/jobs?query=python&city=101010100",
}

# Canvas 指纹 — 从 iv8 官方示例提取
_canvas_png = (Path(__file__).parent / "_canvas_png.txt").read_text(encoding="utf-8")


def search_jobs(city="101010100", query="python", page=1):
    session = requests.Session()
    data = {"scene": "1", "query": query, "city": city, "page": str(page),
            "experience": "", "degree": "", "industry": "", "scale": "",
            "salary": "", "pageSize": "15"}

    # 1. 首次请求 → code=37
    resp = session.post(API_URL, headers=HEADERS, data=data, timeout=15)
    payload = resp.json()
    if payload.get("code") == 0:
        return (payload.get("zpData") or {}).get("jobList", [])
    if payload.get("code") != 37:
        return None

    # 2. 提取 seed
    seed, name, ts = payload["zpData"]["seed"], payload["zpData"]["name"], payload["zpData"]["ts"]

    # 3. 下载 security JS
    js_url = f"https://www.zhipin.com/web/common/security-js/{name}.js"
    js_code = session.get(js_url, headers={"user-agent": UA}, timeout=15).text

    # 4. iv8 生成 token
    security_url = (
        f"https://www.zhipin.com/web/common/security-check.html"
        f"?seed={quote(seed)}&name={name}&ts={ts}&callbackUrl=&srcReferer"
    )

    html_page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>BOSS直聘</title></head>
<body><script src="{js_url}"></script></body></html>"""

    environment = {
        "location": {
            "href": security_url,
            "origin": "https://www.zhipin.com",
            "protocol": "https:", "host": "www.zhipin.com",
            "hostname": "www.zhipin.com", "port": "",
            "pathname": "/web/common/security-check.html",
            "search": "?" + security_url.split("?", 1)[1], "hash": "",
        },
        "window": {"origin": "https://www.zhipin.com"},
        "canvas": {"fingerprint": {"toDataURL": {"png": _canvas_png}}},
    }

    with iv8.JSContext(environment=environment,
                       config={"timezone": "Asia/Shanghai"}) as ctx:
        ctx.expose({
            "baseURL": environment["location"]["href"],
            "html": html_page, "headers": [],
            "resources": {js_url: js_code},
        }, "snapshot")
        ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")
        token = ctx.eval(
            f"encodeURIComponent((new window.ABC).z("
            f"{json.dumps(seed, ensure_ascii=False)}, {int(ts)}));")

    # 5. 重试 API
    session.cookies.set("__zp_stoken__", str(token))
    resp2 = session.post(API_URL, headers=HEADERS, data=data, timeout=15)
    payload2 = resp2.json()
    if payload2.get("code") == 0:
        return (payload2.get("zpData") or {}).get("jobList", [])
    return None
```

### 4.2 流程解析

```
┌─────────┐    POST API     ┌──────────┐
│ Python  │ ──────────────→ │ Boss API │
│         │ ←── code=37 ─── │          │
│         │   seed, ts      └──────────┘
│         │
│         │   GET security-js/11f5a2fc.js
│         │ ─────────────────────────────→ 下载 JS
│         │
│  ┌──────┴──────┐
│  │ iv8 V8 引擎  │
│  │ page.load()  │  ← 解析 HTML + 执行 JS
│  │ ABC().z()    │  ← 生成 token（C++ 层指纹天然正确）
│  └──────┬──────┘
│         │
│         │   POST API + __zp_stoken__
│         │ ──────────────────────────→ code=0 ✅
└─────────┘
```

### 4.3 关键配置项说明

| 配置 | 是否必须 | 说明 |
|------|:--:|------|
| `location.href` | ✅ | security-check.html 的完整 URL，含 seed/ts 参数 |
| `location.origin` | ✅ | `https://www.zhipin.com` |
| `window.origin` | ✅ | VMP 检测 `window.origin` |
| `canvas.fingerprint.toDataURL.png` | ✅ | Canvas 指纹，VMP 关键检测点，必须是精确的 base64 PNG |
| `config.timezone` | ✅ | `Asia/Shanghai`，影响 `Date().getTimezoneOffset()` |

这三个配置缺一不可。缺了任何一个 → code=38。

---

## 五、Canvas 指纹获取（阶段零：一次性勘探）

> Canvas 指纹是 VMP 最关键的检测点。Boss直聘的 `ABC.z()` 在执行过程中会读取 `canvas.toDataURL()` 并哈希，
> 如果指纹值与预期不符 → code=38。
>
> **指纹只需提取一次**，保存到 `_canvas_png.txt` 后永久复用。以下三种方法选一即可。

### 方法 1：从 iv8 示例提取（最简单）

```bash
python -c "
with open('iv8/examples/zp_stoken.py','r') as f:
    content = f.read()
start = content.index(\"data:image/png;base64,\")
end = content.index(\"'\", start)
png = content[start:end]
with open('_canvas_png.txt','w') as f:
    f.write(png)
"
```

### 方法 2：从真实浏览器提取

```javascript
// 在 Chrome 控制台执行
var c = document.createElement('canvas');
c.width = 300; c.height = 150;
var ctx = c.getContext('2d');
ctx.fillStyle = 'rgb(0,0,0)';
ctx.fillRect(0, 0, c.width, c.height);
ctx.fillStyle = 'rgb(255,255,255)';
ctx.font = '10px Arial';
ctx.fillText('Hello', 10, 50);
console.log(c.toDataURL('image/png'));
```

### 方法 3：iv8 内置默认值

如果不需要精确指纹匹配，iv8 内置的 Canvas 默认值也能通过大部分检测：
```python
# 不设置 canvas 配置，使用 iv8 内置默认值
environment = {"location": {...}, "window": {...}}
```

---

## 六、常见问题

### Q1: `pip install iv8` 很慢 / 失败

iv8 是预编译 wheel（~50MB），网络慢可能超时。
```bash
pip install iv8 -i https://pypi.org/simple --timeout 120
```

### Q2: code=38 反复出现

逐一排查：
1. `window.origin` 是否设置
2. Canvas PNG 是否完整（没有多余的引号/空白）
3. `location.href` 是否包含 seed 参数
4. 时区是否设为 `Asia/Shanghai`

### Q3: token 长度每次都不同

**这是正常的**。Boss直聘的 `ABC.z(seed, ts)` 生成的 token 长度会因 seed 和时间戳不同而变化，
在 440-500 字符之间都正常。浏览器中也是如此。

### Q4: code=35（IP 异常）

请求太频繁触发了频率限制。等待几分钟或换 IP。

### Q5: `ABC is not defined`

JS 代码没有正确加载。检查：
- `resources` 中 js_url 是否正确
- `html_page` 中的 `<script src="...">` 的 URL 是否与 `resources` 的 key 匹配
- iv8 版本是否 ≥ 0.1.3

### Q6: macOS 安装失败

macOS 版不发布到 PyPI，需从 [GitHub Releases](https://github.com/HanZzzzz000/iv8/releases) 下载 wheel 手动安装：
```bash
pip install ./iv8-0.1.3-cp314-cp314-macosx_14_0_arm64.whl
```

### Q7: 性能如何？

| 操作 | 耗时 |
|------|------|
| JSContext 创建 | ~3ms |
| `ctx.eval("1+1")` | ~1μs |
| 加载 316KB 混淆 JS + 生成 token | ~50ms |

8 线程并行可达到 ~4.7x 加速。

### Q8: 和 Camoufox / Playwright / requests 的分工

这些工具不是竞争关系，而是**接力关系**：

| 职责 | 工具 | 说明 |
|------|------|------|
| **网络层**：HTTPS 请求、TLS 指纹、Cookie Jar | `requests` / `curl_cffi` | 纯 Python HTTP，不启动浏览器 |
| **渲染层**：需要真实 DOM 渲染、用户交互 | cloakbrowser / Playwright / Camoufox | 只在必须时用（登录、canvas 取样） |
| **计算层**：JS 加密/签名/Token 生成 | iv8 | 代替 Node.js 子进程，同进程调用 |

三者是接力：

```
requests → API 通信（拿 seed、下载 JS）
    ↓
iv8 → JS 执行（算 token）
    ↓
requests → 带 token 重试 API（拿数据）
```

只有在极少数情况才需要启动浏览器（Canvas 指纹取样一次、登录一次），之后全部走 requests + iv8。

| | iv8 | cloakbrowser (Chromium) | Camoufox (Firefox) |
|---|---|---|---|
| 启动速度 | ~3ms | ~3s | ~2s |
| 内存占用 | ~15MB | ~500MB | ~500MB |
| 能发 HTTP 请求吗 | ❌ | ✅ | ✅ |
| 能执行 JS | ✅ 真实 V8 | ✅ 真实 V8 | ✅ 真实 SpiderMonkey |
| 补环境 | C++ 层内置 | 不需要（真浏览器） | 不需要（真浏览器） |
| 指纹稳定性 | 绝对固定 | 固定 | **随机化**（每次不同） |
| 适用场景 | JS 签名/Token 计算 | 登录、Canvas 取样 | 需 Firefox 指纹的站点 |

> Boss直聘的 VMP 要求 Canvas 指纹**每次稳定一致**（否则 token 无效），这就是为什么 Camoufox 不行、iv8 可以——Camoufox 的 Firefox 引擎会给 Canvas 加随机噪声，iv8 直接用固定 base64 值。

---

## 七、高级用法

### 7.1 多线程并发

```python
from concurrent.futures import ThreadPoolExecutor
import iv8

def compute_token(seed, ts):
    with iv8.JSContext(environment=env, config={"timezone": "Asia/Shanghai"}) as ctx:
        # ... page.load + ABC.z()
        return str(ctx.eval("..."))

with ThreadPoolExecutor(max_workers=8) as executor:
    futures = [executor.submit(compute_token, seed, ts) for seed, ts in tasks]
    tokens = [f.result() for f in futures]
```

### 7.2 查看所有可配置环境项

```python
for path, value in sorted(iv8.JSContext.get_defaults().items()):
    print(f"{path} = {value!r}")
# 输出 200+ 行，覆盖 navigator / screen / document / canvas / webgl / ... 
```

### 7.3 事件循环精细控制

```python
with iv8.JSContext(time_mode="logical") as ctx:
    ctx.eval("setTimeout(() => window.val = 1, 100)")
    ctx.eval("setTimeout(() => window.val = 2, 200)")
    
    ctx.eval("__iv8__.eventLoop.advance(150)")  # 跳到 150ms
    ctx.eval("window.val")  # 1
    
    ctx.eval("__iv8__.eventLoop.advance(100)")  # 跳到 250ms
    ctx.eval("window.val")  # 2
```

### 7.4 DevTools 远程调试

```python
ctx = iv8.JSContext()
ctx.with_devtools(port=9229)  # 启动 Chrome DevTools 服务
# 在 Chrome 打开 chrome://inspect → 连接到 iv8
# 可设断点、查看变量、单步调试 V8 中的 JS
```

### 7.5 `wrapNative` — 函数伪装为 native

```python
with iv8.JSContext() as ctx:
    ctx.eval("""
        function myFunc() { return 42; }
        __iv8__.utils.wrapNative(myFunc, 'myFunc');
    """)
    ctx.eval("myFunc.toString()")  # "function myFunc() { [native code] }"
```

---

## 八、参考资源

- [iv8 GitHub](https://github.com/HanZzzzz000/iv8)
- [iv8 PyPI](https://pypi.org/project/iv8/)
- [iv8 CSDN 介绍](https://blog.csdn.net/weixin_46084750/article/details/156836205)
- 项目内置示例: `iv8/examples/zp_stoken.py`
- 项目内封装: `solution_iv8/boss_iv8.py`
