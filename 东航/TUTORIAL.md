# 东航机票爬虫 — 逆向工程全技术点教程

> 从零开始，逐步拆解每一个技术细节。读完你会理解 **WASM 白盒 AES**、**Emscripten wasm2js**、**TLS 指纹**、**WAF Cookie 绑定**、**浏览器桥接** 等核心概念，并能自己写出类似代码。

---

## 目录

1. [目标 API 与请求结构](#1-目标-api-与请求结构)
2. [WASM 是什么 / 白盒 AES 为什么不能提取密钥](#2-wasm-是什么--白盒-aes-为什么不能提取密钥)
3. [Emscripten wasm2js — 没有 .wasm 文件怎么办](#3-emscripten-wasm2js--没有-wasm-文件怎么办)
4. [在 Node.js 中加载浏览器 JS 模块（环境补丁）](#4-在-nodejs-中加载浏览器-js-模块环境补丁)
5. [加密 payload 的结构和 transactionId](#5-加密-payload-的结构和-transactionid)
6. [Python 与 Node.js 进程通信（subprocess + stdin）](#6-python-与-nodejs-进程通信subprocess--stdin)
7. [WAF 三层防线：TLS 指纹 → IP/UA → Cookie 绑定](#7-waf-三层防线tls-指纹--ipua--cookie-绑定)
8. [CloakBrowser 是什么 / 为什么会选它](#8-cloakbrowser-是什么--为什么会选它)
9. [浏览器桥接：Cookie 保鲜 + API 调用合并在一个 Session](#9-浏览器桥接cookie-保鲜--api-调用合并在一个-session)
10. [SPA 页面轮换问题与 ctx.pages 轮询](#10-spa-页面轮换问题与-ctxpages-轮询)
11. [端到端流程总结](#11-端到端流程总结)
12. [踩过的坑与止损规则](#12-踩过的坑与止损规则)

---

## 1. 目标 API 与请求结构

东航移动端搜索机票的 API：

```
POST https://m.ceair.com/m-base/sale/shoppingv2
Content-Type: application/json
M-CEAIR-ENCRYPTED: true
X-CEAIR-OS: M

{"req": "base64 编码的加密字符串"}
```

响应也是加密的：

```json
{
  "code": 200,
  "res": "base64 编码的加密字符串"
}
```

### 1.1 怎么发现这个 API 的？

打开 Chrome DevTools → Network 面板 → 在手机版东航网站搜索 "上海 → 北京" → 在 XHR/Fetch 请求列表中找到 `shoppingv2`。

**关键判断**：
- 请求体是 `{"req":"..."}` —— 这是加密的标志，纯文本 JSON 不会用 base64 包裹
- 响应体是 `{"res":"..."}` —— 同理，加密响应
- 请求头 `M-CEAIR-ENCRYPTED: true` —— 明确告诉服务端 "我加密了"

### 1.2 怎么找到加密逻辑？

在 DevTools 中搜索关键词 `shoppingv2`：

```
Sources → 全局搜索 → "shoppingv2"
```

结果会指向某个打包后的 JS 文件。在调用 `fetch('/m-base/sale/shoppingv2', ...)` 的附近，你会看到：

```js
// 伪代码示意（实际是混淆后的）
var encrypted = wbsk_AES_cbc_encrypt_base64(JSON.stringify(payload), iv);
fetch('/m-base/sale/shoppingv2', {
    method: 'POST',
    body: JSON.stringify({ req: encrypted })
});
```

**搜索技巧**：搜索 API 路径名，而不是搜索 "encrypt"。找到网络请求的发起点，再逆向追踪加密调用链。

---

## 2. WASM 是什么 / 白盒 AES 为什么不能提取密钥

### 2.1 WASM 基础

WebAssembly (WASM) 是一种二进制指令格式，可以在浏览器中以接近本机速度运行 C/C++/Rust 代码。

```
C/C++ 源码 → LLVM/Clang → .wasm 二进制 → 浏览器 WASM 虚拟机执行
```

### 2.2 白盒 AES

传统 AES：密钥是一个 16/24/32 字节的数组，可以轻松提取。

**白盒 AES**：将密钥融合到查表 (lookup table) 中。加密过程变成一系列查表操作，密钥被「溶解」在几百 KB 的大表里，无法逆向提取。

```
传统 AES:      data + key → encrypt → cipher
白盒 AES:      data + (若干大查表) → encrypt → cipher
                              ↑
                            密钥嵌入在表中，无法分离
```

**这意味着**：我们不能用 Python 的 `Crypto.Cipher.AES` 来复现加密。必须在 Node.js 中执行完整的 WASM 模块——让 WASM 替我们做加密。

### 2.3 AES-CBC 与固定 IV

CBC 模式需要一个 16 字节的初始化向量 (IV)。东航的 IV 是硬编码的：

```js
// sign.js
const IV = [121, 96, 7, 103, 57, 95, 61, 124, 121, 96, 7, 103, 57, 95, 61, 124];
```

**怎么找到 IV 的？** 在浏览器中给 `wbsk_AES_cbc_encrypt` 函数打条件断点，在调用时检查传入的 IV 参数（`arguments[4]`）。

---

## 3. Emscripten wasm2js — 没有 .wasm 文件怎么办

### 3.1 两种 WASM 方案

| 方案 | 产物 | 如何识别 |
|------|------|---------|
| 标准 WASM | `.wasm` 二进制 + JS 胶水代码 | Network 面板有 `.wasm` 请求 |
| **Emscripten wasm2js** | 纯 JS 文件 (~1MB) | 没有 `.wasm` 请求，JS 文件很大且包含 `asm` / `Module` / `HEAP` 等关键字 |

东航用的是 **wasm2js**——C/C++ 编译到 WASM 后再转为 JavaScript。

### 3.2 如何识别 wasm2js？

在 Network 面板中搜索 `wasm`：
- 找到 `.wasm` 文件 → 标准 WASM，用 `wasm-objdump -x` 提取类型
- **找不到** `.wasm` 文件 → 可能是 wasm2js

在 Sources 面板搜索 `Module["asm"]` 或 `HEAP8`：
- 找到 → wasm2js（Emscripten 把整个 WASM 运行时翻译成了 JS）
- 找不到 → 可能是其他方案

### 3.3 wasm2js 的导出函数

因为是 Emscripten 体系，函数通过 `Module.cwrap` 注册。在 `wbsk_skb_orig.js`（浏览器原始代码）里能看到类似：

```js
// 实际代码比这复杂，这是简化示意
var wbsk_AES_cbc_encrypt = Module.cwrap('wbsk_AES_cbc_encrypt', 'number', 
    ['array', 'number', 'number', 'number', 'array', 'number']);
var wbsk_AES_cbc_encrypt_base64 = function(str, iv) { ... };
```

函数签名来自 C 源码编译时的元数据（不是手动猜测）：

```
ECB:  (input:Uint8Array, inlen:number, outaddr:pointer, lenaddr:pointer) → number
CBC:  (input:Uint8Array, inlen:number, outaddr:pointer, lenaddr:pointer,
       iv:Uint8Array, ivlen:number) → number
```

`salesChannel: '7701'` 等固定字段**通过抓包对比找到**——用浏览器访问一次，复制请求体，解密后看到这些字段，然后写死在加密代码里。

---

## 4. 在 Node.js 中加载浏览器 JS 模块（环境补丁）

### 4.1 挑战

`wbsk_Wbox.js` 和 `wbsk_skb_orig.js` 是为浏览器环境写的。直接在 Node.js `require()` 会报错（缺少 `window`、`document` 等）。

### 4.2 为什么不需要补浏览器环境

Emscripten wasm2js 自动检测运行环境：

```js
// Emscripten 内部的检测逻辑（伪代码）
if (typeof process === 'object' && typeof require === 'function') {
    // Node.js 环境 → ENVIRONMENT_IS_NODE = true
    // 使用 fs、path 等 Node API 来加载文件
} else if (typeof window === 'object') {
    // 浏览器环境
}
```

因为是 **白盒 AES**（密钥在代码中），WASM 函数不需要 `crypto.subtle`、`Canvas`、`WebGL` 等浏览器 API。

### 4.3 两行代码完成加载

```js
// sign.js — 核心的两行
global.Module = require('./wbsk_Wbox.js');
vm.runInThisContext(fs.readFileSync('wbsk_skb_orig.js', 'utf8'));
```

**第一行 `global.Module = require(...)`**：
- `wbsk_Wbox.js` 是 wasm2js 编译产物
- 它在底部有 `module.exports = Module`（Emscripten 为 Node.js 生成的标准出口）
- 赋给 `global.Module` 是因为 `wbsk_skb_orig.js` 在被 `vm.runInThisContext` 执行时，会在全局作用域中访问 `Module`

**第二行 `vm.runInThisContext(...)`**：
- 这是 Node.js 的 `vm` 模块，在**当前全局作用域**中执行一段 JS
- `wbsk_skb_orig.js` 引用 `Module`（全局变量），我们已在上一行设置好了
- `wbsk_skb_orig.js` 执行后，会在全局作用域中创建 `wbsk_AES_cbc_encrypt_base64` 等函数

### 4.4 `require()` vs `vm.runInThisContext()` 的区别

```js
// require() 的问题：
// 每个 require 的文件有独立的模块作用域
// wbsk_skb_orig.js 里的 var xxx 不会暴露到 sign.js

// vm.runInThisContext() 的优势：
// 在全局作用域执行，就像 <script> 标签一样
// wbsk_skb_orig.js 里的函数会变成全局变量
// sign.js 可以直接调用 encryptPayload / decryptPayload 等函数
```

---

## 5. 加密 payload 的结构和 transactionId

### 5.1 完整 payload

```js
// sign.js — encryptPayload()
function encryptPayload(data) {
    const payload = Object.assign({}, data, {
        salesChannel: '7701',   // 固定值，PC 端不同
        moduleX: 'mShopping',   // 固定值
        os: 'M',                // Mobile
        language: 'zh',
        appVersion: '99.0.0',
        transactionId: genTxId(),
    });
    return {
        req: wbsk_AES_cbc_encrypt_base64(JSON.stringify(payload), IV),
    };
}
```

`genTxId()` 生成格式：`05` + 时间戳 + 随机数

```js
function genTxId() {
    return '05'
        + new Date().toISOString()
            .replace(/[T\-:]/g, '')       // 去掉 T、-、:
            .replace(/\.[\d]{3}Z/, '')    // 去掉毫秒和 Z
        + String(Math.ceil(10000 * Math.random()));  // 4 位随机
}
// 例: 0520260621080530145678
```

### 5.2 `crawler.py` 中构造的 payload

```python
# crawler.py — search()
payload = {
    "currentQueryType": "FLIGHT_LIST",  # 搜索航班列表
    "currentSegIndex": 0,
    "language": "zh",
    "selectedRoutes": [],
    "productType": "CASH",
    "routes": [{
        "arrCode": "BJS",          # 到达城市代码
        "depCode": "SHA",          # 出发城市代码
        "flightDate": "20260629",  # 日期 YYYYMMDD
        "arrCodeType": "1",
        "depCodeType": "1",
        "depCityName": "上海",      # 出发城市中文名
        "arrCityName": "北京",      # 到达城市中文名
        "segIndex": 0,
        "leftInner": "",
        "rightInner": "",
    }],
    "tripType": "OW",              # One Way 单程
    "cabinGrade": "",              # 不指定舱位
}
```

### 5.3 如何发现 payload 结构？

**方法**：不用猜，直接在浏览器 Network 中复制一次成功请求的 payload，用解密函数解密看明文结构。

```bash
# 1. 从浏览器 Network 复制 enc_req
# 2. 用 sign.js 解密
echo 'base64_encrypted_text' | node sign.js decrypt
# 输出: 明文的 payload 结构
```

---

## 6. Python 与 Node.js 进程通信（subprocess + stdin）

### 6.1 为什么用子进程而不是 HTTP 服务？

直接 `subprocess` 调用比启动一个 HTTP 服务简单得多。加密/解密是同步的纯计算，HTTP 的异步开销是不必要的。

### 6.2 Python 侧：`_node()` 函数

```python
# crawler.py
def _node(cmd, data=""):
    p = subprocess.Popen(
        ["node", str(SIGN_JS), cmd],    # node sign.js encrypt
        cwd=str(SD),                     # 在东航/目录下执行
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out, err = p.communicate(
        input=data.encode() if data else None,
        timeout=30,
    )
    if p.returncode:
        raise RuntimeError(err.decode()[:500])
    return out.decode().strip()
```

**关键技术点**：
- `subprocess.Popen` 而不是 `subprocess.run`：Popen 允许通过 stdin 传入数据
- `p.communicate(input=...)`：向子进程的 stdin 写入，读取 stdout/stderr，等待进程结束
- `timeout=30`：防止子进程挂死
- `err.decode()[:500]`：取前 500 字符，避免错误信息过长

### 6.3 Node.js 侧：stdin 读取

```js
// sign.js — CLI 入口
if (cmd === 'encrypt') {
    let chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
        const input = Buffer.concat(chunks).toString().trim();
        const data = JSON.parse(input);
        console.log(JSON.stringify(encryptPayload(data)));
    });
}
```

**为什么用 `process.stdin.on('data/end')` 而不是一次性读取？**

因为 stdin 可能是分块到达的。`chunks` 数组收集所有块，在 `end` 事件时拼接。

### 6.4 完整加密调用链

```
crawler.py
  ├─ encrypt(payload)
  │   └─ _node("encrypt", json.dumps(payload))
  │       └─ subprocess: node sign.js encrypt
  │           └─ stdin → JSON payload
  │           └─ stdout ← {"req":"base64..."}
  │
  ├─ call_api(enc_req)
  │   └─ subprocess: python api_bridge.py enc_req
  │       └─ CloakBrowser → fetch() → stdout ← JSON response
  │
  └─ decrypt(enc_response)
      └─ _node("decrypt", enc_response)
          └─ subprocess: node sign.js decrypt
              └─ stdin → base64 string
              └─ stdout ← decrypted JSON
```

---

## 7. WAF 三层防线：TLS 指纹 → IP/UA → Cookie 绑定

东航的保护分为三层。每一层都用不同的技术，需要不同的绕过手段。

### 7.1 第一层：TLS 指纹 (JA3/JA4)

**是什么**：当你建立 HTTPS 连接时，Client Hello 报文会暴露你的 TLS 客户端特征——支持的加密套件列表、扩展列表、椭圆曲线等。不同的 HTTP 库和浏览器有不同的 TLS 指纹。

**东航做了什么**：在 TLS 握手阶段就检测：
- `Python requests`（底层 OpenSSL 的 TLS 指纹）→ 直接拒绝，连 WAF 页面都不返回
- `Node.js https`（Node.js 内建 TLS 的指纹）→ 部分可以通过第一层，但过不了第二层
- `Playwright` Chromium/Firefox → 某些版本被识别为自动化工具
- `Camoufox`/`CloakBrowser`（定制浏览器引擎）→ 通过

**为什么 Node.js `https` 也会被挡**：
- `acw_tc` Cookie 虽然可以通过 Node.js HTTPS 获取，因为它是作为 Set-Cookie 在 WAF 的 302 重定向中返回的
- 但 `ssxmod_itna` Cookie 是页面 JavaScript（Tongdun SDK）在浏览器中执行后生成的，它记录了浏览器指纹（Canvas、WebGL 等）和 **TLS 指纹**
- 后端验证时：`ssxmod_itna` 解码 → 得到 TLS 指纹 → 与当前连接的 TLS 指纹对比 → 不匹配 → 拒绝

### 7.2 第二层：IP + UA 风控

**踩过的坑**：同一个 IP 用同一个 User-Agent 频繁请求 → 加入黑名单。

**验证方法**：换一个 UA 重新测试。如果立刻恢复正常，说明只是 UA 被标记，不是 IP 被封。

### 7.3 第三层：Cookie 会话绑定

```
ssxmod_itna  ←── 绑定 ──→  TLS 指纹
ssxmod_itna  ←── 绑定 ──→  acw_tc (WAF 令牌)
ssxmod_itna  ←── 绑定 ──→  IP 地址
```

**这意味着**：
1. 不能从浏览器拿到 Cookie 后放到 Python/Node.js 中用——TLS 指纹变了
2. 必须**在获取 Cookie 的同一个浏览器上下文中**发送 API 请求
3. 这也是为什么最终方案是「浏览器桥接」——让浏览器替我们干所有需要 Cookie 的事情

---

## 8. CloakBrowser 是什么 / 为什么会选它

### 8.1 反检测浏览器的原理

普通 Chromium 有大量「自动化标记」：
- `navigator.webdriver === true`
- `window.chrome.runtime` 为 undefined
- CDP (Chrome DevTools Protocol) 检测
- 默认的 `navigator` 属性值与真实浏览器不同

Camoufox/CloakBrowser 在 **C++ 引擎层面** 修补了这些标记，使其不可被 JavaScript 检测。

### 8.2 尝试过的方案和失败原因

| 方案 | 结果 | 失败原因 |
|------|------|---------|
| Python `requests` | ❌ | TLS 指纹不通过（第一层） |
| Node.js `https` | ❌ | TLS 指纹 + 无法执行 JS 生成 ssxmod_itna |
| Playwright Chromium | ❌ | SPA 替换 page 导致 `TargetClosedError` |
| Playwright Firefox | ❌ | 同上 |
| Playwright `context.request.post()` | ❌ | TLS 指纹与浏览器页面内的 fetch 不同 |
| Camoufox MCP 手动 | ✅ | 但速度慢（两次浏览器启动） |
| **CloakBrowser + 单 Session** | ✅ | **最终方案** |

### 8.3 api_bridge.py 为什么作为独立子进程而不是 MCP？

```python
# crawler.py
def _venv():
    """返回装有 CloakBrowser 的 Python 路径"""
    venv = SD.parent / ".claude" / "mcp-servers" / ".venv" / "Scripts" / "python.exe"
    return str(venv) if venv.exists() else sys.executable

def call_api(enc_req):
    r = subprocess.run(
        [_venv(), str(API_BRIDGE), enc_req],
        capture_output=True, text=True, timeout=120, cwd=str(SD),
    )
```

`api_bridge.py` 作为子进程运行而不是 MCP 工具，原因：
1. MCP 工具有 context window 限制，不适合传输几十 KB 的加密响应
2. 子进程的 stdout 可以直接返回 JSON，简单可靠
3. `api_bridge.py` 可以独立调试：`python api_bridge.py "enc_req_base64"`

---

## 9. 浏览器桥接：Cookie 保鲜 + API 调用合并在一个 Session

这是整个方案的核心。

### 9.1 为什么不分成两个 Session？

最初（版本 1）用了两个 Session：

```
Session 1: 打开浏览器 → 访问页面 → 获取 ssxmod → 保存到文件 → 关浏览器
Session 2: 打开浏览器 → 读文件注入 Cookie → 加载页面 → fetch() → 关浏览器
```

**问题**：两次启动浏览器，每次 ~3-5s，总共 ~20-30s。

### 9.2 合并为单 Session 的关键

`ctx.add_cookies()` 可以在创建 page 之前注入 Cookie，然后在同一个浏览器上下文中执行 fetch：

```python
# api_bridge.py — 核心流程

# Step 1: 判断是否需要刷新
need_refresh = (Cookie 不存在 or 过期超过 25 分钟)

# Step 2: 打开浏览器（一次！）
b = launch(headless=True, locale="zh-CN")
ctx = b.new_context()

try:
    # Step 3: Cookie 保鲜（仅在需要时）
    if need_refresh:
        page = ctx.new_page()
        page.goto("https://m.ceair.com/mapp/Home")       # 触发 WAF
        page.goto("https://m.ceair.com/mapp/reserve/flightList")  # 触发 Tongdun SDK
        # 等待 ssxmod_itna Cookie 出现
        for i in range(20):
            if "ssxmod_itna" in [c["name"] for c in ctx.cookies()]:
                break
            page.wait_for_timeout(1000)
        # 保存到文件（下次复用）
        save_cookies(ctx.cookies())
        page.close()

    # Step 4: 注入 Cookie（读文件）
    cookies = load_cookies()
    ctx.add_cookies([
        {"name": k, "value": v, "domain": ".ceair.com", "path": "/"}
        for k, v in cookies.items() if v and not k.startswith("_")
    ])
    # 过滤掉 _refreshed_at 等元数据字段（它们不是真正的 Cookie）

    # Step 5: 在同一个 Session 中发 API 请求
    page = ctx.new_page()
    page.goto("https://m.ceair.com/mapp/reserve/flightList")
    resp = page.evaluate(fetch_js, enc_req)
    # ↑ 在浏览器页面内执行 JavaScript fetch()
    # TLS 指纹与获取 Cookie 时完全一致 → WAF 通过

finally:
    b.close()
```

### 9.3 为什么 `page.evaluate()` 的 fetch 能通过但 `context.request.post()` 不能？

```
ctx.add_cookies([...])         ← 设置了 Cookie
ctx.request.post(...)          ← 这是 CDP 层的请求，TLS 指纹来自浏览器引擎
                               ← 与页面内 JavaScript fetch() 的 TLS 指纹相同吗？
                               ← 取决于浏览器实现。在 Playwright 中，context.request 
                               ← 使用的是不同的 HTTP 栈，TLS 指纹可能不同
                               ← 东航 WAF 检测到了这个差异

page.evaluate("fetch(...)")    ← 这是页面内 JavaScript 发起的请求
                               ← TLS 指纹与获取 Cookie 时完全相同
                               ← ✅ 通过
```

---

## 10. SPA 页面轮换问题与 ctx.pages 轮询

### 10.1 问题

东航是一个 SPA (Single Page Application)。当通过 `page.goto()` 加载 `reserve/flightList` 时，页面的 JavaScript 会进行路由切换或页面重定向。原来的 `page` 对象可能会被替换，导致 `page.evaluate()` 抛出 `TargetClosedError`。

### 10.2 解决方案：遍历所有 page

```python
# api_bridge.py
resp = None
for attempt in range(3):           # 最多 3 次尝试
    for pg in ctx.pages:           # 遍历所有打开的页面
        if pg.is_closed():         # 跳过已关闭的
            continue
        try:
            resp = pg.evaluate(fetch_js, enc_req)
            break                   # 成功 → 跳出内层循环
        except Exception:
            time.sleep(1)           # 这个页面不行，等 1 秒试下一个
    if resp:                        # 成功 → 跳出外层循环
        break
    time.sleep(1)                   # 所有页面都不行，等 1 秒重试
```

**思路**：
1. SPA 可能创建多个 page（路由切换时 `window.open` 或 iframe）
2. 我们不知道 fetch 会在哪个 page 上成功
3. 解决方案：**全都试试**，取第一个成功的

### 10.3 `ctx.add_cookies()` 的作用范围

```python
ctx.add_cookies([...])  # 这些 Cookie 被绑定到整个 browser context
                        # context 下所有新创建的 page 都会继承这些 Cookie
```

---

## 11. 端到端流程总结

```
┌─────────────────────────────────────────────────────────────────┐
│ crawler.py                                                      │
│                                                                 │
│ [0/2] Encrypt                                                   │
│   payload → subprocess: node sign.js encrypt → enc_req (base64) │
│                                                                 │
│ [1/2] API                                                       │
│   enc_req → subprocess: python api_bridge.py enc_req            │
│     ┌─────────────────────────────────────────────┐             │
│     │ api_bridge.py (CloakBrowser)                │            │
│     │                                              │            │
│     │ if cookie_expired:                           │            │
│     │   Home → flightList → wait ssxmod → save     │   ~15s     │
│     │                                              │            │
│     │ ctx.add_cookies(saved)                       │            │
│     │ flightList → page.evaluate(fetch(...))        │   ~5s      │
│     │                                              │            │
│     │ → enc_response (base64)                      │            │
│     └─────────────────────────────────────────────┘             │
│                                                                 │
│ [2/2] Decrypt                                                   │
│   enc_response → subprocess: node sign.js decrypt → flights JSON│
│                                                                 │
│ show() → 打印航班列表                                             │
└─────────────────────────────────────────────────────────────────┘
```

**性能**：
- Cookie 新鲜时（25 分钟内）：~5-8 秒（加密 <0.1s + 浏览器 ~5s + 解密 <0.1s）
- Cookie 过期时：~15-18 秒（同上 + 首页导航 ~10s）

---

## 12. 踩过的坑与止损规则

### 12.1 Tongdun/TrustDecision 指纹 SDK 不可复现

下载并分析了 `tongdun_fm.js`、`trustdecision_normal.js`，尝试在 Node.js 中模拟运行 → 发现依赖 Web Worker、Canvas、WebGL、AudioContext 等。

**止损规则**：看到 `trustdecision.com` 或 `tongdun.net` 在 JS 加载列表 → **5 分钟内判走浏览器桥接路线**，不在 Node.js 补环境上浪费时间。

### 12.2 不要追踪旧博客的失效参数

搜索到 2025 年的文章提到 `FECU`、`X-Tingyun`、`hxk_fec` 等参数 → 当前站点所有脚本中均未找到 → 站点已升级，这些参数已废弃。

**止损规则**：旧文章提供方向，但**必须以当前 Network 面板的抓包为准**。文章说需要的参数如果当前页面没有，那就是不需要。

### 12.3 极简页面方案失败

曾经尝试：route.fulfill 返回空 HTML，只加载 WAF 脚本，用 add_init_script 注入 fetch。均因缺少完整 WAF 初始化上下文而失败。

**止损规则**：WAF 脚本有复杂的初始化依赖链，**直接访问真实页面比去理解它的依赖更快**。

### 12.4 Cookie 必须在生成它的同一个 TLS 上下文中使用

Node.js HTTPS 获取的 `acw_tc` + 浏览器获取的 `ssxmod_itna` + Node.js HTTPS 发请求 → **失败**。

**原因**：WAF 验证 Cookie 中的 TLS 指纹与当前连接的匹配性。

**止损规则**：包含 `ssxmod` / `itna` / 指纹 SDK 生成的 Cookie → **全部在浏览器内完成**，不能跨引擎使用。

---

## 附录 A：文件内容速查

```
东航/
├── crawler.py            # Python 主控：加密 → 浏览器调用 → 解密 → 展示
├── api_bridge.py         # CloakBrowser 子进程：Cookie 保鲜 + fetch API
├── sign.js               # Node.js WASM 环境：加密/解密 CLI
├── wbsk_Wbox.js          # Emscripten wasm2js 运行时（CDN 原始文件，~1MB）
├── wbsk_skb_orig.js      # 浏览器原始加密包装器（未修改）
├── cookies.json          # 缓存的浏览器 Cookie（自动生成）
└── config.json           # 默认 出发/到达/日期
```

## 附录 B：常用调试命令

```bash
# 测试加密（独立验证）
echo '{"routes":[{"depCode":"SHA","arrCode":"BJS","flightDate":"20260629"}]}' | node sign.js encrypt

# 测试解密（独立验证）
echo 'base64_encrypted_string' | node sign.js decrypt

# 测试浏览器桥接（独立验证）
python api_bridge.py "enc_req_base64"

# 完整搜索
python crawler.py SHA BJS 20260629

# 查看缓存的 Cookie
python -c "import json; print(json.load(open('cookies.json')))"
```

## 附录 C：关键 MCP 工具速查

本教程关联的工具链和对应的 MCP 服务器：

| MCP Server | 典型工具 | 教程中的对应环节 |
|-----------|---------|---------------|
| `camoufox-reverse` | `launch_browser`, `navigate`, `evaluate_js`, `cookies`, `list_network_requests` | 第 8-10 章 浏览器桥接 |
| `js-reverse` | `set_breakpoint_on_text`, `evaluate_script`, `list_network_requests`, `search_in_sources` | 第 1-3 章 定位加密逻辑 |
