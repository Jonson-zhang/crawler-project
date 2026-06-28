# 今日头条 a_bogus 签名逆向 — 完整技术文档

> 涵盖新版 4-Module CDN SDK 和旧版 02_code.js 两代方案  
> 从环境搭建、SDK 架构分析、补环境尝试、iv8 破局到最终生产交付

---

## 目录

1. [概述与目标](#1-概述与目标)
2. [参数签名原理](#2-参数签名原理)
3. [SDK 架构深度分析](#3-sdk-架构深度分析)
4. [旧版 SDK 方案 (iv8-v2)](#4-旧版-sdk-方案-iv8-v2)
5. [新版 SDK 方案 (iv8)](#5-新版-sdk-方案-iv8)
6. [Node.js 补环境失败分析](#6-nodejs-补环境失败分析)
7. [iv8 引擎破局](#7-iv8-引擎破局)
8. [踩坑全记录](#8-踩坑全记录)
9. [最终方案概述](#9-最终方案概述)
10. [代码详解](#10-代码详解)
11. [可复用经验总结](#11-可复用经验总结)

---

## 1. 概述与目标

### 1.1 项目目标

从今日头条财经频道 API (`/api/pc/list/feed`) 获取文章列表数据。

```
GET https://www.toutiao.com/api/pc/list/feed
    ?channel_id=3189398972
    &max_behot_time=0
    &category=pc_profile_channel
    &aid=24
    &app_name=toutiao_web
    &msToken=xxx
    &a_bogus=yyy

响应:
{
    "has_more": true,
    "message": "success",
    "data": [
        {
            "title": "...",
            "article_url": "https://toutiao.com/group/...",
            "Abstract": "...",
            ...
        }
    ]
}
```

### 1.2 安全参数

| 参数 | 格式 | 说明 |
|------|------|------|
| `a_bogus` | Base64-like, 140-215 chars | URL 绑定签名，bdms JSVMP 签名引擎生成 |
| `msToken` | Base64-like, ~104 chars | 会话令牌，API 响应头 `x-ms-token` 返回 |
| `ttwid` | cookie, HttpOnly | 设备级会话 ID，有效期 ~30 天 |

### 1.3 最终交付

```
今日头条/
├── iv8/                              # 方案 A: 新版 4-Module CDN SDK (iv8 纯 Python)
│   ├── toutiao_iv8.py                # iv8 签名引擎
│   ├── toutiao_api.py                # Python API 调用层
│   ├── acrawler.js                   # JSVMP 字节码解释器 (70KB)
│   ├── sdk-glue.js                   # SDK 模块胶水层 (97KB)
│   ├── bdms.js                       # JSVMP 签名引擎 (248KB)
│   ├── runtime_bundler.js            # SDKRuntime 沙箱框架 (58KB)
│   ├── config_24.js                  # 灰度策略 (885B)
│   ├── project_24.js                 # localStorage 存储策略 (346B)
│   ├── strategy_24.js                # 事件-策略映射 (1005B)
│   └── README.md
│
├── iv8-v2/                           # 方案 B: 旧版 SDK 02_code.js (Node.js subprocess)
│   ├── 02_code.js                    # 旧版 bdms SDK 完整版 (605KB, 单体)
│   ├── sign.js                       # Node.js env_patch + 签名生成
│   ├── toutiao_sign.py              # Python signer (subprocess 桥)
│   └── toutiao_api.py               # Python API 调用层
│
├── mycode/                           # 用户旧版参考实现 (已验证可用)
│   ├── 01_env.js
│   ├── 02_code.js
│   ├── 03_loader.js
│   └── main.py
│
└── REVERSE_TECH_DOC.md               # 本文档
```

核心规则：每个部署目录自包含全部 SDK 文件，不跨目录引用。

---

## 2. 参数签名原理

### 2.1 API 调用流程

```
┌──────────────────────────────────────────────────────────┐
│ Step 1: 注册设备身份                                       │
│                                                          │
│   POST https://ttwid.bytedance.com/ttwid/union/register/ │
│   Body: { region: "cn", aid: 24, service: "www.toutiao.… │
│     com", union: true, … }                               │
│   → Set-Cookie: ttwid=xxx (有效期 30 天)                 │
│                                                          │
│ Step 2: 获取会话令牌                                       │
│                                                          │
│   GET /api/pc/list/feed?channel_id=…&aid=24&…            │
│     (不带 a_bogus)                                       │
│   → 200 OK, content-length: 0                            │
│   → x-ms-token: <session token>                          │
│                                                          │
│ Step 3: 生成 a_bogus 签名                                 │
│                                                          │
│   将 step 2 的 msToken + URL 参数 → bdms SDK             │
│   → 输出 a_bogus 字符串                                  │
│                                                          │
│ Step 4: 携带签名请求                                       │
│                                                          │
│   GET /api/pc/list/feed?…&msToken=xxx&a_bogus=yyy        │
│   → 200 OK, JSON body (15 articles)                     │
└──────────────────────────────────────────────────────────┘
```

### 2.2 a_bogus 签名机制

a_bogus 由字节跳动自研的 **JSVMP (JavaScript Virtual Machine Protection)** 签名引擎生成。

```
输入:
  URL 参数字符串 + UA + msToken + 设备指纹

处理流程:
  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
  │ 参数拼接    │ →  │ 字节码 VM    │ →  │ Base64编码    │
  │ query+UA+ms │    │ 执行签名算法  │    │ 输出 160+ chars│
  └─────────────┘    └──────────────┘    └──────────────┘
                                  ↑
                         设备指纹 (Canvas纹理/
                         CPU核心数/屏幕尺寸/
                         navigator属性/…)

结构分析:
  前 16-20 chars: URL 参数指纹 (随 channel_id, msToken 等变化)
  中 60-80 chars: 设备指纹段 (Canvas/WebGL/Navigator/Cookie)
  后 40-50 chars: URL 签名字段 + 设备后缀
```

**关键属性**：a_bogus 与 URL 参数严格绑定。相同的 msToken 在不同 URL 上产生不同的 a_bogus。长度随 URL 参数变化（160-215 chars 之间），不是定长。

### 2.3 msToken 获取机制

msToken 由 API 服务端在拒绝空签名请求时通过 `x-ms-token` 响应头返回。每次请求返回新的 msToken，旧值不重复使用。实际上，在浏览器的 bdms SDK 会先发一个不带签名的请求获取 msToken，然后使用该 msToken 生成 a_bogus。

---

## 3. SDK 架构深度分析

### 3.1 两代 SDK 对比

头条 SDK 来自字节跳动的 `@byted/secsdk-strategy` 框架，有旧版和 CDN 新版两个版本。

| 维度 | 旧版 (02_code.js) | 新版 (4-Module CDN) |
|------|------------------|---------------------|
| **文件数量** | 1 个文件 | 7 个文件 |
| **文件大小** | 605KB | 486KB 总计 |
| **入口接口** | `window.bogus._u()` 纯函数 | `byted_acrawler` + SDKRuntime 模块系统 |
| **远程依赖** | 无 | config_24.js / project_24.js / strategy_24.js |
| **初始化复杂度** | 一行 eval，立即可用 | ~15 步异步初始化 |
| **JSVMP 解释器** | 内嵌在 bdms.js webpack bundle 中 | 独立 acrawler.js (通用，可被多个站点复用) |
| **策略配置** | 内嵌 | 独立 config_24.js (按 aid=24 动态加载) |
| **自包含** | ✅ | ❌ 需从 CDN 加载 3 个远程模块 |

### 3.2 新版 SDK 加载链路

新版 SDK 的完整加载过程如下（文件名后的数字是文件大小）：

```
① acrawler.js (70KB) — JSVMP 字节码解释器
   ┌─────────────────────────────────────────────────┐
   │  var glb = typeof window === "undefined"        │
   │              ? global : window;                 │
   │  glb._$jsvmprt = function(b, e, f) { … }       │
   │                                                 │
   │  字节码执行: while(opcode) { switch(opcode) … }  │
   │  → 创建 byted_acrawler = { init, sign, ... }   │
   └─────────────────────────────────────────────────┘
   关键: 需要 document.createElement、body.getElementById 等 DOM API
   → init() 内部调用: document.querySelector('head').appendChild(script)
   
② byted_acrawler.init({aid:24, dfp:true})
   → 注册设备指纹采集钩子 (Canvas/WebGL/Navigator/Navigator.sendBeacon/…)

③ sdk-glue.js (97KB) — SDK 模块胶水层
   ┌─────────────────────────────────────────────────┐
   │  Webpack bundle → 导出 _SdkGlueInit()            │
   │  内部使用 createAsyncImport() 来加载各模块:       │
   │    var script = document.createElement('script'); │
   │    script.src = url;                             │
   │    head.appendChild(script);  // ← 需要 Worker   │
   └─────────────────────────────────────────────────┘

④ bdms.js (248KB) — JSVMP 签名引擎 (core-js polyfill)
   ├── core-js v3.29.1 webpack bundle (Promise/Array/…)
   ├── 使用 MessageChannel 实现 Promise 微任务调度
   ├── 暴露 bdms = { getReferer, init }
   └── bdms.init() → 注册 fetch/XHR 拦截器

⑤ runtime_bundler.js (58KB) — SDKRuntime 沙箱框架
   ├── 创建 SDKRuntime 对象：{ module, global, require }
   ├── 创建注册函数：registToModule(), registToGlobal()
   ├── 通过 document.writeln() 动态加载 3 个策略模块
   │   ├── config_24.js  (885B)  灰度切流配置
   │   ├── project_24.js (346B)  localStorage 存储策略
   │   └── strategy_24.js(1005B) 事件→策略映射表
   └── 暴露 use() / registToModule() / registToGlobal()

⑥ _SdkGlueInit({self, bdms})
   → 串联所有模块，调用 bdms.init() 注册最终 fetch 拦截

⑦ 运行时: 用户 fetch(url)
   → bdms 拦截器拦截 → 自动附加 a_bogus + msToken → 发送
```

### 3.3 为什么新版比旧版文件多

本质上是**架构演进**：旧版是单体 webpack bundle，所有模块打包在一起。新版把头（JSVMP 解释器）、身体（SDKRuntime 沙箱）、策略（config/project/strategy）拆开了。

好处：字节跳动多个产品（头条/抖音/西瓜视频）只需换策略文件，不用重新构建整个 bundle。对逆向而言，增加了复杂度——需要同时处理远程依赖和完整的模块系统。

### 3.4 两代 SDK 签名调用路径对比

```
旧版:
  02_code.js
    → window.bogus = u;        // 直接暴露到全局
    → bogus._u(r[0], args, r[1], r[2], null)
                                  ▲
                            直接调用，纯函数

新版:
  acrawler.js → JSVMP 字节码执行 → byted_acrawler 对象
    → init() 注册钩子
  sdk-glue.js → _SdkGlueInit() 封装
  bdms.js → bdms.init() 注册 fetch 拦截
  runtime_bundler.js → SDKRuntime 模块系统
  远程模块 → config/project/strategy
  → _SdkGlueInit() 串联
  → 用户 fetch(url) → bdms 拦截 → 追加 a_bogus
```

---

## 4. 旧版 SDK 方案 (iv8-v2)

### 4.1 方案架构

```
Python (toutiao_api.py)           Node.js (sign.js)
─────────────────────             ─────────────────
requests.Session()                require('./env_site')
  ├─ POST ttwid register          eval(fs.readFileSync('02_code.js'))
  ├─ GET API → msToken            window.bogus._u(r[0], args, r[1], r[2], null)
  ├─ subprocess sign.js → AB      → 168 chars a_bogus
  └─ GET API + AB → articles
```

### 4.2 代码文件

| 文件 | 行数 | 职责 |
|------|:---:|------|
| `02_code.js` | 11114 行 | 旧版 bdms SDK 完整版 (605KB, 单体 webpack bundle) |
| `sign.js` | 150 行 | Node.js env_patch + SDK 加载 + a_bogus 生成 |
| `toutiao_sign.py` | 38 行 | Python → Node.js subprocess 桥接 |
| `toutiao_api.py` | 115 行 | Python HTTP 调用层 + 控制台输出 |

### 4.3 env_patch 补丁 (sign.js)

sign.js 在加载 SDK 前需要补 ~35 个浏览器对象：

```
Window.prototype     → innerWidth/Height, outerWidth/Height, devicePixelRatio,
                       screenX/Y, pageX/YOffset, requestAnimationFrame,
                       clientWidth/Height, sizeWidth/Height

Document.prototype   → cookie (getter/setter), createElement, createEvent,
                       documentElement, body, referrer

document.all         → HTMLAllCollection callable proxy
                       Chrome 特性: typeof === "undefined" 但 !document.all === true

Navigator.prototype  → userAgent, platform, vendor, language, languages,
                       hardwareConcurrency, webdriver, plugins(3), mimeTypes(1),
                       userAgentData, connection

Screen.prototype     → width, height, availWidth, availHeight, colorDepth, pixelDepth

Storage              → localStorage + sessionStorage (Map 后端)
Location             → URL 驱动的 href/protocol/host/hostname/pathname/search/hash
History              → 空壳构造函数
XMLHttpRequest       → open/send stub (不用于网络请求)
EventSource          → 异步 readyState 对象

全局                 → chrome{ runtime, app, loadTimes, csi }
                     → Intl.DateTimeFormat().resolvedOptions(){ timeZone, locale }
                     → window._sdkGlueVersionMap = { … }
```

### 4.4 签名逻辑 (sign.js 核心)

```javascript
// 02_code.js 加载后 window.bogus 自动可用
function a_bogus(queryStr) {
    const r = global.bogus._v;   // 内部配置数组
    const args = [
        0,                       // 模式标记
        1,                       // 参数标记
        8,                       // 参数标记
        queryStr,                // URL 参数字符串
        "",                      // body (空)
        "Mozilla/5.0 ...",       // User-Agent
    ];
    return global.bogus._u(r[0], args, r[1], r[2], null);
}
```

`bogus._v` 是长度为 3 的数组，`_u` 是签名执行函数。参数中的 0/1/8 是字节码虚拟机的操作码标记。

### 4.5 优缺点

**优点**：
- 168 chars，定长输出，服务器验证通过率 100%
- 性能好：Node.js subprocess ~500ms
- 不依赖远程模块或 CDN

**缺点**：
- 02_code.js 是旧版 SDK，可能随时过期
- Node.js 依赖，不适合纯 Python 部署
- `bogus._u()` 接口是新版 SDK 不暴露的"逃生口"

---

## 5. 新版 SDK 方案 (iv8)

### 5.1 方案架构

```
Python (toutiao_api.py)          iv8 (C++ V8)
─────────────────────            ────────────────────
requests.Session()               iv8.JSContext()
  ├─ POST ttwid register           ├─ ① 共享 stubs.js (MessageChannel, DOM, …)
  ├─ GET API → msToken             ├─ ② toutiao 特有 stubs (currentScript, …)
  ├─ signer.sign(params)           ├─ ③ acrawler.js → byted_acrawler
  │     ↓                          ├─ ④ byted_acrawler.init()
  │  ├─ ③ ~ ⑨ SDK 全链加载        ├─ ⑤ module + exports (此时!)
  │  └─ fetch(url) → capture AB    ├─ ⑥ sdk-glue.js
  └─ GET API + AB → articles       ├─ ⑦ bdms.js
                                    ├─ ⑧ runtime_bundler.js
                                    ├─ ⑨ 远程模块 ×3 (writeln注入)
                                    ├─ ⑩ _SdkGlueInit()
                                    └─ ⑪ fetch(url) → bdms 拦截 → 捕获a_bogus
```

### 5.2 代码文件

| 文件 | 行数 | 职责 |
|------|:---:|------|
| `acrawler.js` | — | JSVMP 字节码解释器 (70KB) |
| `sdk-glue.js` | — | SDK 模块胶水层 (97KB) |
| `bdms.js` | — | JSVMP 签名引擎 (248KB) |
| `runtime_bundler.js` | — | SDKRuntime 沙箱 (58KB) |
| `config_24.js` | — | 灰度策略 (885B) |
| `project_24.js` | — | localStorage 桥接 (346B) |
| `strategy_24.js` | — | 事件-策略映射 (1005B) |
| `toutiao_iv8.py` | 247 行 | iv8 签名引擎 (核心) |
| `toutiao_api.py` | 120 行 | Python 调用层 |

### 5.3 SDK 加载顺序 (toutiao_iv8.py)

```python
def _build_context(self):
    ctx = iv8.JSContext(environment={...})
    ctx.__enter__()

    # ① 共享 stubs (来自 .claude/iv8/stubs.js)
    ctx.eval(shared_stubs)

    # ② toutiao 特有 stubs
    ctx.eval(toutiao_stubs)  # currentScript, onwheelx, fetch capture

    # ③ acrawler → init (在其他 SDK 代码之前!)
    ctx.eval("acrawler.js")
    ctx.eval("window.byted_acrawler.init({aid:24, dfp:true})")

    # ④ module/exports (必须在 acrawler.init() 之后!)
    ctx.eval("window.module = { exports: {} }; window.exports = {};")

    # ⑤ 预注册远程模块
    ctx.eval("window._remoteModules['config_24.js'] = '...'")

    # ⑥ sdk-glue
    ctx.eval("sdk-glue.js")

    # ⑦ bdms
    ctx.eval("bdms.js")

    # ⑧ runtime_bundler
    ctx.eval("runtime_bundler.js")

    # ⑨ 串联 _SdkGlueInit
    ctx.eval("""
        window._SdkGlueInit({
            self: {aid: 24, pageId: 6457},
            bdms: {aid: 24, pageId: 6457, paths: ['/api/pc/list/feed']}
        });
    """)
```

### 5.4 签名生成 (toutiao_iv8.py)

```python
def sign(self, params_dict):
    query_str = urlencode(params_dict)

    result = ctx.eval(f"""
    (function() {{
        window._capturedABogus = null;
        var url = "https://www.toutiao.com/api/pc/list/feed?" + {json.dumps(query_str)};
        window.fetch(url, {{ method: 'GET' }});
        return window._capturedABogus;
    }})()
    """)

    return result or ""
```

调用 `window.fetch()` 后被 bdms 包装器拦截，URL 被修改加入 a_bogus，mock 的 `window.fetch` 捕获修改后的 URL 并提取 a_bogus 参数。

### 5.5 远程模块注入

3 个远程模块 (config_24/project_24/strategy_24) 原本通过 `document.writeln(<script src="…">)` 从 CDN 加载。在 iv8 中通过以下 hook 注入本地文件：

```javascript
// 预加载远程模块内容
window._remoteModules = {
    "config_24.js": "...",     // 885 bytes
    "project_24.js": "...",    // 346 bytes
    "strategy_24.js": "...",   // 1005 bytes
};

// Hook document.writeln 拦截动态脚本加载
document.writeln = function(html) {
    var m = html.match(/src="([^"]+)"/);
    if (!m) return;
    var src = m[1];
    for (var k in window._remoteModules) {
        if (src.indexOf(k) >= 0 || k.indexOf(src.split("/").pop()) >= 0) {
            eval(window._remoteModules[k]);
            return;
        }
    }
};
```

### 5.6 iv8 环境补丁

iv8 需要补丁的原因：iv8 是纯净 V8 引擎，不包含浏览器 DOM API。SDK 在初始化过程中需要这些 API。但 JSVMP 字节码引擎本身是 V8 C++ 实现的一部分，所以 typeof/instanceof/原型链语义与 Chrome 完全一致。

共享 stub 文件 `.claude/iv8/stubs.js` 提供 ~440 行通用补丁：
- MessageChannel — core-js Promise polyfill
- DOM (createElement, getElementsByTagName, body/documentElement, …)
- Navigator (plugins, mimeTypes, connection, userAgentData, …)
- Network (fetch, XMLHttpRequest, Request, Response, Headers)
- Storage, chrome, Intl, Image, Audio, Worker, Blob, Crypto

头条特有的补丁在 `_toutiao_stubs()`：
- document.currentScript (runtime_bundler 读取 project-id)
- window.onwheelx / _sdkGlueVersionMap (头条特有全局变量)
- devicePixelRatio = 1.75 (来自真浏览器指纹)
- fetch mock (捕获 a_bogus)

---

## 6. Node.js 补环境失败分析

### 6.1 实验数据

尝试用 env_patch 框架 (`.claude/env-patch/`) 加载新版 4-Module CDN SDK：

```
$ node
> require('./今日头条/v1.0/env_site.js')
> // 加载 acrawler.js
> eval(fs.readFileSync('acrawler.js'))
> console.log(typeof window.byted_acrawler)
→ undefined    ← JSVMP 初始化失败!
```

对比 iv8：
```python
>>> ctx.eval(ac_code)
>>> ctx.eval('typeof window.byted_acrawler')
'object'       ← JSVMP 初始化成功!
```

### 6.2 根因：JSVMP 动态创建入口，字节码分叉导致对象从未生成

**关键事实：`window.byted_acrawler` 不是写在 JS 源码里的静态赋值。它是 JSVMP 字节码执行的产物——只有字节码走到特定 opcode 时，解释器才动态创建这个对象。**

```javascript
// bdms.js 内部的 JSVMP 字节码解释器 (从 webpack bundle 中逆向还原)
// opcode 59 = 创建函数闭包 (这是签名入口的创建点!)

case 59:  // ← 必须是这个 opcode
    o = bytecode[r++];        // 读取操作数: 函数参数
    s = stack[d--];            // 弹出栈: 环境槽位
    u = function e() {         // 动态创建闭包!
        var r = e._v;
        return e._u(r[0], arguments, r[1], r[2], this);
    };
    u._v = [s, o, env];        // 绑定内部状态
    u._u = originalSignFn;     // 绑定签名核心
    stack[++d] = u;            // 压回栈 → 后续赋值给 window 属性

    // ↑ 只有执行到这里，window.bogus 或 window.byted_acrawler 才会存在
```

**字节码在到达 opcode 59 之前就会因为引擎差异而分叉。** JSVMP 的字节码执行路径由条件分支决定，这些条件来自 `typeof`、`instanceof`、属性描述符检查等 V8 引擎层原语。Node.js 和真实 V8 在这些原语的返回值不同 → 字节码走了不同的 `if/else` → **永远到不了 opcode 59 → `window.byted_acrawler` 从未被创建。**

```javascript
// JSVMP 字节码中的条件分支 (伪代码还原)

// 字节码 偏移 0x4420: typeof 检测
if (typeof document.all === 'object') {    // 真 Chrome V8 → "undefined" 但内部类型为 HTMLAllCollection
    goto 0x4500;  // → 最终通向 opcode 59
} else {
    goto 0x7000;  // → 降级路径, 跳过关键初始化
}

// 字节码 偏移 0x4550: instanceof 检测
if (navigator instanceof Navigator) {      // 真 Chrome V8 → true
    goto 0x4600;  // → 最终通向 opcode 59
} else {
    goto 0x7000;  // Node.js → false (Object.create 原型链不等于 C++ hidden class)
}
```

| 检测点 | 真实 V8 (iv8) | Node.js env_patch | 差异原因 |
|--------|:---:|:---:|---------|
| `typeof document.all` | `"undefined"` <br>但 `!document.all`=true | `"undefined"` (直接赋值) | 无差异 |
| `document.all instanceof HTMLAllCollection` | `true` | `false` | C++ hidden class ≠ Object.create |
| `navigator instanceof Navigator` | `true` | `false` | Object.create 原型链 ≠ C++ internal slots |
| `{}.toString.call(HTMLAllCollection)` | `"[object HTMLAllCollection]"` | `"[object Function]"` | V8 C++ 内部类型标签 |
| Object.getOwnPropertyDescriptor 返回值 | C++ 原生 getter | JS 模拟 getter | 语义不同 |
| HTMLDocument.prototype.isPrototypeOf(doc) | `true` | `false` | 原型链层次差异 |

**核心差异不是属性值对不对，而是 C++ 引擎层的类型语义无法在 JS 层模拟。** JSVMP 的执行路径依赖这些检测结果，Node.js 中走了错误分支 → `byted_acrawler` 从未被创建。

### 6.3 DEBUG_PROXY 误区

在早期尝试中用 DEBUG_PROXY 扫描了新版 SDK 执行路径，发现访问了 93 个属性，25 个返回 undefined。补全了这些属性后仍然失败——**因为扫描的是 JSVMP 初始化失败后的降级分支，不是正确的签名数据流。**

对比正确的签名路径只需要 34 个属性 (旧版 SDK)：
- document: all, cookie, createElement, createEvent, documentElement, body, referrer
- navigator: plugins, mimeTypes, webdriver, platform, userAgent, …
- screen: width, height, availWidth, availHeight, colorDepth, pixelDepth
- window: EventSource, fetch, localStorage, sessionStorage, requestAnimationFrame, …

### 6.4 为什么旧版 02_code.js 能用 env_patch

旧版 605KB 的 `02_code.js` 把 `window.bogus._u()` 直接暴露在全局——它是 JSVMP 的**外层逃生口**。整个 webpack bundle 的最后一行就是：

```javascript
window.bdms = a;  // a 包含 bogus._u()
```

由于 `_u()` 是纯函数，不需要通过 JSVMP 的类型检测分支就能调用。新版的 CDN SDK 把这个入口藏到了 `runtime_bundler.js` 的 SDKRuntime 模块系统后面，必须先通过 JSVMP 初始化才能访问到。

---

## 7. iv8 引擎破局

### 7.1 iv8 是什么

iv8 (v0.1.3, `pip install iv8`) 是 V8 C++ 引擎的 Python 绑定。它的 `document`/`navigator`/`screen` 等对象在 V8 C++ 层用 `v8::ObjectTemplate` 创建，而非 JS 层 Object.create。

因此 **typeof/instanceof/原型链语义与 Chrome 完全一致**——这就是为什么 JSVMP 在 iv8 里能正常初始化。

### 7.2 分步突破记录

```
尝试 1: acrawler.js standalone in iv8
  ✅ byted_acrawler = object
  结论: JSVMP 在 iv8 中工作

尝试 2: byted_acrawler.init()
  ❌ TypeError: Cannot read properties of undefined (reading 'appendChild')
  原因: iv8 的 document.head 不存在
  修复: 补全 DOM stubs (createElement + body/documentElement/head getter)

尝试 3: bdms.js (248KB)
  ❌ TypeError: Cannot set properties of null (setting 'onmessage')
  原因: core-js 的 Promise polyfill 使用 MessageChannel.port2.onmessage
  修复: self=window + MessageChannel stub + setImmediate stub

尝试 4: sdk-glue.js (97KB)
  ❌ Worker is not defined
  原因: sdk-glue 内部 webpack 用 Worker 做异步模块加载
  修复: Worker + Blob + URL.createObjectURL stubs

尝试 5: 全链加载 + _SdkGlueInit
  ❌ window.module 设置后 acrawler.init() 重新崩溃
  原因: window.module 覆盖了 JSVMP 内部同名变量
  修复: 将 module/exports 移到 acrawler.init() 之后

尝试 6: 完整 SDK 链
  ✅ 160 chars a_bogus 生成
  调用 API → 200 OK → 15 篇文章
```

### 7.3 Node.js vs iv8 完整对比

| 组件 | Node.js (env_patch) | iv8 (C++ V8) |
|------|:---:|:---:|
| acrawler.js → byted_acrawler | ❌ undefined | ✅ object |
| byted_acrawler.init() | ❌ (上一步已失败) | ✅ OK |
| sdk-glue.js | ❌ | ✅ Worker stubs |
| bdms.js (core-js) | ❌ (超时/死循环) | ✅ MessageChannel stub |
| runtime_bundler | ✅ | ✅ |
| 远程模块 ×3 | N/A | ✅ writeln 注入 |
| _SdkGlueInit | N/A | ✅ |
| bdms fetch 包装 | N/A | ✅ |
| **a_bogus 生成** | ❌ | **✅ 160 chars** |
| **API 验证通过** | ❌ | **✅ 15 篇文章** |

### 7.4 iv8 的局限性

| 局限 | 说明 |
|------|------|
| CSP 阻止 eval() | iv8 内部将 `eval()` 视为 unsafe-eval，某些 SDK 内部 `new Function("return this")()` 会失败 |
| 大文件解析 | ~600KB 的单行 minified 文件 (如 02_code.js 第 2 行有 27KB 的十六进制字面量) 会触发 SyntaxError |
| 无浏览器 TLS | 需要额外的 curl_cffi 或 HTTP 库来发 HTTPS 请求 |

---

## 8. 踩坑全记录

### 8.1 问题 1: 误用 DEBUG_PROXY 路径

**现象**：扫描了新版 SDK 的 fetch 拦截链，发现 93 个属性访问、25 个 undefined。

**误判**：把扫描到的全部属性补到 env_site.js 里。

**真相**：扫描的是 JSVMP 初始化失败后的降级分支，不是正确的签名数据流。正确的签名调用 (`bogus._u()`) 只需要 34 个属性。

**教训**：DEBUG_PROXY 扫描的是「SDK 完整初始化链」，不是「签名的实际数据流」。如果 SDK 在初始化就失败了（如 JSVMP 引擎层差异），后续扫描的都是降级兜底路径，毫无意义。

### 8.2 问题 2: 认错入口

**现象**：SDK 加载链中产生了 a_bogus (通过 fetch 拦截捕获)，但服务器拒绝。

**排查**：花了 2 小时试 curl_cffi (chrome120/124/131)、httpx http2、tls_client、pyhttpx 等 TLS 模拟库 → 全部返回空 body。怀疑是"TLS 指纹被检测"。

**真相**：不是 TLS 问题。a_bogus 本身就不对。把正确的 a_bogus 放进去，Node.js `https.get` 直接能拿到数据。

**关键发现**：头条 API 不检查 TLS 指纹。Python/Node.js 的 plain HTTPS 能过。但 a_bogus 必须正确。

### 8.3 问题 3: 从错误版本开始

**现象**：从 CDN 下载了新版 4-Module SDK (acrawler ~70KB + sdk-glue ~97KB + bdms ~248KB)，花了大量时间解决它的 JSVMP 初始化问题。

**实际可用版本**：用户老版本 02_code.js (605KB 单体) 在 Node.js env_patch 中就能完美工作。它通过 `bogus._u()` 直接暴露签名入口，无需 JSVMP 初始化。

**教训**：先用能跑的老版本确定「环境+BFS算法」是对的，再攻新版。

### 8.4 问题 4: a_bogus 长度误解

**现象**：浏览器 a_bogus 是 172 chars，iv8 生成的是 160 chars。反复调整 Canvas/WebGL/Image/Audio/OfflineAudioContext stubs 试图对齐，长度不变。

**真相**：160 chars 就是新版 SDK 的标准长度。172 chars 是旧版。长度的差异来自不同 SDK 版本的参数编码方式，不是指纹缺失。

**验证**：160 chars 直接带 ttwid cookie → API 返回 15 篇文章。

### 8.5 问题 5: ttwid session 绑定

**现象**：iv8 生成的 a_bogus → API 返回空 body。

**排查**：以为是 a_bogus 格式错，反复调整指纹 stub。

**真相**：缺少 ttwid cookie。API 需要 a_bogus + ttwid + msToken 三者一致。独立的 sign.js/iv8 生成 a_bogus 时没有初始化 ttwid session，所以被拒。

**解决**：在 API 调用层加上 `POST https://ttwid.bytedance.com/ttwid/union/register/`，获取 ttwid cookie 后携带请求。

### 8.6 问题 6: 旧版 SDK 在 iv8 中崩溃

**现象**：iv8 中 `eval(02_code.js)` → SyntaxError。

**原因**：02_code.js 第 2 行包含 27KB 的十六进制字节码字面量 (`"484e4f4a..."`)，iv8 v0.1.3 对超大行号中的非简单字符串字面量有限制。

**解决**：旧版 SDK 直接走 Node.js subprocess (sign.js)。新版 CDN SDK (4 个独立文件, 最大 248KB) 在 iv8 中正常加载。

### 8.7 问题 7: TCP 连接数限制

**现象**：iv8 初始化成功，但 a_bogus 在某些平台上长度是 0。

**原因**：Windows 平台的 curl_cffi 使用的线程池死锁 → 网络请求超时。

**解决**：sign.js 不使用真实的 HTTP — bdms 只拦截 URL，附加 a_bogus 后传给 mock 的 `window.fetch`。所以不需要真正的 HTTP 请求。

### 8.8 问题 8: Python 句法差异

**现象**：同样的参数在 Node.js 中生成 168 chars，Python 中调用 bug 导致长度不一致。

**原因**：Python 的 `urllib.parse.urlencode()` 对空格 +、百分比编码与 JavaScript 的 `encodeURIComponent()` 有细微差别。

**解决**：在 `urlencode` 时参数全部是简单字符串（无空格/特殊符），对齐输出。

---

## 9. 最终方案概述

### 9.1 两种可用方案

| | 方案 A: iv8 新版 SDK | 方案 B: iv8-v2 旧版 SDK |
|---|---|---|
| **目录** | `今日头条/iv8/` | `今日头条/iv8-v2/` |
| **SDK 版本** | 4-Module CDN (486KB) | 02_code.js 单体 (605KB) |
| **签名引擎** | iv8 C++ V8 | Node.js subprocess |
| **a_bogus 长度** | 160 chars | 168 chars |
| **初始化时间** | ~300ms (iv8 JSContext) | ~500ms (Node.js 冷启动) |
| **内存占用** | ~100MB (V8 heap) | ~80MB (Node.js heap) |
| **Python 依赖** | iv8 + requests | requests (subprocess Node.js) |
| **过期风险** | 低 (新版 CDN 地址保持) | 高 (旧版 SDK 随时可能被下线) |
| **推荐度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

### 9.2 架构图

```
┌─────────────────────────────┐
│    toutiao_api.py            │
│    (Python 主入口)            │
│                              │
│  ① POST ttwid register       │
│  ② GET API → x-ms-token     │
│  ③ signer.sign(params)       │
│     ├── 方案A: iv8 引擎       │
│     │   ├── stubs.js          │
│     │   ├── SDK 全链          │
│     │   └── fetch 拦截捕捉AB   │
│     └── 方案B: Node.js 引擎   │
│         ├── env_patch         │
│         ├── 02_code.js        │
│         └── bogus._u() 调用   │
│  ④ GET API + a_bogus          │
│     → JSON 15 篇文章          │
└─────────────────────────────┘
```

### 9.3 性能数据

| 步骤 | 方案 A (iv8) | 方案 B (Node.js) |
|------|:---:|:---:|
| SDK 初始化 | ~300ms | ~500ms |
| a_bogus 签名 | ~100ms | <10ms |
| HTTP 请求 (ttwid + msToken + API) | ~1.5s | ~1.5s |
| **总计** | **~2.0s** | **~2.0s** |

### 9.4 代码量

| 方案 | 总行数 | 自写代码 |
|------|:---:|:---:|
| 方案 A (iv8) | ~370 行 | ~250 行 Python + ~30 行 stubs |
| 方案 B (iv8-v2) | ~303 行 | ~150 行 JS + ~150 行 Python |

---

## 10. 代码详解

### 10.1 toutiao_api.py — 统一 API 入口

两种方案共享相同的 API 调用层。

```python
class ToutiaoFeed:
    """今日头条文章列表获取器"""

    def __init__(self):
        # 初始化签名器 (iv8 或 Node.js)
        self._signer = ToutiaoSigner()

        # HTTP Session (维护 ttwid cookie)
        self._session = requests.Session()
        self._session.headers.update({
            "user-agent": UA,
            "referer": "https://www.toutiao.com/",
            "accept-language": "zh-CN,zh;q=0.9",
            "accept": "application/json, text/plain, */*",
        })

    def _register_ttwid(self):
        """注册 ttwid 设备 ID (30天有效)"""
        self._session.post(
            "https://ttwid.bytedance.com/ttwid/union/register/",
            json={
                "region": "cn", "aid": 24,
                "needFid": False, "service": "www.toutiao.com",
                "migrate_info": {"ticket": "", "source": "node"},
                "cbUrlProtocol": "https", "union": True,
            },
        )

    def _get_mstoken(self, channel, page):
        """不带 a_bogus 请求 API，从响应头 x-ms-token 获取"""
        resp = self._session.get(
            "https://www.toutiao.com/api/pc/list/feed",
            params={
                "channel_id": channel, "max_behot_time": page,
                "category": "pc_profile_channel",
                "aid": "24", "app_name": "toutiao_web",
            },
        )
        return resp.headers.get("x-ms-token", "")

    def _generate_abogus(self, channel, page, ms_token):
        """调用签名器生成 a_bogus"""
        params = {
            "channel_id": channel, "max_behot_time": page,
            "category": "pc_profile_channel",
            "aid": "24", "app_name": "toutiao_web",
            "msToken": ms_token,
        }
        return self._signer.sign(params)

    def fetch(self, channel="3189398972", page="0"):
        """完整三阶段流程"""
        self._register_ttwid()
        ms = self._get_mstoken(channel, page)
        if not ms: return None

        ab = self._generate_abogus(channel, page, ms)
        if not ab: return None

        resp = self._session.get(
            "https://www.toutiao.com/api/pc/list/feed",
            params={
                "channel_id": channel, "max_behot_time": page,
                "category": "pc_profile_channel",
                "aid": "24", "app_name": "toutiao_web",
                "msToken": ms, "a_bogus": ab,
            },
        )
        if resp.status_code == 200 and len(resp.content) > 100:
            return resp.json()
        return None
```

### 10.2 sign.js — 旧版方案核心

```javascript
// 浏览器环境 (200行)
function Window() {}
// … 实例化 window/document/navigator/screen/location/history/
//     Storage/XMLHttpRequest/EventSource

// 加载旧版 SDK
eval(fs.readFileSync('02_code.js', 'utf-8'));
// → window.bogus 现已可用

// a_bogus 签名函数
function a_bogus(queryStr) {
    const r = global.bogus._v;  // 内部配置 [模式, 标记, 标记]
    const args = [
        0, 1, 8,               // 操作码参数
        queryStr,               // URL 参数
        "",                     // body (空)
        "Mozilla/5.0 ...",      // UA
    ];
    return global.bogus._u(r[0], args, r[1], r[2], null);
}
```

### 10.3 toutiao_iv8.py — 新版方案核心

```python
class ToutiaoSigner:
    def _build_context(self):
        # JSContext 初始化 (V8 引擎参数)
        ctx = iv8.JSContext(
            environment={
                "location": {"href": "https://www.toutiao.com/"},
                "navigator": {
                    "hardwareConcurrency": 32,   # 真机 CPU
                    "deviceMemory": 32,           # 真机内存
                    "colorDepth": 32,             # 不是 24
                    "webdriver": False,
                    ...
                },
                "screen": { "width": 1920, "height": 1080, ... },
            },
            config={"timezone": "Asia/Shanghai"},
        )
        # 共享 stubs
        ctx.eval(".claude/iv8/stubs.js")     # 440行通用补丁

        # toutiao 特有覆盖
        ctx.eval("currentScript = …")         # project-id=24
        ctx.eval("window.onwheelx = …")       # 头条特有
        ctx.eval("window.fetch = <mock>")     # 捕获 a_bogus

        # SDK 全链加载 (7个文件)
        ctx.eval("acrawler.js")
        ctx.eval("byted_acrawler.init({aid:24, dfp:true})")
        ctx.eval("window.module = { exports: {} }")
        ctx.eval("sdk-glue.js")
        ctx.eval("bdms.js")
        ctx.eval("runtime_bundler.js")
        ctx.eval("window._SdkGlueInit({...})")

    def sign(self, params_dict):
        query_str = urlencode(params_dict)
        result = ctx.eval(f"""
        (function() {{
            window._capturedABogus = null;
            window.fetch("https://www.toutiao.com/api/pc/list/feed?"
                         + {json.dumps(query_str)},
                         {{ method: 'GET' }});
            return window._capturedABogus;
        }})()
        """)
        return result or ""
```

### 10.4 stubs.js — 共享补丁

`.claude/iv8/stubs.js` 提供 440 行通用 iv8 补丁，分为 18 个模块：

| 模块 | 说明 | 致命等级 |
|------|------|:---:|
| 全局引用 | self = window; globalThis = window | 🔴 |
| MessageChannel | core-js Promise 的微任务调度 | 🔴 |
| setImmediate | polyfill 回退 | 🟡 |
| 事件系统 | addEventListener, ProgressEvent | 🔴 |
| performance.now() | SDK 内部计时 | 🟡 |
| DOM 元素工厂 | createElement (含 Canvas/WebGL) | 🔴 |
| DOM 关键节点 | body/documentElement/head getter | 🔴 |
| document 属性 | all, cookie, readyState, hidden | 🟡 |
| currentScript | SDK 框架读取 project-id | 🔴 |
| document.writeln | 远程模块注入 hook | 🔴 |
| Observers | MutationObserver, PerformanceObserver | 🟡 |
| Navigator 扩展 | plugins, mimeTypes, connection, userAgentData | 🟡 |
| 网络 API | Request, Response, Headers, XMLHttpRequest | 🔴 |
| Storage | localStorage, sessionStorage | 🟡 |
| 浏览器特有 | chrome, Intl | 🟡 |
| 多媒体/Worker | Image, Audio, OfflineAudioContext, Worker, Blob | 🔴 |
| Crypto | crypto.subtle stubs | 🟡 |
| fetch | 默认 mock (站点可覆盖) | 🔴 |

致命等级 ⚠️ 表示缺少此 stub 会导致 SDK 抛出异常；🟡 表示降级但不致命。

---

## 11. 可复用经验总结

### 11.1 逆向判定流程

```
1. 有旧版 SDK (单文件 webpack bundle)?
   ├─ YES → 先跑 env_patch (34 个属性通常就够)
   │      → 签名能过? → ✅ 完成
   │      → 签名不过? → 检查 ttwid/msToken 是否匹配
   └─ NO → 继续 2

2. SDK 入口是 JSVMP 字节码动态创建的?
   （判断：eval SDK 后 typeof window.<入口对象> === "undefined"，
    但浏览器里同 SDK 却有该对象 → 说明对象是字节码动态产出）
   ├─ YES → Node.js env_patch 无法解决 (typeof/instanceof/隐藏类差异
   │          会导致字节码分叉，永远到不了创建对象的 opcode)
   │      → 转 iv8 (C++ V8, 类型语义与浏览器一致)
   │      → 初始化成功? → 补 DOM stubs → ✅
   │      → 初始化失败? → 检查 module/exports 设置时机
   └─ NO → 继续 3

3. SDK 入口是静态 JS 赋值 (如 window.xxx = function(){}) ?
   → env_patch 即可

4. SDK 是 wasm-bindgen?
   → 用 wasm-reverse skill 生成 stub

5. SDK 是 Emscripten wasm2js?
   → Module._malloc + Module.cwrap = 一行 require
```

### 11.2 iv8 stub 优先级

1. **MessageChannel** — 99% 含 core-js 的 webpack bundle 都需要
2. **self = window** — ES5/ES6 混编 SDK 必备
3. **DOM stubs** (createElement, getElementsByTagName, body/getElement) — JSVMP init 必需
4. **document.currentScript** — 读取 project-id 的框架必需
5. **window.module/exports** — ⚠️ 必须在 JSVMP init 之后设置
6. **Worker + Blob + URL** — 异步加载模块的 SDK 需要

### 11.3 通用调试方法

```python
# 二分查找法定位 stub 冲突
for i in range(len(stubs)):
    ctx = new Context()
    ctx.eval(… stubs[:i] …)
    ctx.eval(acrawler_code)
    result = ctx.eval("typeof window.byted_acrawler")
    if result != "object":
        print(f"❌ Breaks at stub #{i}")
```


> 核心技术栈: iv8 v0.1.3 + Python 3.14 + Node.js 24.14.1  
> SDK 版本: @byted/secsdk-strategy v1.0.25 + bdms v1.0.1.7  
> 逆向时间: 2026-06-28
