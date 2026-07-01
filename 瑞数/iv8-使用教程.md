# Python + iv8 配合实战教程

> 适用读者：会 Python，需要签名/Token 计算但 Node.js 补环境过不了或太慢。

---

## 目录

1. [零、前置：iv8 是什么、什么时候用](#零前置iv8-是什么什么时候用)
2. [Step 1：Hello World——确认 iv8 可以执行 JS](#一step-1hello-world确认-iv8-可以执行-js)
3. [Step 2：第一次调用真实签名函数——Boss直聘模式](#二step-2第一个真实签名函数boss直聘的-abc-x-seed-ts)
4. [Step 3：补环境——共享 stubs.js + 站点专属覆盖](#三step-3补环境共享-stubsjs--站点专属覆盖)
5. [Step 4：SDK 多文件加载——今日头条模式](#四step-4sdk-多文件加载今日头条模式)
6. [Step 5：Fetch 拦截捕获签名——今日头条 a_bogus](#五step-5fetch-拦截获取签名今日头条-a_bogus)
7. [Step 6：VMP 进阶——小红书 setter 拦截 + Context 重建](#六step-6vmp-进阶小红书模式setter-拦截--cookie-驱动的-context-重建)
8. [Step 7：完整生产级模板](#七step-7完整生产级模板)
9. [附录：iv8 vs sdenv 对照速查表](#附录iv8-vs-sdenv-对照速查表)

---

## 零、前置：iv8 是什么、什么时候用

### 一句话

**iv8 是 Python 原生的 C++ V8 引擎嵌入——`ctx.eval("JS代码")` 拿返回值，同进程 3ms 调用，无需 Node.js。**

### 什么时候用 iv8

```
你需要执行的 JS 是什么？

├─ 调用一个纯函数（sign(data) → 签名值）
│   → ✅ iv8（首选）
│
├─ 加载 SDK 后调用一个函数（ABC().z() → token）
│   → ✅ iv8（Boss直聘已验证）
│
├─ 加载多个 SDK 文件 + 拦截 fetch 拿签名
│   → ✅ iv8（今日头条已验证）
│
├─ VMP 字节码解释器需要 setter 拦截
│   → ✅ iv8（小红书已验证）
│
├─ RS6 VM while(1) 字节码解释器 + HTTP 重定向链
│   → ❌ iv8 会卡死 → 用 sdenv
│
└─ 需要完整页面生命周期（302→412→200 + Cookie Jar）
    → ❌ → 用 sdenv
```

### 安装

```bash
uv add iv8          # 推荐（自动更新 pyproject.toml + uv.lock）
# 或
pip install iv8
```

---

## 一、Step 1：Hello World——确认 iv8 可以执行 JS

**目标**：三行代码，验证 iv8 环境正常。

```python
# step1_hello.py
import iv8

ctx = iv8.JSContext()
ctx.__enter__()

result = ctx.eval("1 + 2")
print(f"1 + 2 = {result}")  # 1 + 2 = 3

result = ctx.eval("'hello ' + 'world'")
print(f"concat = {result}")  # concat = hello world

ctx.__exit__(None, None, None)
```

```bash
python step1_hello.py
# 1 + 2 = 3
# concat = hello world
```

### 关键认知

```
ctx = iv8.JSContext()    # 创建 V8 引擎实例（C++ 层分配 Isolate）
ctx.__enter__()          # 进入上下文（之后可以 ctx.eval）
result = ctx.eval("...") # 执行 JS 并返回 Python 值
ctx.__exit__(...)         # 退出上下文（释放 V8 资源）
```

三种返回值自动映射：

| JS 类型 | Python 类型 |
|---------|------------|
| `"hello"` | `str` |
| `123` | `int` |
| `true` / `false` | `bool` |
| `null` / `undefined` | `None` |
| `{a: 1}` | `dict` |
| `[1, 2, 3]` | `list` |

---

## 二、Step 2：第一个真实签名函数——Boss直聘的 `ABC().z(seed, ts)`

**场景**：Node.js 补环境 20 轮没过，iv8 一次过。JS 逻辑是 `new ABC().z(seed, ts)` 返回 token。

### 2.1 先确认 JS 在 Node 里能不能加载

把 security JS 下载下来，用最简脚本验证：

```javascript
// step2_verify.js — 验证 JS 可 eval 且入口存在
eval(fs.readFileSync("security-7c91433f.js", "utf-8"));
console.log("typeof ABC:", typeof window.ABC);  // 期望: function
```

```bash
node step2_verify.js
# typeof ABC: function   ← 入口可用
```

如果这步失败（`typeof ABC: undefined`），有两种可能：

| 现象 | 诊断 | 对策 |
|------|------|------|
| `typeof window.ABC === "undefined"` | JSVMP 动态创建入口，Node.js 引擎层差异 | **iv8**（本节继续） |
| `window is not defined` | 缺基础浏览器对象 | Step 3 补 stubs |

### 2.2 用 iv8 调用

```python
# step2_boss.py
import json

import iv8

import requests

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def get_token(seed: str, ts: int, js_code: str) -> str:
    """在 iv8 中执行 JSVMP 签名函数，返回 token"""
    ctx = iv8.JSContext(
        environment={
            "location": {
                "href": f"https://www.zhipin.com/web/common/security-check.html"
                f"?seed={seed}&name=dummy&ts={ts}",
                "origin": "https://www.zhipin.com",
                "host": "www.zhipin.com",
            },
            "navigator": {
                "userAgent": UA,
                "platform": "Win32",
                "webdriver": False,
            },
            "screen": {"width": 1920, "height": 1080},
        },
        config={"timezone": "Asia/Shanghai"},
    )
    ctx.__enter__()

    # 加载 security JS
    ctx.eval(js_code)

    # 验证入口
    abc_type = ctx.eval("typeof window.ABC")
    if abc_type != "function":
        raise RuntimeError(f"ABC 未加载: typeof ABC = {abc_type}")

    # ★ 核心：一行调用
    token = ctx.eval(
        f"encodeURIComponent((new window.ABC).z("
        f"{json.dumps(seed)}, {int(ts)}));"
    )

    ctx.__exit__(None, None, None)
    return str(token)


# ═══ 完整流程 ═══
if __name__ == "__main__":
    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    # ① 调 API 拿 seed
    resp = session.post(
        "https://www.zhipin.com/wapi/zpgeek/search/joblist.json",
        data={"query": "python", "city": "101010100", "page": "1"},
    )
    zp = resp.json()["zpData"]
    seed, name, ts = zp["seed"], zp["name"], zp["ts"]
    print(f"[1] seed={seed[:20]}... ts={ts}")

    # ② 下载 security JS
    js_url = f"https://www.zhipin.com/web/common/security-js/{name}.js"
    js_code = requests.get(js_url).text
    print(f"[2] JS: {len(js_code)} bytes")

    # ③ iv8 计算 token
    token = get_token(seed, ts, js_code)
    print(f"[3] Token: {token[:60]}... ({len(token)} chars)")

    # ④ 带 token 重新请求
    session.cookies.set("__zp_stoken__", token)
    resp2 = session.post(
        "https://www.zhipin.com/wapi/zpgeek/search/joblist.json",
        data={"query": "python", "city": "101010100", "page": "1"},
    )
    print(f"[4] code={resp2.json().get('code')}")
```

```bash
python step2_boss.py
# [1] seed=oQRP3s483ALpqt8fQlC29Z... ts=1782850000
# [2] JS: 322507 bytes
# [3] Token: c66fgw... (458 chars)
# [4] code=0
```

### Boss直聘模式的本质

```
❶ 下载 JS 文件（用 Python requests，不需要浏览器）
❷ ctx = iv8.JSContext(environment={...})
❸ ctx.eval(js_code)                    ← 加载 SDK
❹ result = ctx.eval("function_call()") ← 调用签名
❺ 用 result 发 HTTP 请求
```

---

## 三、Step 3：补环境——共享 stubs.js + 站点专属覆盖

**目标**：iv8 的 C++ 层只实现了部分浏览器 API（navigator、screen、document.body 等），缺失的 API 需要用 JS 补。已有通用补丁 `stubs.js`（440 行），换新站通常只需写 10-30 行专属覆盖。

### 3.1 共享 stubs.js 结构（18 个模块）

| 模块 | 补什么 | 缺了会怎样 |
|------|--------|-----------|
| 全局引用 | `self = window` | `ReferenceError: self is not defined` |
| MessageChannel | core-js Promise 的微任务调度 | bdms.js 等 webpack bundle 静默失败 |
| setImmediate | polyfill 回退 | 旧版 SDK 初始化失败 |
| 事件系统 | `addEventListener` / `ProgressEvent` | SDK 事件注册报错 |
| performance.now() | SDK 内部计时 | 特定函数返回 NaN |
| DOM 元素工厂 | `createElement`（含 Canvas/WebGL） | `document.createElement is not a function` |
| DOM 关键节点 | `body` / `documentElement` / `head` getter | JSVMP 属性诊断卡住 |
| document 属性 | `all` / `cookie` / `readyState` / `hidden` | 环境指纹不匹配 |
| currentScript | SDK 框架读 `project-id` | SDK 初始化静默失败 |
| document.writeln | 远程模块注入 | CDN 模块加载失败 |
| Observers | `MutationObserver` / `PerformanceObserver` | 特定 SDK 初始化报错 |
| Navigator 扩展 | `plugins` / `mimeTypes` | 环境指纹不匹配 |
| 网络 API | `Request` / `Response` / `XMLHttpRequest` | SDK XHR/fetch 报错 |
| Storage | `localStorage` / `sessionStorage` | 存储相关 API 报错 |
| 浏览器特有 | `chrome` / `Intl` | 特定检测失败 |
| 多媒体/Worker | `Image` / `Audio` / `Worker` / `Blob` | Worker 等 API 报错 |
| Crypto | `crypto.subtle` stubs | 加密相关报错 |
| fetch | 默认 mock | 网络拦截失败 |

### 3.2 补环境三步法

```
第一步：ctx.eval(共享 stubs.js)           ← 覆盖 90% 缺失 API
第二步：ctx.eval(站点专属 stubs)          ← 覆盖剩余 8% 站点特有差异
第三步：ctx.eval(目标 SDK)                ← JavaScript 源代码
```

### 3.3 示例：今日头条的站点专属 stubs（20 行）

共享 stubs.js 已经补了 17 个模块，但今日头条还需要：

```python
def toutiao_stubs():
    return """
    // ① document.currentScript — runtime_bundler 读 project-id
    Object.defineProperty(document, 'currentScript', {
        get: function() {
            return {
                src: 'https://lf-security.xxx/runtime_bundler_52.js',
                getAttribute: function(n) {
                    return n === 'project-id' ? '24' : null;
                }
            };
        },
        configurable: true
    });

    // ② SDK 版本映射
    window.onwheelx = { _Ax: '0X21' };
    window._sdkGlueVersionMap = {
        sdkGlueVersion: '1.0.0.55',
        bdmsVersion: '1.0.1.7',
        captchaVersion: '4.0.2'
    };

    // ③ 窗口尺寸
    window.devicePixelRatio = 1.75;
    window.innerWidth = 1920; window.innerHeight = 1080;
    window.outerWidth = 1936; window.outerHeight = 1112;
    """
```

**原则**：共享 stubs.js 不改（通用底座），站点差异写在 `ctx.eval()` 调用中覆盖（层叠补丁）。

---

## 四、Step 4：SDK 多文件加载——今日头条模式

**场景**：新版 SDK 是 7 个独立文件，需要按特定顺序加载，加载顺序错会导致 SDK 初始化静默失败。

### 4.1 加载顺序（不可打乱）

```
acrawler.js          ← JSVMP 解释器（先！）
  ↓ byted_acrawler.init()
  ↓ 设置 window.module = { exports: {} }（init 后！）
  ↓
sdk-glue.js          ← SDK 胶水层
  ↓
bdms.js              ← 签名引擎
  ↓
runtime_bundler.js   ← 沙箱框架
  ↓
_SdkGlueInit()       ← 激活
  ↓
远程模块 × 3          ← document.writeln 注入
  (config_24.js / project_24.js / strategy_24.js)
```

### 4.2 加载代码

```python
# step4_toutiao_load.py
import json
from pathlib import Path

import iv8

SDK_DIR = Path("今日头条/iv8")
SHARED_STUBS = Path(".claude/iv8/stubs.js")

ctx = iv8.JSContext(
    environment={
        "location": {"href": "https://www.toutiao.com/"},
        "navigator": {"userAgent": UA, "platform": "Win32", "webdriver": False},
        "screen": {"width": 1920, "height": 1080},
    },
    config={"timezone": "Asia/Shanghai"},
)
ctx.__enter__()

# ① 共享 stubs（补 17 个模块）
ctx.eval(SHARED_STUBS.read_text("utf-8"))

# ② 站点专属 stubs（补 3 个差异）
ctx.eval(toutiao_stubs())  # 见 Step 3

# ③ 加载 acrawler（JSVMP 解释器 — 必须第一个）
ctx.eval((SDK_DIR / "acrawler.js").read_text("utf-8"))
ctx.eval("window.byted_acrawler.init({aid:24, dfp:true})")

# ★ 关键：module/exports 必须在 acrawler.init() 之后设置
# 否则 JSVMP 字节码解释器的作用域判断会出错
ctx.eval("window.module = { exports: {} }; window.exports = {};")

# ④ 注册远程模块（通过 document.writeln 注入）
for name in ["config_24.js", "project_24.js", "strategy_24.js"]:
    path = SDK_DIR / name
    if path.exists():
        code = path.read_text("utf-8")
        ctx.eval(
            f"window._remoteModules[{json.dumps(name)}] = {json.dumps(code)};"
        )

# ⑤ 加载剩余 SDK
for filename in ["sdk-glue.js", "bdms.js", "runtime_bundler.js"]:
    code = (SDK_DIR / filename).read_text("utf-8")
    ctx.eval(code)

# ⑥ 初始化
ctx.eval("""
window._SdkGlueInit({
    self: {aid: 24, pageId: 6457},
    bdms: {
        aid: 24, pageId: 6457,
        paths: ['/api/pc/list/feed', '/api/pc/list/user/feed']
    }
});
""")

# ⑦ 验证
has_bogus = ctx.eval("typeof window.bogus")
print(f"bogus: {has_bogus}")  # function ← SDK 加载成功
```

### 常见加载错误速查

| 错误 | 原因 | 修 |
|------|------|-----|
| `Module._malloc is not a function` | 这可能是 Emscripten wasm2js 而非普通 JSVMP | 用 wasm-reverse skill 的 `gen_stub_template.js` |
| `ReferenceError: self is not defined` | 共享 stubs.js 没加载 | `ctx.eval(stubs.js)` 必须在 SDK 之前 |
| `window.byted_acrawler.init is not a function` | acrawler.js 没加载或加载失败 | 检查文件路径 |
| SDK 加载了但 `window.bogus` 是 `undefined` | `module/exports` 设置时机错了 | 移到 `acrawler.init()` **之后** |
| `_SdkGlueInit is not a function` | sdk-glue.js 加载失败 | 其依赖 `module.exports` 在 acrawler.init 后设置 |

---

## 五、Step 5：Fetch 拦截获取签名——今日头条 a_bogus

**场景**：SDK 不暴露 `sign(params)` 函数，而是劫持 `window.fetch`，在请求 URL 上附加 `&a_bogus=xxx`。需要 mock `fetch` 来捕获生成的签名。

### 5.1 原理

```
正常浏览器中:
  bdms SDK 拦截 window.fetch
  → 在 URL 上附加 a_bogus
  → 发起真实网络请求

iv8 中:
  重写 window.fetch 为 mock
  → bdms SDK 拦截 mock fetch
  → 在 URL 上附加 a_bogus
  → mock fetch 捕获 URL 中的 a_bogus → 存入 window._capturedABogus
```

### 5.2 Fetch 拦截 stub

```python
FETCH_STUB = """
window._capturedABogus = null;

window.fetch = function(url, init) {
    // bdms SDK 会调用 mock fetch，并在 URL 上附加 a_bogus
    if (typeof url === 'string') {
        var m = url.match(/a_bogus=([^&]+)/);
        if (m) {
            window._capturedABogus = decodeURIComponent(m[1]);
        }
    }
    // 返回 mock 响应（SDK 只关心 URL，不关心响应体）
    return Promise.resolve({
        status: 200,
        ok: true,
        text: function() { return Promise.resolve('{}'); },
        json: function() { return Promise.resolve({}); },
        headers: { get: function() { return ''; } }
    });
};
"""
```

### 5.3 签名流程

```python
# step5_toutiao_sign.py
from urllib.parse import urlencode

def sign(params: dict) -> str:
    """生成 a_bogus"""
    query_str = urlencode(params)

    ctx.eval(f"""
    (function() {{
        window._capturedABogus = null;
        window.fetch(
            "https://www.toutiao.com/api/pc/list/feed?" + {json.dumps(query_str)},
            {{ method: 'GET' }}
        );
        // bdms 拦截 fetch → 附加 a_bogus → 存入 _capturedABogus
        return window._capturedABogus;
    }})()
    """)

    ab = ctx.eval("window._capturedABogus")
    return str(ab) if ab else ""


# ═══ 使用 ═══
ab = sign({
    "channel_id": "3189398972",
    "max_behot_time": "0",
    "category": "pc_profile_channel",
    "aid": "24",
    "app_name": "toutiao_web",
    "msToken": "xxx",
})
print(f"a_bogus: {ab}")  # a_bogus: EGTa... (160 chars)
```

### 三种常见签名获取模式

| 模式 | 示例 | iv8 策略 |
|------|------|---------|
| **直接函数调用** | `new ABC().z(seed, ts)` → token | `ctx.eval("func()")`，最简单 |
| **Fetch 拦截** | `fetch(url)` → URL 附加 `&a_bogus=xxx` | mock `fetch`，从 URL 正则捕获 |
| **全局变量** | SDK 把结果写入 `window.__token` | `ctx.eval("window.__token")` |

---

## 六、Step 6：VMP 进阶——小红书模式（setter 拦截 + cookie 驱动的 Context 重建）

**场景**：小红书 VMP 签名比前两种复杂——需要加载 3 个 JS 文件（ds_script + ds_api + ds_v2），且签名依赖 `document.cookie` 的值。Cookie 变化后 V8 Context 必须重建。

### 6.1 为什么需要 Context 重建

```
请求 #1: cookie="a1=AAA; webId=111"
   → ctx.eval("sign(...)") → x-s = "XY1..."

请求 #2: cookie="a1=BBB; webId=222"（Cookie 更新了）
   → 同一个 ctx.eval → x-s = "XY1..." ← 错误！用的是旧 cookie
   → 必须先 ctx.__exit__() → 新 ctx = JSContext(...) → ctx.eval(cookie=BBB)
```

### 6.2 Setter 拦截——解决 undefined is not a constructor

小红书 VMP 升级时（mns0201 → mns0301），`ds_v2.js` 定义了新版本的字节码解释器。新版本的解释器通过赋值方式挂载：

```javascript
// ds_v2.js 内部
window._AUuXfEG27Xa3x = function(bc, env) { /* VMP 解释器 */ };
```

此时 `env` 数组中有空 slot（`undefined`），后续字节码执行 `new env[0]()` 会报错。解决办法是**拦截 setter**，在赋值时预填充 `env` 槽位：

```python
SETTER_STUB = """
Object.defineProperty(window, '_AUuXfEG27Xa3x', {
    set: function(fn) {
        if (typeof fn === 'function' && fn.toString().length > 100000) {
            // 包装原函数：执行前预填充 env 数组中的空槽
            _ra = function(bc, env) {
                for (var i = 0; i < 200; i++) {
                    if (env[i] === undefined) {
                        var s = function() {};
                        s.prototype = {};
                        env[i] = s;
                    }
                }
                return fn.call(window, bc, env);
            };
        }
    },
    configurable: true
});
"""
```

### 6.3 完整签名器

```python
# step6_xhs_sign.py
import json
from pathlib import Path

import iv8

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)

DS_SCRIPT = Path("ds_script.js").read_text("utf-8")  # VMP 解释器 430KB
DS_API = Path("data/ds_api.js").read_text("utf-8")    # 签名辅助 60KB
DS_V2 = Path("data/ds_v2.js").read_text("utf-8")      # VMP 升级 62KB


class XhsSigner:
    """小红书 X-s 签名器 — iv8 C++ V8"""

    def __init__(self):
        self._ctx = None
        self._last_cookie = "\x00"  # 哨兵值

    def _build_context(self, cookie_str: str):
        """构建 V8 Context 并注入 cookie"""
        # 先销毁旧 Context
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass

        # 创建新 Context
        ctx = iv8.JSContext(
            environment={
                "location": {
                    "href": "https://www.xiaohongshu.com/",
                    "origin": "https://www.xiaohongshu.com",
                    "host": "www.xiaohongshu.com",
                    "pathname": "/",
                },
                "navigator": {
                    "userAgent": UA,
                    "platform": "Win32",
                    "webdriver": False,
                },
                "screen": {"width": 1920, "height": 1080},
            },
            config={"timezone": "Asia/Shanghai"},
        )
        ctx.__enter__()

        # ① 最小 stubs（只需 DOM no-op + cookie getter）
        ctx.eval(f"""
        (function() {{
            var n = function() {{}};
            document.getElementsByTagName = function() {{ return []; }};
            document.querySelector = function() {{ return null; }};
            document.getElementById = function() {{ return null; }};
            document.addEventListener = n;
            document.removeEventListener = n;

            var _cookie = {json.dumps(cookie_str)};
            Object.defineProperty(document, 'cookie', {{
                get: function() {{ return _cookie; }},
                set: function(v) {{ _cookie = v; }},
                configurable: true
            }});

            performance.now = function() {{ return Date.now(); }};
            window.name = '';
        }})();
        """)

        # ② Setter 拦截（VMP env slot 预填充）
        ctx.eval("""
        Object.defineProperty(window, '_AUuXfEG27Xa3x', {
            set: function(fn) {
                if (typeof fn === 'function' && fn.toString().length > 100000) {
                    _ra = function(bc, env) {
                        for (var i = 0; i < 200; i++) {
                            if (env[i] === undefined) {
                                var s = function() {};
                                s.prototype = {};
                                env[i] = s;
                            }
                        }
                        return fn.call(window, bc, env);
                    };
                }
            },
            configurable: true
        });
        """)

        # ③ 加载 VMP SDK
        ctx.eval("(function(){" + DS_SCRIPT + "})();")

        # 验证入口存在
        if ctx.eval("typeof window._AUuXfEG27Xa3x") != "function":
            raise RuntimeError("DS_SDK 未创建 _AUuXfEG27Xa3x")

        # ④ 加载辅助文件
        ctx.eval(DS_API)

        # ⑤ 激活 mnsv2
        _make_mnsv2(ctx)

        # ⑥ 加载升级（setter 拦截在这里生效）
        ctx.eval(DS_V2)

        self._ctx = ctx
        self._last_cookie = cookie_str

    def sign(self, path: str, body: dict | None, cookie_str: str) -> str:
        """签名入口 — cookie 变了自动重建 Context"""
        if cookie_str != self._last_cookie:
            self._build_context(cookie_str)  # ★ 重建

        ctx = self._ctx
        mnsv2 = ctx.eval("window.mnsv2")

        body_str = json.dumps(body or {}, separators=(",", ":"))
        payload_str = json.dumps({
            "method": "POST" if body else "GET",
            "path": path,
            "data": body_str,
        }, separators=(",", ":"))

        # mnsv2(input, md5(input), md5(path))
        return str(ctx.eval(
            f"window.mnsv2({json.dumps(payload_str)},"
            f"_md5({json.dumps(payload_str)}),"
            f"_md5({json.dumps(path)}))"
        ))


def _make_mnsv2(ctx):
    """构建 mnsv2 入口——标准 VMP 包装"""
    ctx.eval("""
    (function() {
        var _md5 = function(s) {
            var h = 0;
            for (var i = 0; i < s.length; i++) {
                h = ((h << 5) - h + s.charCodeAt(i)) | 0;
            }
            return (h >>> 0).toString(16);
        };
        window._md5 = _md5;
        window.mnsv2 = function(payload, phash, phash2) {
            return _ra(payload, [window, _md5]);
        };
    })();
    """)


# ═══ 使用 ═══
signer = XhsSigner()
x_s = signer.sign(
    path="/api/sns/web/v1/homefeed",
    body={"num": 20},
    cookie_str="a1=188...; webId=7e3...; web_session=...",
)
print(f"x-s: {x_s}")  # XY_xxx...  (280 chars)
```

### 三种高级模式总结

| 模式 | 场景 | 代码特征 |
|------|------|---------|
| **Setter 拦截** | VMP 字节码升级时动态赋值函数，`new env[N]()` 要求构造函数存在 | `Object.defineProperty(window, '_AUuXfEG27Xa3x', { set: ... })` |
| **Context 重建** | 签名依赖 `document.cookie` 等动态值 | `if self._last_cookie != cookie_str: self._build_context(cookie_str)` |
| **env slot 预填充** | 字节码解释器的 env 数组有空槽 | 包装函数内 `for(i=0;i<200;i++) if(env[i]===undefined){...env[i]=s;}` |

---

## 七、Step 7：完整生产级模板

整合所有模式的通用模板：

```python
#!/usr/bin/env python3
"""
iv8 签名器 — 调用单个 VMP 函数生成签名的通用模板
==================================================

模式 A（直接调用）:  加载 SDK → ctx.eval("func(args)") → 签名
模式 B（Fetch 拦截）:  加载 SDK → mock fetch → 从 URL 正则提取签名
模式 C（VMP + Cookie）:加载 SDK → setter 拦截 → Context 重建 → 签名

换新站只改: _load_sdk(), _sign(), display_results()
"""

import json
import sys
from pathlib import Path

import iv8

# ═══════════════════════════════════════════════════════════════
#  Config — 换站必改
# ═══════════════════════════════════════════════════════════════

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

HERE = Path(__file__).parent
SHARED_STUBS = HERE.parent / ".claude" / "iv8" / "stubs.js"


# ═══════════════════════════════════════════════════════════════
#  Signer — 换站必改
# ═══════════════════════════════════════════════════════════════

class Signer:
    """通用签名器"""

    def __init__(self):
        self._ctx = None
        self._build_context()

    # ── Context 构建 ──

    def _build_context(self):
        ctx = iv8.JSContext(
            environment={
                "location": {
                    "href": "https://目标域名/",
                    "origin": "https://目标域名",
                    "host": "目标域名",
                    "pathname": "/",
                },
                "navigator": {
                    "userAgent": UA,
                    "platform": "Win32",
                    "webdriver": False,
                },
                "screen": {
                    "width": 1920, "height": 1080,
                    "availWidth": 1920, "availHeight": 1040,
                },
            },
            config={"timezone": "Asia/Shanghai"},
        )
        ctx.__enter__()

        try:
            # ① 共享 stubs
            if SHARED_STUBS.exists():
                ctx.eval(SHARED_STUBS.read_text("utf-8"))

            # ② 站点专属 stubs
            ctx.eval(self._site_stubs())

            # ③ 加载 SDK
            self._load_sdk(ctx)

            # ④ 验证
            self._verify(ctx)

        except Exception:
            ctx.__exit__(None, None, None)
            raise

        self._ctx = ctx

    def _site_stubs(self):
        """★★★ 返回站点专属 JS stubs ★★★"""
        return """
        // 下面写上你的站点需要的额外定义
        // 例子: window.onwheelx = { _Ax: '0X21' };
        """

    def _load_sdk(self, ctx):
        """★★★ 加载 SDK 文件 ★★★"""
        # 模式 A（单文件）:
        #   ctx.eval((HERE / "app.js").read_text("utf-8"))
        #
        # 模式 B（多文件 + fetch 拦截）:
        #   ctx.eval(FETCH_STUB)
        #   for f in ["file1.js", "file2.js"]:
        #       ctx.eval((HERE / f).read_text("utf-8"))
        pass

    def _verify(self, ctx):
        """★★★ 验证 SDK 加载成功 ★★★"""
        # entry = ctx.eval("typeof window.EntryPoint")
        # if entry != "function":
        #     raise RuntimeError(f"SDK 未加载: EntryPoint type = {entry}")
        pass

    # ── 签名 ──

    def sign(self, **kwargs) -> str:
        """★★★ 调用签名函数，返回签名字符串 ★★★"""
        # 模式 A:
        #   return str(self._ctx.eval(
        #       f"window.sign({json.dumps(data)})"
        #   ))
        #
        # 模式 B:
        #   self._ctx.eval(f"""
        #       window._captured = null;
        #       window.fetch("https://host/api?" + {json.dumps(query_str)});
        #   """)
        #   return str(self._ctx.eval("window._captured"))
        pass

    def close(self):
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass

    def __del__(self):
        self.close()


# ═══════════════════════════════════════════════════════════════
#  Display — 换站必改
# ═══════════════════════════════════════════════════════════════

def display_results(items):
    """★★★ 格式化输出 ★★★"""
    for i, item in enumerate(items[:30], 1):
        title = item.get("title") or item.get("name") or "?"
        print(f"  {i:2d}. {title}")


# ═══════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    # ① 初始化签名器
    signer = Signer()

    try:
        # ② 生成签名
        result = signer.sign()
        print(f"Signature: {result}")

    finally:
        signer.close()
```

### 换新站操作清单

| 步骤 | 改什么 |
|------|--------|
| ① 确认类型 | `typeof window.入口 === "function"` 且函数调用返回签名 → iv8 ✅ |
| ② 改 `environment` | 把 `location.href` 换成目标域名 |
| ③ 改 `_site_stubs()` | 加上站点特有的 `window.xxx` / `document.currentScript` |
| ④ 改 `_load_sdk()` | 加载 SDK 文件 |
| ⑤ 改 `sign()` | 调用签名函数 |
| ⑥ 改 `display_results()` | 格式化输出 |

---

## 附录：iv8 vs sdenv 对照速查表

| 维度 | iv8 | sdenv |
|------|-----|-------|
| **安装** | `uv add iv8`（Python 包） | `npm install sdenv`（Node 包，需编译） |
| **语言层** | Python 同进程 `import iv8` | Python → `subprocess` → Node.js |
| **调用延迟** | ~3ms（`JSContext` 创建） | ~500ms-2s（页面加载 + VM 执行） |
| **环境完整性** | 部分（需 440 行 stubs.js 补 18 类 API） | 接近完整（魔改 jsdom + C++ Addon） |
| **事件循环** | ❌ `ctx.eval()` 同步阻塞 | ✅ Node.js 原生事件循环 |
| **HTTP 重定向** | ❌ 无 | ✅ `jsdomFromUrl` 自动跟随 302/412 |
| **Cookie Jar** | ❌ 需手动管理 | ✅ 内置 |
| **Canvas** | 仅 mock（`toDataURL` 返回空字符串） | 真实 C++ node-canvas 渲染 |
| **Node.js 依赖** | 无 | v20+（v21 不兼容） |
| **适合场景** | 调用单个签名函数 | RS6 完整 VM（`while(1)` 循环） |
| **Boss直聘** | ✅ | ⚠️ 可以但太重 |
| **今日头条新版** | ✅ | ⚠️ 可以但太重 |
| **小红书 VMP** | ✅ | ⚠️ 可以但太重 |
| **欧冶 RS6** | ❌ 会卡死 | ✅ |
| **兰州交大 RS6** | ❌ 会卡死 | ✅ |
| **国家医保局 SM2/SM4** | ❌ 不需要（纯算扣模块） | ❌ 不需要 |

---

## 文件清单（Step 1→7 完整演进）

| Step | 模式 | 核心概念 | 行数 |
|:---:|------|------|:---:|
| 1 | Hello World | `JSContext` / `ctx.eval` | 15 |
| 2 | Boss直聘 | 单函数调用 | 60 |
| 3 | 通用 | 共享 stubs + 站点专属覆盖 | 讲概念 |
| 4 | 今日头条 | SDK 多文件加载顺序 | 80 |
| 5 | 今日头条 | Fetch 拦截捕获签名 | 50 |
| 6 | 小红书 | Setter 拦截 + Context 重建 | 140 |
| 7 | 模板 | 生产级模板 | 160 |
