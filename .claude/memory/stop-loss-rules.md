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

**诊断方法（两步定位根因）**：
1. 浏览器引擎对照：Chromium `fetch()` vs Firefox `page.evaluate(fetch())` 各试一次
   - Chromium 成功 + Firefox 失败 → **浏览器引擎问题**（见 [[waf-browser-engine]]），切 Chromium
   - 两者皆成功 → TLS 指纹问题，走 `curl_cffi`
   - 两者皆失败 → Cookie/加密问题

2. 如果 Chrome 的 `fetch()` 也超时不返回 → 是 WAF tarpitting（IP 被标记）。检查 [[waf-rate-limiting]]。

**禁止**：
- ❌ Cookie 有效却反复删 cookies.json 重试刷新
- ❌ 反复修改 `requests` headers（Origin/Referer/Cookie 格式等）
- ❌ 在 Cookie 配置上花超过 5 分钟
- ❌ 出现滑块后继续 retry loop（**新发现**：retry 会加速 IP 升级到 405）
- ❌ 默认用 Firefox 系浏览器（Camoufox/Playwright Firefox）。国内站点先试 Chromium。

**方案降级梯度**（更新）：
1. **DrissionPage headless Chromium**（推荐首选，国内站点兼容性最好）
2. `curl_cffi` impersonate（纯 Python，适合低频请求）
3. Playwright headless Chromium
4. Camoufox（仅当目标站对 Chrome 也有反制时考虑）

**Why**: 东航实战中不仅验证了 TLS 指纹规则，还发现阿里云 WAF 对 Firefox 引擎全线拦截（无论 headless/有头/UA 伪装），而对 Chromium 天然放行。浏览器引擎选择比 TLS 指纹更重要。

**How to apply**: 接手新站 → 先 Chromium `fetch()` → 被拦再试 Firefox → 5 分钟确定要不要切引擎。[[waf-browser-engine]] [[waf-rate-limiting]]

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
