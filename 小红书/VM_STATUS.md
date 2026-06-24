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

## 下一步建议

1. **分析 webpack chunks** — 格式化 index_46f7b.js (2.4MB)，找到 XHR 拦截器
2. **MCP 浏览器 capture** — 从实时页面抓取 XHR 被拦截时的调用栈
3. **混合方案** — `_dsf()` 离线算 + 完整签名走 `main.py` + `cloakbrowser`
