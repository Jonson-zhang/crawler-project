# env-patch — 通用浏览器环境补丁框架

手工构建"看起来和真浏览器一样"的 Node.js 全局环境，不依赖 JSDOM。

## 目录

```
.claude/env-patch/
├── env_patch.js           # 通用框架（不要改）
├── env_site_template.js   # 新站点从这里复制改名
└── README.md
```

## 每个站点的标准用法

```
你的站点/
├── env_site.js            # 站点环境配置（从模板复制，只写差异）
├── sign.js                # 签名/业务逻辑
└── ...
```

`env_site.js` 只有 30-60 行，写两件事：

```js
// 1. 配置
setupEnv({ url: "...", userAgent: "...", ... });

// 2. 覆盖（本站点特有的属性值/方法）
global.xxx = ...;
```

### 三步接入

1. 复制 `.claude/env-patch/env_site_template.js` → `你的站点/env_site.js`
2. 修改 `url` / `userAgent` / `windowToGlobal` 等参数
3. 在代码中 `require("./env_site")` 即可

### 需要调试时

如果站点 JS 报错或签名结果不对，在 `env_site.js` 尾部追加覆盖即可，**不要改 `env_patch.js`**：

```js
// 覆盖某个属性
navigator.hardwareConcurrency = 8;

// 补 document.cookie
Object.defineProperty(document.constructor.prototype, "cookie", { ... });

// 如果 VMP 要求 window === global（默认 false）
// 在 setupEnv 参数中设 windowToGlobal: true
```

## debug-proxy — Proxy 调试监控

`debug-proxy.js` 是一个**可选模块**，对浏览器环境对象施加 Proxy 监控，拦截所有属性 get/set 操作并输出日志。用于定位"缺了哪个属性"这类补环境问题。

### 启用方式

```bash
# Windows CMD
set DEBUG_PROXY=true
node your_script.js

# PowerShell
$env:DEBUG_PROXY="true"
node your_script.js

# Linux / Mac / Git Bash
DEBUG_PROXY=true node your_script.js
```

### 使用方式

在 `env_site.js` 中 require 并包裹对象：

```js
const { watch } = require("../../.claude/env-patch/debug-proxy.js");
global.window    = watch(global.window,    "window");
global.document  = watch(global.document,  "document");
global.navigator = watch(global.navigator, "navigator");
global.location  = watch(global.location,  "location");
global.screen    = watch(global.screen,    "screen");
```

### 输出示例

```
[GET] navigator.userAgent → Mozilla/5.0 ...
[GET] document.createElement → [Function: createElement]
 ⚠️  [GET] window.__someMissingProp → undefined
[SET] document.cookie = key=value
```

### 注意

- `DEBUG_PROXY` 未设置时，`watch()` 直接返回原对象，**零性能开销**。
- 日志默认去重（同一属性只记一次），避免刷屏。
- `undefined` 访问会以黄色警告单独标记。
- `window` 上的函数自动 `.bind(target)` 防止 Illegal invocation。
- 此模块独立于 `env_patch.js`，无需修改框架文件。

## 配置项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `url` | `"https://www.example.com/"` | 页面 URL |
| `userAgent` | Chrome 148 UA | UA 字符串 |
| `platform` | `"Win32"` | navigator.platform |
| `windowToGlobal` | `false` | window === global ?（设 true 时字节码 VM 可能静默失败） |
| `canvas` | `true` | Canvas 2D stub |
| `webgl` | `false` | WebGL stub |
| `plugins` | `true` | plugins/mimeTypes |
| `storage` | `true` | localStorage/sessionStorage |
| `extraConstructors` | `true` | 200+ 浏览器构造函数 |
| `crypto` | `true` | Node.js crypto → Web Crypto |
| `screenWidth/Height` | 1920/1080 | 屏幕尺寸 |

## 技术原理

| 组件 | 实现 |
|------|------|
| 原型链 | `Object.create(ParentProto)` |
| toString 保护 | `sn()` Map → `[native code]` |
| 类型标签 | `Symbol.toStringTag` |
| 属性定义 | `Object.defineProperty` getter |
| Node.js getter 绕过 | `_setGlobal()` 统一用 defineProperty（Node.js ≥21 的 navigator/crypto/performance 是只读 getter） |
| Anchor URL 解析 | `document.createElement("a")` + `href` setter |
| HTMLCollection 索引 | Proxy 支持 `[0]` |
