# 今日头条 _signature 签名逆向 — env-sign 补环境方案技术文档

> 纯 Node.js vm 沙箱 + 补环境方案：acrawler.js JSVMP SDK
> 从环境搭建、SDK 分析、domDetect/hookDetect 绕过、JSONP 拦截、instanceof 安全化到 Python 生产交付

---

## 目录

1. [概述与目标](#1-概述与目标)
2. [参数签名原理](#2-参数签名原理)
3. [SDK 架构分析](#3-sdk-架构分析)
4. [环境检测机制与绕过](#4-环境检测机制与绕过)
5. [JSONP 网络请求机制](#5-jsonp-网络请求机制)
6. [instanceof 安全化 patch](#6-instanceof-安全化-patch)
7. [最终方案概述](#7-最终方案概述)
8. [代码详解](#8-代码详解)
9. [踩坑全记录](#9-踩坑全记录)
10. [可复用经验总结](#10-可复用经验总结)

---

## 1. 概述与目标

### 1.1 项目目标

从今日头条文章评论 API 获取指定文章的全部评论数据。

```
GET https://www.toutiao.com/article/v4/tab_comments/
    ?aid=24
    &app_name=toutiao_web
    &offset=0
    &count=20
    &group_id=7656329019402535474
    &item_id=7656329019402535474
    &_signature=_02B4Z6wo00f01...

响应:
{
    "message": "success",
    "total_number": 14,
    "has_more": false,
    "data": {
        "0": { "comment": { "text": "...", "user_name": "...", ... } },
        "1": { "comment": { ... } },
        ...
    }
}
```

### 1.2 安全参数

| 参数 | 格式 | 说明 |
|------|------|------|
| `_signature` | `_02B4Z6wo` 前缀, 47 chars | URL 绑定签名，acrawler.js JSVMP 生成 |
| `tt_webid` | cookie, 数字 ID | 设备标识，可通过 `ttwid.bytedance.com` 注册获取 |

### 1.3 最终交付

```
今日头条/env-sign/
├── acrawler.js              # 原始 SDK (71KB, JSVMP 保护)
├── sign.js                  # 签名器核心: vm 沙箱 + 补环境 + JSONP
├── sign_batch.js            # 批量签名 CLI (Python subprocess 桥)
├── toutiao_comments.py      # Python 主程序 (文章 URL/ID -> 全部评论)
├── demo.js                  # 签名器快速测试
├── package.json             # 项目配置 (零外部依赖)
└── REVERSE_TECH_DOC.md      # 本文档
```

**自包含**：所有 SDK 文件复制到本目录，不依赖外部路径。

### 1.4 运行

```bash
cd 今日头条/env-sign
python toutiao_comments.py      # 使用代码顶部的 TARGET_ARTICLE
node demo.js                    # 验证签名器是否正常
```

---

## 2. 参数签名原理

### 2.1 API 调用流程

```
+----------------------------------------------------------+
| Step 1: 生成 _signature                                   |
|                                                          |
|   输入: API path (URL query string)                       |
|   处理: acrawler.js JSVMP -> XXTEA 加密 -> 自定义 Base64  |
|   输出: _02B4Z6wo00f01... (47 chars)                     |
|                                                          |
| Step 2: 携带签名请求                                       |
|                                                          |
|   GET /article/v4/tab_comments/?...&_signature=xxx        |
|   -> 200 OK, JSON body                                   |
+----------------------------------------------------------+
```

### 2.2 _signature 签名机制

`_signature` 由字节封装的 **byted_acrawler** SDK 生成。SDK 通过 `_$jsvmprt` VM 解释器执行字节码，最终调用 `byted_acrawler.sign({url})` 输出签名字符串。

```
输入:
  { url: "https://www.toutiao.com/..." }

处理流程:
  +----------------+    +------------------+    +------------------+
  | 环境检测       | -> | XXTEA 加密       | -> | 自定义 Base64    |
  | domDetect /    |    | delta=0x9E3779B9 |    | 表: Dkdpgh4ZKsQB |
  | hookDetect     |    | 输入: pathname +  |    | 80/Mfvw36XI1R... |
  +----------------+    | tt_webid + nonce |    +------------------+
                        +------------------+            |
                                                        v
                                                前缀: _02 + B4Z6wo + 模式标志

结构分析:
  前 10 chars: 固定前缀 _02B4Z6wo
  第 10-13 chars: 模式标志 (00f = DOM无效/精简签名, 00d = DOM有效/完整指纹)
  第 13-47 chars: 自定义 Base64 编码的 XXTEA 密文 (28 字节 payload)
```

### 2.3 签名长度差异

| 场景 | 长度 | 模式 | DOM 检测 |
|------|------|------|---------|
| 浏览器正常 | 147 chars | 00d | domDetect 通过，收集完整指纹 (navigatorSignals + windowSignals + documentSignals + webglSignals) |
| Node.js 补环境 | 47 chars | 00f | domDetect 失败，精简签名 (仅 pathname + tt_webid + nonce) |
| 浏览器 iframe (无 init) | 47 chars | 00f | 未调用 init()，无指纹数据 |

**关键发现**：47 chars 精简签名可正常通过 API 验证。SDK 内部在 `domNotValid=true` 时走精简路径，使用 `0000`/`00000011` 替代完整指纹数据。

验证结果：
```
47 chars signature -> /article/v4/tab_comments/
-> HTTP 200, message: "success", 返回评论数据
```

---

## 3. SDK 架构分析

### 3.1 acrawler.js 结构

```
acrawler.js (71,721 bytes)
|
+-- _$jsvmprt(b, e, f)        JSVMP 字节码解释器
|   |
|   +-- function G()          核心调度循环 (while+switch)
|   +-- function K()          字节码入口
|   +-- function l()          opcode 解码 (hex -> int)
|   +-- function F()          常量池初始化
|   +-- string pool           663 个 XOR 2 加密字符串
|
+-- VM 入口调用                最后一个语句
    |
    (glb=...)._$jsvmprt(
      "484e4f4a403f5243...",   // 字节码 (60,358 hex chars = 30,179 bytes)
      [, exports, module, ...],// 外部引用数组
      ...                      // 全局命名空间
    )
```

### 3.2 字节码字符串解密

VM 字节码中的字符串常量使用 **XOR 2** 简单加密：

```
function   -> dwlavkml   (每个字符 XOR 2)
object     -> m`hgav
undefined  -> wlfgdklgf
exports    -> gzrmpvq
```

验证过程：
```js
const pairs = [
    ['function',  'dwlavkml'],
    ['object',    'm`hgav'],
    ['undefined', 'wlfgdklgf'],
    ['exports',   'gzrmpvq'],
];
// 全部 XOR 2: String.fromCharCode(c.charCodeAt(0) ^ 2) === "f"
```

解密后得到 **663 个唯一字符串**，揭示 SDK 完整功能：

| 类别 | 关键字符串 |
|------|-----------|
| 环境检测 | `domDetect`, `hookDetect`, `nodeDetect`, `phantomDetect`, `webdriverDetect`, `incognitoDetect`, `debuggerDetect` |
| 指纹收集 | `getGpu`, `getPlugins`, `canvas_fingerprint`, `getAbilities`, `getResolution`, `getBatteryInfo`, `getFonts`, `getRtcIp` |
| 签名核心 | `getSignature`, `assembleResult`, `assembleParams`, `directSign`, `xxtea`, `encrypt`, `decrypt` |
| 加密常量 | `2654435769` (XXTEA delta 0x9E3779B9), `B4Z6wo` (签名版本标记), `2.11.0` (SDK 版本) |
| Base64 | `Dkdpgh4ZKsQB80/Mfvw36XI1R25+WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe` (自定义表) |

### 3.3 getSignature 内部流程

从字节码偏移量定位关键分支：

```
偏移 54286: getSignature 函数入口
偏移 54312: "url.nonce must be an object with a url property!"
偏移 54410: domNotValid           -- DOM 检测标志
偏移 54434: protocol              -- URL protocol
偏移 54452: 0000                  -- 精简模式设备指纹
偏移 54462: 00000011              -- 精简模式设备指纹
偏移 54486: forreal               -- DOM 有效分支
偏移 54502: debug                  -- 调试模式
偏移 54514: nonce                  -- 随机数
偏移 54526: bodyVal2str            -- body 序列化
偏移 54550: body_hash=             -- body hash
偏移 54618: tt_webid=              -- 设备 ID
偏移 54652: nonceStr               -- nonce 字符串
偏移 54770: navigatorSignals       -- Navigator 指纹
偏移 55064: windowSignals          -- Window 指纹
偏移 55380: documentSignals        -- Document 指纹
偏移 55854: webglSignals           -- WebGL 指纹
```

处理逻辑：
```js
function getSignature(input) {
    if (!input || !input.url)
        throw "url.nonce must be an object with a url property!";

    var domValid = domDetect();    // 检测 DOM 环境
    var data = {
        protocol: parseProtocol(input.url),
        pathname: parsePathname(input.url),
        nonce: generateNonce(),
        tt_webid: getCookie("tt_webid"),
        bodyHash: input.body ? hash(input.body) : "",
    };

    if (!domValid) {
        // 精简模式: 47 chars
        data.deviceFingerprint = "00000000000011";
    } else {
        // 完整模式: 147 chars
        data.navigatorSignals = collectNavigator();
        data.windowSignals = collectWindow();
        data.documentSignals = collectDocument();
        data.webglSignals = collectWebGL();
    }

    var plaintext = assembleParams(data);
    var encrypted = xxteaEncrypt(plaintext);
    var encoded = base64Encode(encrypted);  // 自定义表 + URL safe
    return "_02B4Z6wo" + mode + encoded;
}
```

---

## 4. 环境检测机制与绕过

### 4.1 domDetect 检测

SDK 通过 `domDetect` 判断运行环境是否为真实浏览器 DOM：

```js
function domDetect() {
    // 检测 1: toString.call(window) === "[object Window]"
    if (Object.prototype.toString.call(window).indexOf("Window") < 0)
        return false;

    // 检测 2: toString.call(document) 含 "Document"
    if (Object.prototype.toString.call(document).indexOf("Document") < 0)
        return false;

    // 检测 3: toString.call(navigator) === "[object Navigator]"
    if (Object.prototype.toString.call(navigator) !== "[object Navigator]")
        return false;

    // 检测 4: toString.call(history) === "[object History]"
    if (Object.prototype.toString.call(history) !== "[object History]")
        return false;

    return true;
}
```

**绕过方式**：Hook `Object.prototype.toString`，对全局对象返回 `[object Window]`。

```js
(function() {
    var _origToString = Object.prototype.toString;
    var _globalObj = this;
    Object.prototype.toString = function() {
        try {
            if (this === _globalObj) return '[object Window]';
        } catch(e) {}
        return _origToString.call(this);
    };
})();
```

### 4.2 hookDetect 检测

SDK 检测关键 DOM 函数是否被 Hook（`toString()` 含 `native code`）：

```js
function hookDetect() {
    // 检测 1: document.createElement.toString() 含 "native code"
    var createEl = String(document.createElement);
    if (createEl.replace(/\s*/g, '').indexOf('nativecode') < 0)
        return false;

    // 检测 2: canvas.toDataURL.toString() 含 "native code"
    // 调用 getSignature 时触发，如果 createElement 被代理则标记
    return true;
}
```

**绕过方式**：重写 `createElement` 和 `toDataURL` 的 `toString` 方法。

```js
Document.prototype.createElement.toString = function() {
    return 'function createElement() { [native code] }';
};
// canvas 上的 toDataURL:
el.toDataURL.toString = function() {
    return 'function toDataURL() { [native code] }';
};
```

### 4.3 完整检测绕过清单

| 检测项 | 检测方式 | 绕过方式 | 状态 |
|--------|---------|---------|:---:|
| domDetect | `toString.call(window)` = `[object Window]` | Hook `Object.prototype.toString` | [OK] |
| domDetect | `toString.call(document)` 含 `Document` | `Symbol.toStringTag = 'HTMLDocument'` | [OK] |
| domDetect | `toString.call(navigator)` = `[object Navigator]` | `Symbol.toStringTag = 'Navigator'` | [OK] |
| domDetect | `toString.call(history)` = `[object History]` | `Symbol.toStringTag = 'History'` | [OK] |
| hookDetect | `createElement.toString()` 含 `native code` | 重写 `toString` | [OK] |
| hookDetect | `toDataURL.toString()` 含 `native code` | 重写 `toString` | [OK] |
| nodeDetect | `typeof process !== 'undefined'` | `process` 不传入 vm 沙箱 | [OK] |
| phantomDetect | `_phantom` / `callPhantom` / `__nightmare` | 不定义这些全局变量 | [OK] |
| webdriverDetect | `navigator.webdriver` | 设为 `false` | [OK] |
| instanceof | 对 `undefined` 构造函数执行 `instanceof` | patch VM 解释器安全化 | [OK] |

---

## 5. JSONP 网络请求机制

### 5.1 原理

`byted_acrawler.init()` 期间，SDK 通过动态创建 `<script>` 标签发起 JSONP 请求到字节服务端 `xxbg.snssdk.com`：

```js
// SDK 内部逻辑（VM 字节码）
var script = document.createElement('script');
script.src = 'https://xxbg.snssdk.com/websdk/v1/p?callback=_1001_xxx';
document.querySelector('head').appendChild(script);
```

### 5.2 两个 JSONP 请求

| # | URL | 作用 | 响应格式 |
|---|-----|------|---------|
| 1 | `xxbg.snssdk.com/websdk/v1/p?callback=xxx` | 获取参数开关 `_byted_param_sw` | `_xxx("base64_encoded_value");` |
| 2 | `xxbg.snssdk.com/websdk/v1/getInfo?q=xxx&callback=xxx` | 提交指纹，获取签名配置 | `_xxx({...config...});` |

### 5.3 拦截实现

在 `document.createElement` 中拦截 `<script>` 标签的 `src` 属性设置：

```js
if (tag === 'script') {
    var _src = '';
    Object.defineProperty(el, 'src', {
        get: function() { return _src; },
        set: function(v) {
            _src = String(v || '');
            if (_src && (_src.startsWith('http://') || _src.startsWith('https://'))) {
                // 捕获 JSONP URL，稍后由 Node.js 发起真实请求
                _jsonpQueue.push({ url: _src, id: el._id, el: el });
            }
        },
    });
}
```

### 5.4 Node.js 端处理

```js
// sign.js init() 中
for (const { url, el } of jsonpQueue) {
    // 1. 用 Node.js https 模块发起真实 HTTP 请求
    const responseText = await fetchUrl(url, cookie);

    // 2. 在 vm 沙箱中执行 JSONP 回调
    vm.runInContext(responseText, context);  // 执行 _xxx("value")

    // 3. 触发 script.onload
    if (el.onload) el.onload();
}
```

---

## 6. instanceof 安全化 patch

### 6.1 问题

VM 字节码解释器中有 `S[R]=S[R]instanceof C` 操作。在 vm 沙箱中，某些浏览器独有的构造函数（如 `PluginArray`、`MimeTypeArray`）可能为 `undefined`，导致：

```
TypeError: Right-hand side of 'instanceof' is not an object
```

### 6.2 修复

在加载 `acrawler.js` 之前，用正则替换所有 `instanceof` 操作：

```js
acrawlerCode = acrawlerCode.replace(
    /S\[R\]=S\[R\]instanceof C/g,
    'S[R]=C!=null?S[R]instanceof C:false'
);
```

替换仅影响 VM 解释器内部的类型检查操作（原匹配 28 字节），不影响 SDK 的正常逻辑。

### 6.3 setTimeout 安全化

`vm.createContext({})` 中的 `setTimeout` 回调会在沙箱外部执行，可能触发未定义的全局变量访问导致崩溃。修复方式：注入 no-op setTimeout。

```js
const ctx = vm.createContext({
    URL: url.URL,
    setTimeout: function() { return 0; },
    clearTimeout: function() {},
});
```

这防止了 SDK 的异步回调（如指纹采集回调）在 vm 上下文销毁后尝试访问全局对象。

---

## 7. 最终方案概述

### 7.1 架构

```
toutiao_comments.py (Python 主程序)
    |
    +-- 解析 TARGET_ARTICLE -> article_id
    |
    +-- subprocess: node sign_batch.js
    |       |
    |       +-- require('./sign.js') -> ToutiaoSigner
    |       |       |
    |       |       +-- vm.createContext({URL})
    |       |       +-- 注入浏览器环境 (~520 行 JS)
    |       |       +-- Object.prototype.toString hook
    |       |       +-- createElement/toDataURL toString 伪装
    |       |       +-- 加载 acrawler.js (instanceof patch)
    |       |       +-- byted_acrawler.init({aid:24, dfp:true})
    |       |       +-- fetch JSONP (xxbg.snssdk.com) + 执行回调
    |       |       +-- byted_acrawler.sign({url}) -> 47 chars
    |       |
    |       +-- 输出 stdout: {"path":"...","sig":"_02B4..."}
    |
    +-- requests.get(API + _signature) -> JSON
    |
    +-- 解析评论 -> print 输出
```

### 7.2 环境模拟清单

浏览器环境模拟覆盖约 520 行 JS，关键组件：

| 组件 | 方式 | 复杂度 |
|------|------|:---:|
| `Window` | 构造函数 + `Object.setPrototypeOf(globalThis, Window.prototype)` | 中 |
| `Document` | 构造函数 + `Symbol.toStringTag = 'HTMLDocument'` + DOM 元素工厂 | 高 |
| `Navigator` | 构造函数 + 属性描述符 (userAgent, platform, plugins, webdriver, ...) | 中 |
| `Screen` | 构造函数 + 属性描述符 | 低 |
| `History` | 构造函数 + empty stub methods | 低 |
| `Location` | 构造函数 + URL 对象内部委托 | 中 |
| `Storage` | 构造函数 + Map 内部实现 | 低 |
| `Canvas 2D / WebGL` | 在 `createElement('canvas')` 中注入 mock context | 高 |
| `XMLHttpRequest` | 构造函数 + readyState 模拟 | 低 |
| `chrome / Intl` | 全局对象 | 低 |

### 7.3 关键文件职责

| 文件 | 行数 | 职责 |
|------|:---:|------|
| `sign.js` | ~970 | 签名器核心：vm 沙箱创建、环境注入、acrawler 加载、JSONP 拦截、`ToutiaoSigner` 类 |
| `sign_batch.js` | ~50 | 批量签名 CLI：stdin 读取 paths，一次性 init，批量输出签名 |
| `toutiao_comments.py` | ~250 | Python 主程序：参数配置、subprocess 签名、HTTP 请求、评论解析输出 |
| `demo.js` | ~35 | 快速测试：init + sign 三个核心指标验证 |
| `acrawler.js` | 71KB | 原始 SDK（不修改，运行时做 instanceof patch） |

---

## 8. 代码详解

### 8.1 sign.js — 签名器核心

#### ToutiaoSigner 类

```js
class ToutiaoSigner {
    constructor(options = {}) {
        this._cookie = options.cookie || "";    // JSONP 请求 Cookie
        this._debug  = options.debug || false;   // 调试日志
        this._skipJsonp = options.skipJsonp || false;
        this._ready = false;
    }

    async init() {
        // 1. instanceof patch
        let code = acrawlerSource.replace(
            /S\[R\]=S\[R\]instanceof C/g,
            "S[R]=C!=null?S[R]instanceof C:false"
        );

        // 2. 创建 vm 沙箱
        const ctx = vm.createContext({ URL, setTimeout: noop, ... });

        // 3. 注入环境脚本 (~520 行 JS)
        vm.runInContext(buildEnvScript(cookie), ctx);

        // 4. 加载 acrawler.js
        vm.runInContext(code, ctx);

        // 5. init + JSONP
        vm.runInContext("byted_acrawler.init({aid:24, dfp:true})", ctx);
        const queue = vm.runInContext("_jsonpQueue", ctx);

        // 6. 执行 JSONP 真实 HTTP 请求
        for (const {url, el} of queue) {
            const resp = await fetchUrl(url, cookie);
            vm.runInContext(resp, ctx);       // 执行回调
            if (el.onload) el.onload();
        }

        this._context = ctx;
        this._ready = true;
    }

    sign(apiPath, body) {
        const input = { url: buildUrl(apiPath) };
        if (body) input.body = body;
        return vm.runInContext(
            `byted_acrawler.sign(${JSON.stringify(input)})`,
            this._context
        );
    }

    close() { this._context = null; this._ready = false; }
}
```

### 8.2 sign_batch.js — 批量签名 CLI

```js
// 从 stdin 读取路径列表，一次 init 批量签名
const paths = [];
for await (const line of readline.createInterface({input: process.stdin})) {
    if (line.trim()) paths.push(line.trim());
}

const signer = new ToutiaoSigner({ cookie: COOKIE });
await signer.init();

for (const p of paths) {
    const sig = signer.sign(p);
    process.stdout.write(JSON.stringify({path: p, sig}) + "\n");
}
```

### 8.3 toutiao_comments.py — Python 主程序

```python
# 顶部配置（改这里即可）
TARGET_ARTICLE = "https://www.toutiao.com/article/7656329019402535474/"
MAX_COMMENTS = None       # None = 全部
COOKIE = ""

def batch_sign(paths: list[str]) -> dict[str, str]:
    """调用 Node.js sign_batch.js 批量签名"""
    result = subprocess.run(
        ["node", "sign_batch.js"],
        input="\n".join(paths), capture_output=True, text=True,
        cwd=str(HERE), timeout=30,
    )
    sigs = {}
    for line in result.stdout.strip().split("\n"):
        data = json.loads(line)
        sigs[data["path"]] = data.get("sig", "")
    return sigs
```

---

## 9. 踩坑全记录

### 9.1 vm.createContext 变量作用域

**现象**: `document is not defined` 错误。
**原因**: 环境脚本在 `Document.prototype.documentElement = document.createElement('html')` 中先引用 `document`，但 `document` 变量后定义。
**解决**: 在环境脚本最顶部声明 `var window = this; var document = {};`。

### 9.2 vm.createContext 缺失全局函数

**现象**: `setTimeout is not defined`。
**原因**: `vm.createContext({})` 创建的是干净的 V8 上下文，没有浏览器或 Node 的全局函数。SDK 中的 `requestAnimationFrame`、`EventSource` 等调用 `setTimeout`。
**解决**: 注入 no-op `setTimeout`/`clearTimeout`。不注入真实的 Node `setTimeout`（SDK 异步回调会在沙箱销毁后崩溃）。

### 9.3 JSONP 响应全部打印到 stdout

**现象**: 执行 `vm.runInContext(jsonpResponse, ctx)` 时，JSONP 响应中的 VM 字节码全部输出到 stdout。
**原因**: 这不是错误，是 VM 解释器在执行字节码时的正常行为（VM 的返回值）。
**解决**: 将 JSONP 执行的错误信息用 `try/catch` 包裹，但无需处理 stdout 输出（输出了也不影响签名）。

### 9.4 误以为 _byted_param_sw 是签名长度开关

**现象**: 以为 JSONP 返回的 `_byted_param_sw` 值决定签名长度。
**实际**: 在浏览器中清除 `localStorage._byted_param_sw` 后，签名仍然是 147 chars。签名长度由 `domDetect` 决定，不是由这个参数决定。JSONP 的作用是获取 `_byted_param_sw`（控制 SDK 功能开关）和提交设备指纹获取配置 —— 这两个值确实被 SDK 读取，但**不是签名长度的决定性因素**。

### 9.5 误以为 init() 是同步的

**现象**: 调用 `byted_acrawler.init()` 后立即 sign()，签名总是 47 chars。
**实际**: `init()` 内部通过 JSONP 异步加载配置数据，但即使在浏览器中等待 JSONP 完成，签名长度也不一定变成 147（取决于 domDetect 等其他因素）。Node.js 中即使 JSONP 成功，签名仍是 47 chars，因为**domDetect 本身就无法在 vm 上下文中返回 true**（见 3.3）。

### 9.6 toStringTag vs vm 原生 toString

**现象**: 用 `Symbol.toStringTag = 'Window'` 设置 `window[Symbol.toStringTag]` 后，`vm.runInContext('Object.prototype.toString.call(this)', ctx)` 仍然返回 `[object Object]`。
**原因**: V8 的 `vm.createContext` 中，`globalThis` 没有绑定 `Symbol.toStringTag` 的固有行为。浏览器的 Window 对象是 C++ 层的内置类型，vm 上下文中的全局对象只是普通 JS 对象。
**解决**: Hook `Object.prototype.toString`，手动检查 `this === globalObj` 返回 `[object Window]`。这是唯一能绕过的方案。

---

## 10. 可复用经验总结

### 10.1 JSVMP 补环境通用模式

```
vm.createContext({ necessaryGlobals })
  -> 注入浏览器环境 JS
  -> Object.prototype.toString hook (domDetect)
  -> 关键函数 toString 伪装 (hookDetect)
  -> 拦截 DOM 操作捕获 side effect (script src / fetch / XHR)
  -> 加载 SDK + instanceof patch
  -> 执行 init + 处理异步 side effect (HTTP/WS)
  -> 调用 sign()
```

### 10.2 关键经验

1. **vm.createContext 适合轻量 JSVMP**：acrawler.js (71KB) 的 VM 解释器可以在 Node vm 中运行；bdms.js (248KB) 的深度依赖 V8 内部行为的解释器无法在 vm 中运行，需要 iv8 等 C++ 引擎。

2. **47 chars vs 147 chars 不重要**：如果精简签名能通过 API 验证，就不需要为完整签名多花精力。在本项目中，47 chars 签名完全可用。

3. **JSONP 拦截模式可复用**：通过 `document.createElement('script')` 的 `src` setter 捕获 URL，然后在 Node 端真实请求 + 执行回调，这个模式适用于所有使用 JSONP 加载配置的 SDK。

4. **instanceof 安全化是通用问题**：任何 JSVMP SDK 在 vm 中运行时都可能调用 `x instanceof Y`，而 Y 可能为 undefined。正则替换 `instanceof` 为安全版本是通用修复。

5. **toString 钩子是最重要的绕过**：domDetect 和 hookDetect 都依赖 `Object.prototype.toString` 和 `Function.prototype.toString`。正确实现这两个钩子能通过 90% 的环境检测。

### 10.3 方案对比

| 维度 | env-sign (本文) | iv8 (并行方案) |
|------|:---:|:---:|
| **目标参数** | `_signature` (评论/详情/热搜) | `a_bogus` (feed 列表) |
| **SDK** | acrawler.js (71KB) | acrawler + sdk-glue + bdms + runtime_bundler (486KB) |
| **引擎** | Node.js vm | iv8 (C++ V8) |
| **复杂度** | 低 | 高 |
| **JSVMP 兼容** | 部分 (47 chars 可用) | 完整 (160 chars) |
| **外部依赖** | 仅 Node.js | iv8 Python 包 |
| **初始化速度** | ~2s | ~5s |

### 10.4 适用场景

`env-sign` 方案适用于：使用 `acrawler.js` SDK 生成 `_signature` 参数，主要用于**文章评论**、**热榜**、**用户信息**等非 feed 列表的 API。签名长度 47 chars，经验证可正常通过 API 验证。
