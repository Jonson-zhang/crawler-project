---
name: stop-loss-rules
description: 止损规则 — 在错误方向投入超过 5 分钟前强制切换路径。指纹 SDK 判死、TLS 诊断、Emscripten wasm2js 识别
metadata:
  type: project
---

以下规则在 CHECK-2 未命中任何 case 时生效，Phase 0 侦察阶段就必须执行判定。

## 规则 1：指纹 SDK = 不可纯 Node.js 复现，5 分钟内判死

**触发信号**：navigate 后 redirect_chain 中出现以下任一域名的脚本：
- `trustdecision.com` / `tongdun.net` / `static.trustdecision.com` / `static.tongdun.net`
- 文件名：`fm.js` / `normal.js` / `monitor.js`

**判定**：Cookie 由指纹 SDK 动态生成，依赖 Web Worker + Canvas + WebGL + AudioContext。

**立即执行**：
- ✅ 走浏览器桥接（Playwright/Camoufox headless + Cookie 导出并持久化到文件）
- ✅ 记录 Cookie 年龄，过期自动刷新

**禁止**：
- ❌ 下载 SDK 源码分析（`scripts(action='save')`）
- ❌ 尝试 jsdom 环境运行 SDK
- ❌ Hook `document.cookie` 追踪写入调用栈
- ❌ 搜索 SDK 中的 cookie/encrypt/encode 关键词
- ❌ 尝试在 Node.js 中复现 SDK 的任何逻辑

**Why**: 这些 SDK 的核心设计目标就是不可在非浏览器环境伪造。东航实战中花了 2 小时分析 4 个 SDK 文件，最终结论是 5 分钟就能下的。

**How to apply**: Phase 0 navigate 后 → 看 redirect_chain → 如果有 tongdun/trustdecision 域名 → 直接分配 Cookie 保鲜方案，不再分析 SDK。

## 规则 2：请求返回 WAF HTML ≠ Cookie 问题

**触发信号**：`requests` 发加密请求 → HTTP 200 + `content-type: text/html` + body 含 `aliyun_waf` 或 WAF 特征。

**诊断方法（一步到位）**：在同一个浏览器会话中同时用 `fetch()` 发加密请求和 `requests` 发相同请求。
- 浏览器 `fetch()` 成功 → **TLS 指纹问题**，走 `curl_cffi`（`impersonate="chrome110"`）或 Playwright Chromium TLS 栈
- 浏览器 `fetch()` 也失败 → Cookie/参数/加密问题，继续调试

**禁止**：
- ❌ Cookie 有效却反复删 cookies.json 重试刷新
- ❌ 反复修改 `requests` headers（Origin/Referer/Cookie 格式等）
- ❌ 在 Cookie 配置上花超过 5 分钟

**方案降级梯度**：
1. `curl_cffi` impersonate（推荐先试，纯 Python，无浏览器开销）
2. Playwright headless Chromium TLS 栈
3. Camoufox headless（已有基础设施时）

**Why**: 东航实战中确认 Cookie 有效但 Python requests 被 WAF 拦截，同一个 Cookie 在 Chromium fetch 中成功。在 Cookie 配置上反复调整是浪费时间。

**How to apply**: 第一次 WAF HTML 出现时 → 不要改 Cookie → 立即做浏览器内 fetch 对照实验。

## 规则 3：`Module._malloc` + `Module.cwrap` → Emscripten wasm2js，一行 `require`

**触发信号**：加载的 JS 中存在以下模式：
- 文件 ~1MB 且开头含 "Copyright 2010 The Emscripten Authors"
- `var wasmBinaryFile = 'xxx.wasm'`（但 .wasm 文件可能 404）
- `Module._malloc`、`Module.HEAP8`、`Module.cwrap` API

**判定**：这是 Emscripten wasm2js，不是 wasm-bindgen。

**Node.js 加载方式（唯一标准方式）**：
```js
global.Module = require('./xxx.js');
// 完成。无需 self/window/document/crypto
```

**禁止**：
- ❌ 按 wasm-reverse 流程生成 stub（`wasm-objdump -x` 需要 .wasm 文件）
- ❌ 补 `wbg.__wbg_self` / `__wbg_crypto` 等 wasm-bindgen 导入
- ❌ 补 self/window/document/navigator（Emscripten 内置 ENVIRONMENT_IS_NODE 分支）

**Why**: Emscripten wasm2js 和 wasm-bindgen 是两个完全不同的体系。按错体系是浪费时间。

**How to apply**: 看到 `Module._malloc` / `Module.cwrap` → 确认是 wasm2js → 一行 require 搞定。
