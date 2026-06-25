---
name: xhs-offline-vm
description: 小红书离线 VM 签名方案 — 逆向进度、文件清单、阻塞点、下一步
metadata: 
  node_type: memory
  type: project
  originSessionId: 56372508-3582-40ae-a666-c28c940a1b11
---

# 小红书离线 VM 签名 — 2026-06-24 进度

## 一、文件结构

```
小红书/
├── main.py                    # 浏览器自动签名（已可用，走 cloakbrowser）
├── sign.js                    # Node.js 签名桥（需 _webmsxyw）
├── sign_v3.js                 # 签名 v3 — 直接用 _webmsxyw 产出 XYW_ 签名
├── env.js                     # 旧版 env（VM 沙箱）
├── env.dom.js                 # 新版 env — 完整 DOM 原型链 ⭐
├── capture.py                 # Phase 1: 抓取请求头样本
├── extract_signer.py          # Phase 2: 定位签名代码
│
├── data/
│   ├── ds_api.js              # VMP 解释器入口 (_BHjFmfUMEtxhI) — 59KB
│   ├── ds_6545c.js            # 签名函数注册 (_AUuXfEG27Xa3x) — 62KB
│   ├── signer_04b29.js        # sabo 模块 bundle (_webmsxyw) — 151KB
│   ├── signer_04b29_formatted.js  # 格式化版 — 2347 行
│   ├── signer_f218.js         # 线上新版 signer — 149KB
│   ├── signer_f218_formatted.js   # 格式化版 — 2129 行
│   ├── bundler-runtime.11657a30.js  # ⭐ webpack runtime
│   ├── library-polyfill.29a884fe.js
│   ├── library-lodash.c2803696.js
│   ├── library-axios.1c2d8386.js
│   ├── library-vue.aea14f59.js
│   ├── vendor_6f49.js         # 含 module 5681 (MD5) + base64 库
│   ├── vendor-dynamic.js      # 含 seccore_signv2 + signAdaptor (~1.4MB)
│   ├── index_46f7b.js         # 主 app chunk — 需 Vue/DOM，当前加载崩
│   ├── WorldCupShared.b53633e1.js
│   ├── bf7d4e.js              # 只有 45B 的占位
│   ├── cookies.json           # 旧 cookies（含 web_session，可能过期）
│   ├── homefeed_headers.json  # 之前抓的请求头样本
│   └── all_scripts.json       # 线上 script URL 列表
│
├── test_*.js                  # 各类测试脚本（部分有效，部分已过时）
├── decode_strings.js          # 字符串表解码
└── VM_STATUS.md               # 之前的分析报告
```

## 二、当前已达成

### 2.1 env.dom.js — 完整原型链 ✅
按 Web IDL 规范重建了完整 DOM 原型链：
```
EventTarget → Node → Element → HTMLElement → HTMLCanvasElement
EventTarget → Node → Document → HTMLDocument
```
- CanvasRenderingContext2D、WebGLRenderingContext（含 0x10 instanceof 操作码支持）
- AudioContext + OscillatorNode
- XMLHttpRequest、Headers、Blob、FileReader、FormData
- MutationObserver、IntersectionObserver、ResizeObserver、PerformanceObserver
- Performance/PerformanceTiming/PerformanceNavigation（正确原型链）
- Navigator、Screen、Location、History（含 Symbol.hasInstance）
- localStorage/sessionStorage、MessageChannel、Worker、WebSocket、Image
- 全局: TextEncoder/TextDecoder、atob/btoa、crypto.webcrypto

### 2.2 加载顺序 ✅
```javascript
// 加载顺序（env.dom.js 之后，按这个顺序在 VM context 加载）
1. bundler-runtime.11657a30.js    // __webpack_require__ 闭包
2. ds_api.js                       // VMP 解释器 _BHjFmfUMEtxhI
3. ds_6545c.js                     // 签名注册 _AUuXfEG27Xa3x
4. library-polyfill.29a884fe.js    // webpack chunk
5. library-lodash.c2803696.js
6. library-axios.1c2d8386.js
7. library-vue.aea14f59.js
8. vendor_6f49.js                  // MD5 module 5681
9. vendor-dynamic.js               // seccore_signv2 + signAdaptor
10. bf7d4e.js
11. WorldCupShared.b53633e1.js
12. signer_04b29.js/signer_f218.js
// index_46f7b.js → 崩溃在 charAt，需要完整 Vue/DOM 运行时
```

### 2.3 可工作函数
| 函数 | 状态 | 产出 |
|------|------|------|
| `_dsf()` | ✅ | 16B 设备令牌，输入无关（固定 `0ae49784...`） |
| `_webmsxyw(url, body)` | ✅ | 输入敏感的签名 `{X-s, X-t}`，X-s 前缀 `XYW_` |
| `_BHjFmfUMEtxhI(__$c, env)` | ✅ 初始化 | VMP 正常初始化，但只接受 bytecode 参数 |

## 三、阻塞点

### 3.1 签名版本不匹配 ❌
- 线上真实请求：`XYS_` 前缀（seccore_signv2 / x1 版本）
- VMP 产出：`XYW_` 前缀（x2 版本）
- `XYW_` 发到服务器返回 406，说明需要 `XYS_` 格式

### 3.2 VMP hash 函数崩溃 ❌
```javascript
_0c6b9e549fef9ab9b4798ad1f12ea82b(combined, md5Hash1, md5Hash2)
→ Cannot read properties of undefined (reading 'undefined')
```
- 崩溃位置：`ds_6545c.js:1:48521`（VMP bytecode 解释器 `_0x1233dd`）
- 根因：VMP opcode 0x4f 从 env 数组按索引读参，遇到 undefined
- 尝试了 63 项 env 数组 + Proxy 懒加载 → 仍不够

### 3.3 mnsv2 不存在于 window ❌
- `seccore_signv2` 在 vendor-dynamic.js 中引用 `window.mnsv2(u, m, w)`
- `mnsv2` 由 webpack module scope 创建，需要 `index_46f7b.js` 完整执行
- `index_46f7b.js` 崩溃在 `charAt`，需要完整 Vue 应用运行时

### 3.4 seccore_signv2 算法
```javascript
// vendor-dynamic.js
function seccore_signv2(e, a) {
  var s = window.toString, u = e;
  // 序列化 body
  "[object Object]" === s.call(a) || "[object Array]" === s.call(a) || ...
    ? u += JSON.stringify(a)
    : "string" == typeof a && (u += a);

  var m = (0, K.Pu)([u].join(""));        // MD5(combined)
  var w = (0, K.Pu)(e);                   // MD5(url)
  var C = window.mnsv2(u, m, w);          // VMP hash ← 不存在

  // payload
  var P = {
    x0: "4.3.5",        // 版本（52pj 文章确认）
    x1: "xhs-pc-web",   // 平台
    x2: "Windows",      // OS
    x3: C,              // mnsv2 产物
    x4: a ? typeof a : "" // 数据类型
  };
  return "XYS_" + (0, K.xE)((0, K.lz)(JSON.stringify(P)));
  // K.lz = 某种序列化/编码（不是纯 JSON.stringify）
  // K.xE = 自定义 base64 编码
}
```

## 四、已尝试的解决方案

| 方案 | 结果 |
|------|------|
| 用 `_dsf` 替代 mnsv2 → x3 | 406（VMP 对 x3 有严格格式检查） |
| 用 `_webmsxyw` 直接签名 | 406（签名格式是 XYW_ 不是 XYS_） |
| 填 63 项 env 数组 | VMP 仍读不到需要的索引 |
| Proxy 懒加载 env 数组 | Proxy 拦截不到 VMP 内部变量引用 |
| 加载 index_46f7b.js | 崩溃需要 Vue 运行时 |
| 加载 signer_f218.js (线上新版) | VMP 内部栈溢出 |

## 五、下一步（恢复后执行）

### 5.1 从浏览器抓真实签名
1. 在浏览器登录小红书
2. 滚动触发 homefeed 请求
3. Hook `XMLHttpRequest.prototype.setRequestHeader` 捕获 `x-s`、`x-t`、`x-s-common` 请求头
4. 解码 `XYS_` payload 反推 `K.lz`/`K.xE` 的实现

### 5.2 溯源 mnsv2 创建点
在 vendor-dynamic.js 的全量格式化代码中搜索：
```bash
grep -n "mnsv2\|getMns\|\.mns" vendor-dynamic_formatted.js
```

### 5.3 补全 index_46f7b.js 环境
- index_46f7b.js 崩溃点是 `charAt` 在 undefined 上
- 可能需要 Vue/Vue Router/Vuex 等完整的 SPA 上下文
- 或者只提取 seccore_signv2 需要的模块

### 5.4 混合方案（兜底）
`main.py` + `cloakbrowser` 已可工作，用浏览器自动签名 + Python 调度。

## 六、关键洞察

1. **`_dsf` 是设备指纹，不是输入哈希** — 固定输出 `0ae49784803fad4e3add3bb2d5ce8c89`
2. **自定义 Base64 表**: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
3. **`_webmsxyw()` 直接返回签名头** — `{X-s, X-t}`，但对 URL/body 敏感
4. **52pojie 文章**（[链接](https://www.52pojie.cn/thread-2104039-1-1.html)）确认了 seccore_signv2 的 payload 结构
5. **新版 signer (f218)** 不用 `_BHjFmfUMEtxhI`，entry 是 `function X()`，不同混淆方案

## 七、相关 memory

- [[env-sign-separation]] — env.js/sign.js 分离架构
- [[default-cloakbrowser]] — 浏览器默认 cloakbrowser
- [[crawler-conventions]] — 项目约定
