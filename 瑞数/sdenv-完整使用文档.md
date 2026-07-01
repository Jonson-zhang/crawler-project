# sdenv 完整使用文档

> 版本: v1.1.3 | 作者: [pysunday](https://github.com/pysunday) | 许可证: BSD-3-Clause

---

## 一、sdenv 是什么

**sdenv** 是一个 JavaScript 运行时补环境框架，专门针对**瑞数（Rivers Security, RS）VMP** 反爬虫产品设计。它基于 [jsdom](https://github.com/jsdom/jsdom) 的 DOM 仿真能力，通过 **C++ V8 Addon + 魔改 jsdom** 实现了与真实浏览器高度一致的执行环境。

### 一句话概括

> sdenv = 魔改 jsdom（绕过 RS VMP 对 jsdom 的检测） + C++ V8 Addon（解决 `typeof`/原型链/hidden class 引擎层差异） + browser() 注入（Chrome 浏览器指纹）

### 与原生 jsdom 的关键区别

| | 原生 jsdom | sdenv |
|---|---|---|
| **VMP 检测** | 会被检测（20+ 种方式） | **绕过** — sdenv-jsdom fork 修补了检测向量 |
| **引擎层** | 纯 JS 层模拟 | **C++ V8 Addon**（`typeof`/原型链天然正确） |
| **Canvas** | 无 | **内置 node-canvas**（C++ 真实渲染） |
| **Cookie 一致性** | 与浏览器不一致 | **可配置到完全一致**（配合 `dateAndRandom` handler） |

---

## 二、项目生态

sdenv 由 4 个仓库组成完整体系：

```
┌─────────────────────────────────────────────────┐
│                   sdenv                         │
│           (补环境框架 — 主仓库)                    │
│    browser() + jsdomFromUrl() + jsdomFromText()  │
└────────┬───────────────┬────────────────────────┘
         │               │
    ┌────▼─────┐    ┌────▼──────────┐
    │sdenv-jsdom│    │ sdenv-extend  │
    │魔改 jsdom │    │ 扩展 handler  │
    │(v27.0.1) │    │ battery/conn  │
    │绕过检测   │    │ dateAndRandom  │
    └──────────┘    │ cookie/eval.. │
                    └───────────────┘
         │
    ┌────▼──────────┐
    │  rs-reverse   │
    │ 纯算法逆向 VM │
    │ makecookie/   │
    │ makecode      │
    └───────────────┘
```

| 仓库 | npm 包 | 用途 |
|------|--------|------|
| [sdenv](https://github.com/pysunday/sdenv) | `sdenv` | 主框架，提供 `jsdomFromUrl`/`jsdomFromText`/`browser()` |
| [sdenv-jsdom](https://github.com/pysunday/sdenv-jsdom) | 随 sdenv 安装 | jsdom v27.0.1 的 fork，修补了 RS VMP 对 jsdom 的检测 |
| [sdenv-extend](https://github.com/pysunday/sdenv-extend) | `sdenv-extend` | 扩展 handler：`dateAndRandom`（固定随机数）、`battery`、`connection`、`cookie`、`eval` 等 |
| [rs-reverse](https://github.com/pysunday/rs-reverse) | `rs-reverse` | 纯算法逆向工具：`makecookie`（生成 cookie）、`makecode`（还原 VM 代码） |

---

## 三、核心原理

### 3.1 RS6 挑战流程

```
浏览器请求 /steel
  → HTTP 202（RS6 挑战页面）
  → 页面包含：
      <meta content="..." />           ← 环境指纹种子
      <script>$_ts={nsd:..., cd:...}</script>  ← VM 配置
      <script src="/xxx.js"></script>  ← RS6 VM 字节码解释器（~175KB）
  → VM 初始化 → 采集环境指纹 → while(1) 解释执行字节码
  → Huffman + AES + CRC32 → Base64 → document.cookie
  → location.replace 跳转 → 服务器验证 Cookie → 200
```

### 3.2 sdenv 如何让 VM 在你控制下执行

```
Python                          sdenv (Node.js)
──────                          ──────────────
subprocess.run("node ...")  →   jsdomFromUrl("https://www.ouyeel.com/steel")
                                  │
                                  ├─ sdenv-jsdom 加载页面
                                  ├─ C++ V8 Addon 提供浏览器 API
                                  ├─ RS6 VM 在"以为自己是 Chrome"的环境中运行
                                  ├─ 字节码解释 → document.cookie 被写入
                                  ├─ sdenv:exit 事件触发
                                  │
cookieJar.getCookieStringSync() ←─ 提取 Cookie
                                  │
requests.get(..., cookies=...)  →  携带 Cookie 请求业务 API
```

### 3.3 为什么 sdenv 能过 RS VMP 检测

**第一层：sdenv-jsdom（绕过 jsdom 检测）**

RS VMP 有超过 20 种方式检测 jsdom：
- `navigator.webdriver` 存在性
- `document.all` 的 `typeof` 结果
- 原型链上的 `Symbol.toStringTag`
- `instanceof` 检查
- 构造函数 `name` 属性
- ……

sdenv-jsdom fork 修补了这些检测向量，使 jsdom "看起来像 Chrome"。

**第二层：C++ V8 Addon（引擎层对齐）**

纯 JS 层的补环境无法解决的差异：
- `typeof` 操作符的行为差异
- 原型链的 hidden class（V8 内部优化结构）
- 属性描述符（`getOwnPropertyDescriptor`）的精确行为
- `Function.prototype.toString` 的 `[native code]` 检测

sdenv 的 C++ Addon 在 V8 引擎层实现这些 API，与真实 Chrome 行为一致。

**第三层：`browser()` 注入（指纹对齐）**

```javascript
const { browser } = require('sdenv');
browser(window, 'chrome');
// → 注入 Chrome 特有属性：
//   - navigator.userAgent
//   - navigator.plugins / mimeTypes
//   - screen.width/height/colorDepth
//   - chrome.runtime / chrome.loadTimes
//   - ……
```

---

## 四、安装

### 4.1 前置依赖

| 依赖 | 版本 | 说明 |
|------|------|------|
| **Node.js** | v20.10+（推荐 v20.19.5） | v21.x 不兼容 |
| **Python** | 3.x | node-gyp 编译需要 |
| **C++ 编译工具** | Visual Studio 2022（勾选"使用 C++ 的桌面开发"） | Windows |
| **node-gyp** | 最新版 | `npm i -g node-gyp` |

### 4.2 Node.js 版本兼容性

| Node 版本 | 状态 | 备注 |
|-----------|:----:|------|
| v20.19.5 | ✅ | 开发主力版本 |
| **v21.x** | **❌** | **不兼容！** |
| v22.21.1 | ✅ | |
| v23.11.1 | ✅ | |
| v24.12.0 | ✅ | |
| v25.2.1 | ✅ | |

### 4.3 安装步骤

```bash
# 1. 确认 Node.js 版本
node -v  # 应输出 v20.x 或 v22+（不能是 v21.x）

# 2. 全局安装 node-gyp
npm install -g node-gyp

# 3. 创建项目并安装 sdenv
mkdir my-project && cd my-project
npm init -y
npm install sdenv

# 4. （可选）安装扩展包
npm install sdenv-extend
```

### 4.4 Docker 方式（免编译）

```bash
# arm64
docker pull pysunday/sdenv-arm64:latest
docker run --rm -v $(pwd):/app pysunday/sdenv-arm64:latest node /app/myscript.js

# x86_64
docker pull pysunday/sdenv-x86_64:latest
docker run --rm -v $(pwd):/app pysunday/sdenv-x86_64:latest node /app/myscript.js
```

### 4.5 全局 CLI 方式

```bash
npm install sdenv -g
sdenv https://target-site.com  # 快速测试
```

---

## 五、API 参考

### 5.1 核心 API

#### `browser(window, type)`

将浏览器特征注入 `window` 对象。

```javascript
const { browser } = require('sdenv');
browser(window, 'chrome');  // 目前仅支持 'chrome'
```

注入内容包括：
- `navigator` 下的 Chrome 特有属性
- `screen` 分辨率
- `chrome.runtime`、`chrome.loadTimes` 等
- `window` 下的扩展属性

#### `jsdomFromUrl(url, config?)`

加载 URL 并返回 jsdom 兼容对象。

```javascript
const { jsdomFromUrl } = require('sdenv');

const dom = await jsdomFromUrl('https://example.com/page', {
    userAgent: 'Mozilla/5.0 ... Chrome/143 ...',
    consoleConfig: { error: () => {} },  // 静默 JS 错误
});

const { window, cookieJar } = dom;
// window — jsdom window 对象（含 sdenv 增强）
// cookieJar — jsdom Cookie Jar（管理 Set-Cookie）
```

**配置选项：**

| 选项 | 类型 | 说明 |
|------|------|------|
| `userAgent` | string | 浏览器 UA（**必须与后续 Python 请求一致**） |
| `referrer` | string | Referer 头 |
| `contentType` | string | 内容类型 |
| `runScripts` | string | `"outside-only"` 阻止 HTML 内联脚本自动执行 |
| `consoleConfig` | object | `{ error: fn }` — 控制 JS 错误输出 |
| `cookieJar` | object | 重用已有的 Cookie Jar（保持会话状态） |

**Cookie 延续用法：**

```javascript
const config = { userAgent: ua, consoleConfig: { error: () => {} } };

const dom1 = await jsdomFromUrl('https://host/page1', config);
const dom2 = await jsdomFromUrl('https://host/page2', {
    ...config,
    cookieJar: dom1.cookieJar,  // 延续会话
});
```

#### `jsdomFromText(html, config?)`

从 HTML 文本创建 jsdom 环境。

```javascript
const { jsdomFromText } = require('sdenv');

const dom = await jsdomFromText(`
    <!DOCTYPE html>
    <html><body>
        <script>/* RS6 VM 代码 */</script>
    </body></html>
`, {
    url: 'https://example.com',
    runScripts: 'dangerously',  // 允许执行内联脚本
});
```

**额外返回值：**
- `dom.sdenv` — sdenv 内部对象
- `dom.getInternalVMContext()` — 返回内部 V8 context，可用于 `vm.runInContext`

#### jsdom 子 API

```javascript
const { jsdom } = require('sdenv');
const { ResourceLoader, agentFactory, Request } = jsdom;
// → 直接访问底层 jsdom，自定义资源加载行为
```

### 5.2 页面事件

sdenv 在 `window` 上暴露自定义事件，用于监听页面生命周期：

```javascript
// 监听 location.replace 跳转
window.addEventListener('sdenv:location.replace', () => {
    console.log('RS6 VM 触发了跳转');
});

// 监听 location.assign 跳转
window.addEventListener('sdenv:location.assign', () => {
    console.log('页面导航');
});

// 监听页面退出（RS6 VM 执行完毕的信号）
window.addEventListener('sdenv:exit', () => {
    console.log('RS6 VM 执行完成');
    // 此时 document.cookie 已写入
});
```

**标准的 RS6 Cookie 生成模式：**

```javascript
const dom = await jsdomFromUrl(targetUrl, config);
const { cookieJar, window } = dom;

// 等待 VM 执行完成
await new Promise(resolve => {
    window.addEventListener('sdenv:exit', () => resolve());
    setTimeout(resolve, 15000);  // 兜底超时
});

const cookies = cookieJar.getCookieStringSync(targetUrl);
```

### 5.3 Window Proxy 配置

在 JS 执行前配置属性访问行为：

```javascript
sdenv.getConfig('window')({
    // 读取时抛出异常
    windowGetterErrorKeys: ['process', 'require'],
    // 读取时返回 undefined
    windowGetterUndefinedKeys: ['_runScripts', 'webdriver'],
    // 访问日志
    log: (type, prop) => console.log(`[${type}] window.${prop}`),
    // 拦截并修改返回值
    parse: (type, prop, value) => {
        if (prop === 'userAgent') return 'modified UA';
        return value;
    },
});
```

---

## 六、sdenv-extend 扩展

### 6.1 初始化

```javascript
const SdenvExtend = require('sdenv-extend');

// 在 jsdom 窗口内初始化
const ext = new SdenvExtend({}, window);

// 此后可通过 window.sdenv 链式调用 handlers
```

### 6.2 Handler 速查

| Handler | 功能 | 典型用法 |
|---------|------|---------|
| `dateAndRandom` | **核心** — 固定 `Math.random()` 和 `Date` 值 | 实现与浏览器完全一致的 Cookie |
| `battery` | 模拟电量状态 | `'charging_success'` |
| `connection` | 模拟网络环境 | `{ effectiveType: '4g', rtt: 0 }` |
| `cookie` | 监控 `document.cookie` 读写 | 调试用 |
| `eval` | 监控 `eval` 调用，移除 `debugger` | 防反调试 |
| `timeout` | 监控 `setTimeout`，可覆写延迟时间 | 加速/控制执行 |
| `interval` | 监控 `setInterval` | 同上 |
| `window` | Window Proxy 配置 | 已内嵌，无需手动开启 |

### 6.3 核心用法示例

```javascript
const SdenvExtend = require('sdenv-extend');

// 初始化
const ext = new SdenvExtend({}, window);

// 链式配置
window.sdenv
    .getHandle('battery')('charging_success')
    .getHandle('connection')({ effectiveType: '4g' })
    .getHandle('eval')()
    .getHandle('cookie')({ log: true });

// 运行时动态调整
sdenv.getConfig('window')({ log: true });

// 访问原始对象
const originalWindow = sdenv.memory.window;     // handler 处理前的 window
const nativeInterval = sdenv.memory.setInterval; // 原生 setInterval
```

### 6.4 实现与浏览器完全一致的 Cookie

```javascript
const SdenvExtend = require('sdenv-extend');

// 1. 在真实浏览器中采集运行时数据
//    在浏览器 DevTools 断点处执行：
//    copy(sdenv.utils.getDateData(copy))
//    导出到 datas.json

const datas = require('./datas.json');

// 2. 在 sdenv 中固定随机数和日期
new SdenvExtend({}, window);
window.sdenv.getHandle('dateAndRandom')({
    datas: datas,
    randomReturn: 0.5,  // 固定 Math.random() 返回值
});

// 3. 现在运行 RS6 VM，生成的 Cookie 将与浏览器完全一致
```

### 6.5 环境检测属性

```javascript
const SdenvExtend = require('sdenv-extend');
const ext = new SdenvExtend({});

console.log(ext.isNode);   // true (纯 Node) / false (VM)
console.log(ext.envType);  // "node" / "browser"
```

### 6.6 通用工具方法

```javascript
// 函数包装
sdenv.tools.wrapFunc(originalFn, wrapper);

// 属性监控
sdenv.tools.monitor(obj, 'propertyName');
```

---

## 七、通用使用模板

### 7.1 最小 RS6 Cookie 生成器（50 行）

```javascript
#!/usr/bin/env node
/**
 * sdenv RS6 Cookie 生成器 — 通用模板
 *
 * 新站点只改 3 个值: url, entryPath, userAgent
 */
const { jsdomFromUrl } = require('sdenv');

async function main() {
    // ═══ 配置 ═══
    const BASE = 'https://example.com';
    const PATH = '/challenge-page';           // 返回 202/412 的路径
    const UA = 'Mozilla/5.0 ... Chrome/143...';

    const dom = await jsdomFromUrl(BASE + PATH, {
        userAgent: UA,
        consoleConfig: { error: () => {} },
    });
    const { cookieJar, window } = dom;

    await new Promise(r => {
        window.addEventListener('sdenv:exit', () => r());
        setTimeout(r, 15000);
    });

    const cookies = cookieJar.getCookieStringSync(BASE);

    process.stdout.write(JSON.stringify({
        success: !!cookies && cookies.length > 100,
        cookies: cookies || null,
    }));
    setTimeout(() => process.exit(0), 300);
}

main().catch(e => {
    process.stdout.write(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
});
```

### 7.2 Python 调用模板（30 行）

```python
import json
import re
import subprocess
from pathlib import Path

def get_cookies(js_file: Path, site_url: str, entry_path: str) -> dict:
    """调用 sdenv 获取 RS6 Cookie"""
    cfg = json.dumps({"url": site_url, "entryPath": entry_path})

    result = subprocess.run(
        ["node", str(js_file), cfg],
        capture_output=True, text=True, timeout=30,
        cwd=str(js_file.parent),
    )

    # 从 stdout 中提取 JSON（可能混有 sdenv 日志）
    match = re.search(r'\{.*"success".*\}', result.stdout, re.DOTALL)
    if not match:
        raise RuntimeError(f"sdenv 无有效输出: {result.stderr[:200]}")

    return json.loads(match.group())

# 使用
data = get_cookies(
    Path("generate.js"),
    "https://www.ouyeel.com",
    "/steel"
)
cookies = data["cookies"]  # "T0k1m0u5AfREO=xxx; T0k1m0u5AfREP=yyy"
```

---

## 八、与 iv8 的对比与选择

| 维度 | sdenv | iv8 |
|------|-------|-----|
| **语言层** | Node.js（跨进程 subprocess） | Python（同进程 `import iv8`） |
| **初始化时间** | ~500ms-2s（页面加载 + VM执行） | ~3ms（JSContext 创建） |
| **环境完整性** | 接近完整（jsdom + C++ Addon） | 部分（需 ~440 行 stubs.js 补） |
| **事件循环** | ✅ Node.js 原生事件循环 | ❌ 同步 `ctx.eval()`，无事件循环 |
| **HTTP 重定向** | ✅ `jsdomFromUrl` 内置 | ❌ 无 HTTP 客户端 |
| **Cookie Jar** | ✅ 内置 | ❌ 无，需手动管理 |
| **Canvas** | ✅ 真实 C++ node-canvas | ❌ JS mock（`toDataURL` 返回空） |
| **部署** | 需 `npm install sdenv`（~30MB） | 需 `uv add iv8`（轻量 Python 包） |
| **Node.js 兼容** | ⚠️ v21 不兼容 | ✅ 无 Node.js 依赖 |
| **Windows 编译** | ⚠️ 需 VS + node-gyp | ✅ 预编译 wheel |

### 选择决策树

```
需要执行的 JS 是什么？
├─ 完整 RS6 VM（while(1) 字节码解释器）
│   → sdenv（iv8 会卡死）
│
├─ 需要 HTTP 重定向链（302/412→200）
│   → sdenv（iv8 没有 HTTP 客户端）
│
├─ 需要 Cookie Jar 自动管理
│   → sdenv
│
└─ 调用单个签名函数（ABC().z() 或 VMP 签 x-s）
    ├─ Node.js 补环境行不通（3 轮天花板）
    │   → iv8（同进程，3ms 调用）
    └─ Node.js 补环境可行
        → iv8 或直接 Node.js subprocess
```

---

## 九、sdenv 不只适用于瑞数 — 能力边界与应用场景

### 9.1 sdenv 的能力分层

sdenv 是为瑞数开发的，但它的底层能力远超瑞数场景。本质上 sdenv 是一个「**不被检测出来的高仿真 JS 运行时**」：

```
┌─────────────────────────────────┐
│   瑞数专项优化层                  │
│   Huffman / AES / CRC32 /       │
│   Base64 算法兼容                │
├─────────────────────────────────┤
│   通用浏览器环境层                │
│   魔改 jsdom + C++ V8 Addon +   │
│   browser() Chrome 注入          │
│   → 任何 JS 都能运行且不被        │
│     检测出是模拟环境              │
└─────────────────────────────────┘
```

**sdenv 解决的是「JS 层」的问题，管不了「网络层」的事情：**

```
网络栈（sdenv 管不了）           JS 引擎（sdenv 的核心能力）
──────────────────              ─────────────────────
TCP 握手                         浏览器 API（window / document）
TLS 指纹                         DOM 操作
HTTP/2 指纹                      V8 引擎特性（typeof / 原型链 / hidden class）
IP 信誉                          Canvas 指纹
请求频率                         事件循环
Cookie 加密（AES/HMAC/...）       动态 JS 执行
```

### 9.2 按反爬类型的适用性速查

| 反爬类型 | 代表产品/参数 | sdenv | 说明 |
|---------|-------------|:---:|------|
| **RS VMP** | 瑞数 4/5/6 | ✅ | 原生支持，最稳定 |
| **JSVMP 动态入口** | Boss直聘 `__zp_stoken__`、今日头条 `a_bogus` | ✅ | 能跑，但通常会选更轻量的 iv8（同进程 3ms） |
| **JS 挑战注入** | JSL 加速乐 `__jsl_clearance` | ⚠️ | 官方声明不支持（JSL 的检测逻辑与 RS 不同），但社区有人成功 |
| **设备指纹计算** | 腾讯系 `_qimei_`、阿里系 `umdata`、字节系 `ttwid` | ✅ | 只要能抠出计算 JS，sdenv 就能跑 |
| **WAF 人机验证** | Cloudflare 5 秒盾、阿里云 WAF | ❌ | 在 HTTP/TLS 层拦截，不到 JS 层 |
| **视觉验证码** | 极验、顶象、网易易盾 | ❌ | 需要图像识别/行为模拟，不是 JS 执行问题 |
| **TLS 指纹** | Cloudflare TLS、Akamai TLS | ❌ | sdenv 是 JS 运行时，管不到 TLS 层 |
| **CDP 反检测** | 检测 `navigator.webdriver` | ✅ | sdenv 的 `browser()` 注入自动将 `webdriver` 设为 `false` |

### 9.3 决策速查：遇到问题该用什么

| 现象 | 根因层 | 工具 |
|------|--------|------|
| `$_ts.nsd` + `$_ts.cd` 在 HTML 里 | JS 层 | ✅ **sdenv** `jsdomFromUrl()` |
| 需要 `eval()` 加密 JS 生成签名 | JS 层 | ✅ sdenv 可以，但 **iv8 更快** |
| `requests.get()` 返回 403 + WAF HTML | 网络层 | ❌ 换 `curl_cffi` |
| 拿到的 Cookie 正确但 API 拒绝 | TLS 层 | ❌ 换 `curl_cffi` + 伪装 JA3 指纹 |
| Canvas 指纹必须真渲染 | JS 层 | ✅ **sdenv** 内置 node-canvas |
| 过滑块验证码 | 视觉层 | ❌ 上自动化浏览器（Camoufox/Playwright） |
| JS 在 Node.js 里结果与浏览器不一致 | JS 引擎层 | ✅ **sdenv**（C++ V8 Addon） 或 **iv8** |
| 页面 302 跳转到 RS 挑战页 | HTTP 层 + JS 层 | ✅ **sdenv** `jsdomFromUrl` 自动处理 |
| 每次请求返回新 Cookie 挑战 | JS 层 + 网络层 | ✅ **sdenv** 生成 → **curl_cffi** 发送 |

### 9.4 一句话总结

> sdenv 的本质是「高仿真 JS 运行时」，瑞数是它验证最多的场景，但不是唯一能用的。**只要问题出在「JS 代码在非浏览器环境里运行结果不对」，sdenv 就是候选方案**。问题出在 TLS/HTTP 层就换 `curl_cffi`，问题出在视觉就上自动化浏览器。

---

## 十、故障排查

### 9.1 `npm install sdenv` 失败

```bash
# 症状: node-gyp rebuild 报错
# 原因: 缺少 C++ 编译工具链

# Windows 解决:
# 1. 安装 Visual Studio 2022 Community
# 2. 勾选 "使用 C++ 的桌面开发"
# 3. npm install -g node-gyp
# 4. 重试 npm install sdenv

# 如果仍然失败，尝试清理缓存:
npm cache clean --force
npm install sdenv --verbose
```

### 9.2 Cookie 始终为空

```javascript
// 排查步骤:

// ① 打开错误日志
const dom = await jsdomFromUrl(url, {
    userAgent: ua,
    // 临时启用错误输出，看 VM 哪里报错
    // consoleConfig: { error: console.error },
});

// ② 确认返回 202/412（RS6 挑战页面）
// curl -sI https://目标 | head -5

// ③ 确认页面包含 $_ts.cd
// curl -sL https://目标 | grep '$_ts.cd'

// ④ 检查 UA 是否与真实 Chrome 一致

// ⑤ 确认 Node.js 版本不是 v21.x
```

### 9.3 sdenv:exit 触发了但 Cookie 为空

```
可能原因:
1. Cookie 名变了 → curl 看 Set-Cookie 确认
2. RS6 版本升级了 → 检查 $_ts 结构是否变化
3. TLS 指纹被拦截 → 需要代理中转
```

### 9.4 TLS Renegotiation 报错

```
Error: write EPROTO ... wrong version number
```

**原因**: 目标站点使用旧版 OpenSSL，Node.js v17+ 不再支持。

**解决**: 使用代理中转
```bash
set HTTPS_PROXY=http://127.0.0.1:8888
node generate_cookies.js
```

### 9.5 sdenv 返回 Cookie 但 Python 请求失败

**自检清单：**

```
[ ] Cookie 是否完整传递（S + P 两个都传了？）
[ ] User-Agent 是否和生成 Cookie 时一致？
[ ] Referer 头是否设置？
[ ] Sec-Fetch-Site: same-origin 等 Fetch Metadata 头是否带上？
[ ] requests 的 TLS 指纹是否被检测？
    → 换 curl_cffi（支持 TLS 指纹伪装）
```

---

## 十一、rs-reverse 补充说明

对于需要**深入理解 RS6 VM 内部原理**的场景，`rs-reverse` 是纯算法逆向工具：

```bash
npx rs-reverse makecookie -u https://target-site.com/path
```

| 子命令 | 功能 |
|--------|------|
| `makecode` | 从 URL/文件提取 VM 配置，生成动态代码 |
| `makecookie` | 纯算法生成 Cookie（不依赖 jsdom） |
| `makecode-high` | 处理两阶段请求站点 |
| `exec` | 在逆向后的 VM 上下文中执行表达式 |

**适配新站点需要编写 `basearr` 适配器**（`src/handler/basearr/<name>.js`），大约需要 1 天时间。

---

## 十二、经验法则

1. **先 sdenv 后 rs-reverse**：sdenv 5 分钟能跑通 → 直接出 Cookie。sdenv 跑不通 → 用 rs-reverse 深入逆向。
2. **UA 一致性是硬要求**：sdenv 中用的 UA 必须与后续 Python 请求完全一致，否则 TLS + 指纹校验不通过。
3. **Cookie 名每个站点不同**：`curl -sI "https://目标" | grep Set-Cookie` 确认。常见格式：`XXXXO`（服务端）+ `XXXXP`（JS 生成）。
4. **`sdenv:exit` 是可靠信号**：RS6 VM 执行完成后必然触发，比 `setTimeout` 兜底更准。
5. **Cookie 过期需重新生成**：不要缓存超过有效期的 Cookie。每次 Python 运行时重新调 `generate_cookies.js`。
6. **不要用 Node.js v21**：这是经过社区验证的不兼容版本。
7. **Canvas 编译失败可以用 Docker**：Windows 上 node-canvas 编译是最大坑，Docker 镜像一键解决。

---

## 十三、更新记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.1 | 2026-07-01 | 新增第九章「能力边界与应用场景」：反爬类型速查表、问题决策表、适用范围说明 |
| 1.0 | 2026-07-01 | 完整初始版本：基于 GitHub README、社区评测、兰州交通大学 & 欧冶实战经验 |
