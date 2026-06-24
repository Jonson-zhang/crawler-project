# 小红书离线签名 — 状态报告

## 架构

```
Python (main.py)
  → subprocess: node sign.js <url> <body_json>
    → env.dom.js (原型链补环境: EventTarget→Node→Element→HTMLElement 等)
    → vendor.js (webpack bundle, ~1.36MB)
      ├── 模块 68274: signV2Init() → eval(VMP字节码) → 创建 mnsv2
      └── 模块 40055: seccore_signv2(url, body) → MD5 + mnsv2 + 自定义Base64
    → sign() → stdout JSON {x-s, x-t}
  → HTTP 请求 → 解析展示
```

## 目录结构 (6 文件, 1.4MB)

```
小红书/
├── VM_STATUS.md     # 本文档
├── main.py          # Python 入口 (subprocess 调 sign.js)
├── sign.js          # Node.js 签名 (加载 vendor.js + 签名逻辑)
├── env.dom.js       # 浏览器原型链补环境
└── data/
    ├── vendor.js    # 完整 webpack bundle (含 seccore_signv2 + signV2Init)
    └── cookies.json # 手动刷新的 cookie
```

## ✅ 已完成

| 项目 | 状态 | 详情 |
|------|------|------|
| vendor.js 加载 | ✅ | Node.js VM 中~40ms |
| env.dom.js 原型链 | ✅ | EventTarget→Node→Element→HTMLElement, constructor.name 正确 |
| webpack runtime | ✅ | 拦截 chunk push, 注册模块 |
| signV2Init | ✅ | 成功创建 mnsv2 函数 |
| MD5 哈希 | ✅ | Node crypto |
| 自定义 Base64 | ✅ | 字母表验证通过 |
| PluginArray/MimeTypeArray | ✅ | 浏览器兼容的存根 |
| Node global 注入 | ✅ | document/navigator/screen/performance/top |
| VMP 函数族创建 | ✅ | 16 个子函数 + mnsv2 |

## 关键发现

### 1. VMP eval 使用 Node global (非沙箱)

VMP eval 代码: `var glb = _0xe762c0(0x1a) == typeof window ? global : window`

解码后 `0x1a` != `typeof window`，所以 `glb = window`。在浏览器中 `window` 是真实浏览器对象；在 Node.js 中，`window` = 沙箱（sandbox.window = sandbox）。

但沙箱中缺少很多 Node 原生 API（Buffer, process, 真正的 navigator 等），所以必须把 browser-compatible 的 navigator/screen/performance 注入到 Node global，让 VMP 能访问它们。

### 2. inject navigator 的陷阱

Node.js 的 `global.navigator` 有 getter 无 setter，直接 `=` 赋值静默失败。必须用 `Object.defineProperty` 覆盖。

### 3. env.dom.js 增强项

需添加/修正的属性:

| 属性 | 之前 | 之后 | 原因 |
|------|------|------|------|
| navigator.plugins | `[]` | `new PluginArray()` | VMP 检查类型 |
| navigator.mimeTypes | `[]` | `new MimeTypeArray()` | VMP 检查类型 |
| navigator.product | UNDEF | `"Gecko"` | 浏览器有 |
| navigator.vendor | `"Google Inc."` | `""` | Firefox 空 |
| navigator.doNotTrack | `null` | `"1"` | 浏览器有 |

## ❌ 剩余问题

### mnsv2 输出过短 (mns0201_0)

VMP 成功创建了 mnsv2 和 16 个子函数，但 mnsv2 内部哈希输出为 `mns0201_0` (浏览器为 `mns0301_<200+ chars>`).

根因: VMP 字节码的内部哈希表构建依赖环境属性的精确值。有 3 个状态槽为 undefined，表明某些环境属性提取失败。

VMP 内部状态 `mnsv2.ΙIΙ`:
```
.0: Node global (含注入的 navigator/screen/document)
.d: 2 (维度?)
.$2: state object
.$0: env array string
.$1: state object  
.length: 1
```

## 下一步选项

A. **浏览器桥接** (简单可靠) — 用 Camoufox 在后台提供 mnsv2 调用，Python 通过 MCP 调用

B. **I/O 录制** (如果 mnsv2 是纯函数) — 在浏览器中录制 (combined, hashC, hashU) → result 映射对，Node 中查表

C. **VMP 内部调试** (复杂) — 继续补全 VMP 需要的每个环境属性，直到 3 个 undefined 槽位被填满
