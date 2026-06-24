# 小红书离线 VM 签名 — 状态报告

## ✅ 已解决

| 项目 | 状态 | 详情 |
|------|------|------|
| 3 脚本加载 | ✅ 全部成功 | ds_api.js + ds_6545c.js + signer_04b29.js |
| 自动初始化调用 | ✅ 成功 | `_BHjFmfUMEtxhI(__$c, env)` 和 `_AUuXfEG27Xa3x(__$c, env)` 均通过 |
| `_dsf()` | ✅ 可用 | 产出 16 字节 device token (Uint8Array) |
| Canvas/Audio 桩 | ✅ 已补 | CanvasRenderingContext2D + AudioContext |

## ❌ 已定位问题

### `err:d93135` 的根因

```javascript
// ds_6545c.js line 621
if (_0x4d21fc['Kflqa'](_0x4d21fc['FSUSO'], _0x5908ed))
    throw new Error('err:d93135:' + _0x5908ed);
```

`_AUuXfEG27Xa3x` 是一个**纯初始化函数**，不接受 URL/body 作为签名参数：
- arg1 必须是 `__$c` hex bytecode（文件头 magic bytes "VTKBBQFM" 验证）
- 传 URL 时，URL 字符被误当 hex 解析，校验失败

**结论：`_AUuXfEG27Xa3x(url, body)` 不是合法调用方式。**

### 调用协议揭秘

```
ds_api.js:     glb['_BHjFmfUMEtxhI'](__$c, [,,undefined, Uint8Array, getdss])
ds_6545c.js:   glb['_AUuXfEG27Xa3x'](__$c, [,,Function, document, performance, MutationObserver, Object])
signer_04b29:  _webmsxyw(window, config)   // sabo 模块系统入口
```

每个都是自调用初始化，不暴露直接签名 API。

### 缺失部分

1. **XHR 拦截代码** — 存在于 webpack chunks（index_46f7b.js 2.4MB, vendor-dynamic.js 1.4MB, vendor_6f49.js 0.9MB）
2. **签名调度桥** — 连接 XHR 拦截器 → 签名函数 → 写 `x-s`/`x-t`/`x-s-common` header
3. **内联脚本** — HTML 中的 `<script>` 标签（如 `__INITIAL_STATE__` 注入的 `xsecappid` 等配置）

### 沙箱补丁清单

已添加的 stub：
- `CanvasRenderingContext2D` + `HTMLCanvasElement` (解决 `getContext` 缺失)
- `AudioContext`
- `MutationObserver`, `IntersectionObserver`, `PerformanceObserver`
- `localStorage` / `sessionStorage`
- `MessageChannel`, `WebSocket`, `Worker`, `Image`
- `OffscreenCanvas`, `FormData`, `FileReader`
- `Event`, `CustomEvent`

## 🔬 2026-06-24 深入分析 (MCP 浏览器实时调试)

### seccore_signv2 完整源码 (vendor-dynamic.js / 模块 40055)

```javascript
function seccore_signv2(e, a) {
  var s = window.toString, u = e;
  // 规范化 data → u = url + body
  "[object Object]" === s.call(a) || "[object Array]" === s.call(a) ||
    (void 0 === a ? "undefined" : (0, et._)(a)) === "object" && null !== a
    ? u += JSON.stringify(a)
    : "string" == typeof a && (u += a);
  
  var m = (0, K.Pu)([u].join("")),   // MD5(url + body) — 模块 5681
      w = (0, K.Pu)(e),                // MD5(url)
      C = window.mnsv2(u, m, w),       // VMP 签名 ← 核心！
      P = {
        x0: R.i8,                       // "4.3.5" (版本)
        x1: "xhs-pc-web",               // 平台
        x2: window[R.mj] || "PC",       // OS ("Windows")
        x3: C,                          // mnsv2 输出
        x4: a ? void 0 === a ? "undefined" : (0, et._)(a) : ""  // 数据类型
      };
  return "XYS_" + (0, K.xE)((0, K.lz)(JSON.stringify(P)));
  // = "XYS_" + customBase64(utf8encode(JSON.stringify(payload)))
}
```

### 模块映射表

| 模块 | 函数 | 作用 |
|------|------|------|
| 40055 | `K.Pu` → MD5 hash | 对 url+body 做 MD5 |
| 40055 | `K.xE` → b64Encode | 自定义 Base64 编码 |
| 40055 | `K.lz` → encodeUtf8 | UTF-8 编码 |
| 68274 | `signV2Init()` | 初始化 `window.mnsv2` (完整的 VMP 字节码解释器) |
| 31547 | `et._()` | 类型检查 |

### 自定义 Base64 字母表

```
"ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"
```

✅ 已验证：用此表解码真实 x-s header，得到正确 JSON payload。

### x-s payload 真实结构

```json
{
  "x0": "4.3.5",
  "x1": "xhs-pc-web", 
  "x2": "Windows",
  "x3": "mns0301_gRaKqzGo4HEIGJxLED0idEGSWfTrR85Vv...",  // mnsv2 签名结果
  "x4": "object"
}
```

### mnsv2 来源

`window.mnsv2` 由 webpack 模块 **68274** 的 `signV2Init()` 创建。该函数内嵌了完整的 VMP 字节码解释器（与 ds_6545c.js 功能相同但独立打包）：
- 通过 `String.raw` 嵌入 obfuscated VMP 代码
- 末尾 `eval(code)` 执行，在 global 上创建 `_AUuXfEG27Xa3x` + `mnsv2` 等函数
- 在浏览器中，`P.ZP.isBrowser && (0, en.a)()` 触发此初始化
- 在 Node.js VM 中运行 signV2Init 会 panic（VMP bytecode 访问 undefined 属性）

### x-s-common

x-s-common 使用相同的自定义 base64 编码，但 payload 更长，包含更丰富的设备/环境指纹数据。

### 浏览器方案验证 ✅

- Camoufox 浏览器成功加载 xiaohongshu.com
- 页面的 Axios 拦截器自动签名所有 XHR 请求
- 成功接收 4 次 homefeed API 响应 (status 200)
- 提取到推荐笔记（标题、作者、封面图）
- 关键：必须使用页面的内部 HTTP 客户端（通过 Vue/Axios 拦截器链），裸 XHR 不签名

## 下一步建议

1. **混合方案 (推荐)** — 浏览器签名 + Python 调度：`main.py` 重构为使用 Camoufox MCP
2. **VMP 字节码逆向** — 从 signV2Init 提取完整 bytecode，补全 ds_6545c.js 缺失的 env 变量
3. **在线签名服务** — 在浏览器中注入 JS bridge，Python 通过 WebSocket 调用签名
