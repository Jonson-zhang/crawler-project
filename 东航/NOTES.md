# 东航逆向全过程笔记

## 一、目标

- **网站**: m.ceair.com（东航移动端）
- **API**: `POST https://m.ceair.com/m-base/sale/shoppingv2`
- **加密**: WASM white-box AES-CBC
- **反爬**: Aliyun WAF + Tongdun/TrustDecision 指纹 SDK

## 二、技术发现

### WASM

- 类型: Emscripten wasm2js（非 wasm-bindgen）
- 文件: `wbsk_Wbox.js` (~1MB, C++→JS 编译)
- 导出: `wbsk_AES_cbc_encrypt`, `wbsk_AES_cbc_decrypt` 等 6 个函数
- IV: `[121,96,7,103,57,95,61,124,121,96,7,103,57,95,61,124]`
- Node.js 加载: `global.Module = require('./wbsk_Wbox.js')` 一行，无需补环境

### Cookie 体系

| Cookie | 来源 | 有效期 |
|--------|------|--------|
| `ssxmod_itna` | Tongdun/TrustDecision SDK 生成 | ~30 分钟 |
| `ssxmod_itna2` | 同 SDK 补充字段 | ~30 分钟 |
| `acw_tc` | Aliyun WAF 首页 Set-Cookie | ~30 分钟 |
| `acw_sc__v3` | WAF JS 挑战后生成 | ~30 分钟 |
| `_c_WBKFRo` | WAF 令牌 | ~1 年 |

关键: `acw_tc` + `ssxmod_itna` 必须来自同一浏览器会话，跨会话复制无效。

### 三层 WAF 防线

1. **TLS 指纹**: Python requests (OpenSSL TLS) 直接拦; Playwright Chromium/Firefox 被拒; Camoufox (定制 Firefox) ✅; CloakBrowser (定制 Chromium, 49 C++ 补丁) ✅
2. **IP + UA 风控**: 同一 IP 用 Chrome UA 多次请求→加入黑名单; 换 Edge UA 立刻正常
3. **Cookie 会话绑定**: Cookie 必须在生成它的同一浏览器会话中使用

## 三、方案演进

### 阶段 1: Python requests + Node.js (❌)

`crawler.py` + `sign.js` → Python requests 发请求 → WAF 拦截

### 阶段 2: Camoufox MCP 手动 (✅ 临时)

通过 MCP 工具在 Camoufox 浏览器中注入 script → fetch → localStorage → 解密

### 阶段 3: Playwright Firefox (❌)

刷新用 Python 子进程调用 Playwright → `page.evaluate(fetch)` → SPA 替换 page → 报 TargetClosedError

### 阶段 4: Playwright Chromium (❌)

同 Firefox, SPA 替换 page 问题依旧

### 阶段 5: Playwright context.request (❌)

`context.request.post()` → 返回 WAF HTML（TLS 指纹不匹配）

### 阶段 6: CloakBrowser v1 (✅ 部分)

`page.evaluate(fetch)` → 有的成功有的超时→SPA 问题未完全解决

### 阶段 7: CloakBrowser v2 — ctx.pages 轮询 (✅ 最终方案)

```python
# api_bridge.py 核心修复
for attempt in range(3):
    for pg in ctx.pages:
        if pg.is_closed(): continue
        try:
            resp = pg.evaluate(fetch_js, enc_req)
            break
        except Exception:
            time.sleep(1)
```

两个独立 CloakBrowser session: Session 1 刷新 Cookie → Session 2 注入 Cookie + 调用 API

## 四、弯路与止损规则

### 弯路 1: 分析 Tongdun/TrustDecision 指纹 SDK (~2h)

下载分析了 tongdun_fm.js / trustdecision_normal.js / tingyun-origin.js, 搜索 itna/FECU/FECA, Hook document.cookie, 尝试 jsdom 运行。

**结论**: SDK 依赖 Web Worker + Canvas + WebGL + AudioContext, 纯 Node.js 不可复现

**止损规则**: 看到 trustdecision.com / tongdun.net 在加载列表 → 5 分钟内判死, 直接走浏览器桥接

### 弯路 2: 追踪博客文章 FECU/X-Tingyun (~30min)

搜索 2025 年文章提到的 `FECU`/`X-Tingyun`/`hxk_fec` → 所有已加载脚本中均未找到 → 站点已升级

### 弯路 3: api_bridge.py 极简页面方案 (多次尝试)

route.fulfill 返回空 HTML; 只加载 WAF 脚本; 用 add_init_script 注入 fetch。均因缺少完整 WAF 初始化上下文而失败。

## 五、最终文件清单

```
东航/
├── crawler.py            # Python 主控
├── api_bridge.py         # CloakBrowser 桥（Cookie + API）
├── sign.js               # WASM AES-CBC 加解密
├── wbsk_Wbox.js          # Emscripten wasm2js 运行时
├── wbsk_skb_orig.js      # 浏览器原始加密包装器
└── config.json           # 出发/到达/日期
```

## 六、沉淀的记忆文件

- `.claude/memory/stop-loss-rules.md` — 3 条止损规则
- `.claude/memory/waf-tls-fingerprint.md` — WAF/TLS 诊断流程
- `.claude/memory/emscripten-wasm2js-pattern.md` — wasm2js 标准加载
- `.claude/memory/crawler-conventions.md` — emoji 禁用规范

## 七、运行

```bash
cd 东航
python crawler.py              # 读 config.json
python crawler.py 杭州 北京    # CLI 覆盖
```

Cookie 自动保鲜（过期自动刷新），无需手动操作。

## 八、iv8 方案研究（2026-06-29）

### 目标

用 iv8（Python C++ V8 引擎）替代 Node.js 子进程 **和** 浏览器自动化工具，
实现纯 Python 端到端方案。

### 已成功部分

#### 8.1 WASM 加解密（✅ 完全替代 Node.js）

| 验证项 | 结果 |
|--------|------|
| wbsk_Wbox.js (wasm2js) 在 iv8 WEB 模式下加载 | ✅ 零补丁 |
| Module.asm exports (17 个 AES 函数) | ✅ |
| encrypt/decrypt 与 Node.js sign.js 互操作 | ✅ 双向交叉兼容 |
| 速度 (iv8 vs Node.js subprocess) | ~70ms vs ~67ms，持平 |

关键发现: `wbsk_Wbox.js` 是 wasm2js（自带 `var WebAssembly = {...}` polyfill），
无需真实 WASM 引擎。`__iv8__.eventLoop.drain()` 推进 Promise 链后 `runtimeInitialized=true`。

文件: [iv8/ceair_iv8.py](iv8/ceair_iv8.py) — `CeairWasm` context manager

#### 8.2 iv8 API 探索

| iv8 API | 用途 | 状态 |
|---------|------|------|
| `page.load({baseURL, html, resources})` | 流式加载 HTML + 执行 `<script>` | ✅ 达到目的 |
| `netLog.entries` | 捕获 JS 发起的全部 XHR/fetch | ✅ 准确捕获 |
| `add_resource(url, body, status, headers)` | 注入离线响应到请求队列 | ✅ 需先 page.load 初始化 |
| `expose(data, name)` | Python→JS 数据桥接 | ✅ |
| `eventLoop.sleep(ms)` | 推进虚拟时间 | ✅ |
| `eventLoop.drain()` | 排空任务队列 | ✅ |

#### 8.3 Tongdun SDK 在 iv8 中运行

**链**: `monitor.js` → `fm.js` (TrustDeviceJs Pro v4.2.4) → `new Blob([workerCode])` → `URL.createObjectURL` → `new Worker(blobUrl)` → postMessage 指纹收集 → XHR 上报

| 步骤 | 结果 | 关键问题 |
|------|------|---------|
| fm.js (510KB) 加载 | ✅ | 需预先设置 `window._fmOpt` |
| URL.createObjectURL | ❌ iv8 CE 缺失 | → 写了 polyfill |
| Blob Worker 执行 | ❌ iv8 CE Worker 不支持 blob URL | → 写了 polyfill |
| Worker postMessage 双向通信 | ✅ polyfill 生效 | `["ECHO:HELLO","ECHO:WORLD"]` |
| 指纹收集 (Canvas/WebGL/Audio) | ⚠️ stub 返回空值 | 非真实设备指纹 |
| **blackbox token 生成** | ✅ | `tddfeyJ2IjoiNC4yLjQi...` |
| POST 到 `fp.tongdun.net` | ✅ | Python 实际发 HTTP 拿到 200 |
| Tongdun 服务器验证 | ❌ `code:074` "数据伪造" | **瓶颈所在** |
| `ssxmod_itna` Cookie | ❌ | 需服务器验证通过后才下发 |

**关键发现**: Tongdun 不在 JS 层检测环境（无 `navigator.webdriver` 检查、无原型链检测）。
它在**服务器端**分析上报的指纹数据 `data=CAQSkAzLx...`（Protocol Buffers）。
iv8 stub 返回的 Canvas/WebGL/Audio 值为随机/空值，被服务器 AI 识别为"伪造"。

Polyfill 文件: [iv8/iv8_polyfills.js](iv8/iv8_polyfills.js) — Blob Worker 完整 shim
测试脚本: [iv8/test_tongdun.py](iv8/test_tongdun.py) — 完整的 Tongdun SDK 在 iv8 中执行

### 三个后续路径

| 路径 | 可行性 | 说明 |
|------|--------|------|
| **A. iv8 Pro Edition** | 理论上 ✅ | Pro 版声称有真实 Canvas/WebGL/Audio 渲染。需购买、未验证。 |
| **B. 逆向 blackbox → Python 自签发** | 理论可行 | blackbox 格式 `tddf<base64>.protobuf`，其中可能含 ECC 签名。逆向后可 Python 自算。 |
| **C. 混合方案（推荐）** | ✅ 已验证 | iv8 做加解密（去 Node.js）+ DrissionPage 做 HTTP（留浏览器）。39 flights / 9.4s。 |

### 当前最佳实践: iv8 + DrissionPage 混合

```bash
# iv8 加密 + DrissionPage HTTP — 去掉 Node.js，保留浏览器
python iv8/test_hybrid.py 上海 北京 20260630
```

文件: [iv8/test_hybrid.py](iv8/iv8_test_hybrid.py) — iv8 做 encrypt/decrypt，dp/v1.0/api_bridge.py 做 HTTP

**与 dp/v1.0/test_drission.py 的区别**: 仅替换了 `_node()` 函数（`subprocess: node sign.js` → `CeairWasm.encrypt()`）。省去 Node.js 进程启动开销（~50ms/次），其他完全相同。

### 文件索引

```
东航/
├── cloak/v1.0/                  # CloakBrowser 方案
│   ├── test_cloak.py            # 入口（CloakBrowser）
│   ├── cloak_bridge.py          # Cookie 保鲜 + API 桥接
│   ├── sign.js                  # WASM AES — Node.js
│   ├── wbsk_Wbox.js             # Emscripten wasm2js 运行时
│   ├── wbsk_skb_orig.js         # AES CBC/ECB 包装器
│   └── config.json
│
├── dp/v1.0/                     # DrissionPage 方案
│   ├── test_drission.py         # 入口（DrissionPage + Node.js sign.js）
│   ├── api_bridge.py            # Cookie 保鲜 + API 桥接
│   ├── sign.js                  # WASM AES — Node.js（同 cloak）
│   ├── wbsk_Wbox.js / wbsk_skb_orig.js
│   └── config.json
│
├── iv8/                         # ⭐ iv8 方案（本次研究）
│   ├── ceair_iv8.py             # CeairWasm — iv8 加解密（替代 Node.js）
│   ├── test_iv8.py              # 纯 Python 尝试（curl_cffi HTTP，TLS 指纹被拦）
│   ├── test_hybrid.py           # ⭐ 混合方案（iv8 + DrissionPage，推荐）
│   ├── test_tongdun.py          # Tongdun SDK 在 iv8 中直接执行（blackbox ✅）
│   ├── iv8_polyfills.js         # URL.createObjectURL + Blob Worker polyfill
│   ├── config.json
│   └── README.md
│
├── browser_cookies.txt          # 手动维护的 Cookie（供 iv8 方案）
├── NOTES.md                     # 本文件
├── README.md
├── TUTORIAL.md
└── 02 逆向东航机票信息爬取的技术报告.md
```
