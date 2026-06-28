# env-patch — 通用浏览器环境补丁框架

手工构建"看起来和真浏览器一样"的 Node.js 全局环境，不依赖 JSDOM。

## 目录

```
.claude/env-patch/
├── env_patch.js           # 通用框架（不要改）
├── debug-proxy.js          # 可选：Proxy 调试监控 + 补丁代码生成
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

## 二阶段补环境工作流

### 阶段 1 — 发现（debug-proxy 扫描）

```bash
DEBUG_PROXY=true node your_sign.js
```

运行时会输出实时日志（`[GET]` / `[SET]` / `⚠️ undefined`），**退出时自动打印三区报告**：

1. **属性访问清单** — 所有被访问的属性，按对象分組，标记 ✅/⚠️
2. **需要补的属性** — 🟡 已知默认值 / 🔴 未知需采集
3. **📋 补丁代码** — 可直接粘贴到 `env_site.js` 的 `Object.defineProperty` 代码

### 阶段 2 — 补全（env_site.js 覆盖）

```
DEBUG_PROXY=true node script.js          # 发现缺失
      ↓  复制报告的 📋 补丁代码
      ↓  粘贴到 env_site.js 的「站点特有覆盖」区域
      ↓
DEBUG_PROXY=true node script.js          # 验证补全
      ↓  重复直到：
      ↓  ① 签名成功
      ↓  ② 🔴 未知属性清零（仅剩 🟡 已知默认值 或 ➖ 平台特定）
```

### 进阶：手动补未知属性

报告中的 🔴 属性没有预置默认值，需要在真浏览器中采集：

1. 打开浏览器 DevTools Console
2. 输入 `${属性路径}` 查看返回值
3. 将返回值作为 getter 表达式写到 `env_site.js` 中

## env_patch 天花板 — 何时切换到 iv8

JS 层补环境有天然上限。如果经过 3 轮 debug-proxy → env_patch 迭代，签名结果**始终错误**（不 crash，只是返回值不对），说明撞到了 C++ 引擎层差异。

### 判定表

| 症状 | 根因 | 方案 |
|------|------|------|
| VMP 报错 crash，有堆栈 | JS 层缺少属性 | → 继续 env_patch 迭代 |
| `typeof X` 在 Node.js 和浏览器返回不同值 | C++ 引擎层差异 | → 切 iv8 |
| 签名不 crash 但 code≠0（如 Boss直聘 code=38） | VMP 条件分支走错路径 | → 切 iv8 |
| `X instanceof Y` 在 Node.js 为 false，浏览器为 true | 原型链 hidden class | → 切 iv8 |

**经验数据**（来自三个站点）：

| 站点 | 补环境轮数 | 最终方案 | 原因 |
|------|:---:|------|------|
| 知乎 | 1 轮 | env_patch ✅ | 无 VMP，只读 `crypto.getRandomValues` |
| QQ音乐 | 1 轮 | env_patch ✅ | VMP 访问 ~33 个属性，无引擎层检测 |
| 小红书 | 1 轮 | env_patch ✅ | VMP 读 doc + cookie，Proxy 包裹即可 |
| Boss直聘 | 13 轮 | **iv8** ✅ | VMP 53 检查点 + typeof/原型链/hidden class 引擎层差异 |

### 决策原则

```
env_patch 3 轮内签名通过？ → 完成
    ↓ 不通过
签名 crash 有堆栈？ → 继续补，不是引擎层问题
    ↓ 不 crash，但返回值错误
VMP trace 分叉点是 typeof/prototype？ → 切 iv8
    ↓ 分叉点是属性值不匹配
debug-proxy 继续补 → 属性补齐后签名通过？ → 完成
    ↓ 属性全对齐仍不通过
切 iv8（C++ V8 引擎 = 真实 Chrome，引擎层检测无效）
```

**关键认知**：VMP 的"环境检测"目标是 jsdom/Node.js vm 这类 JS 层模拟——它们的 C++ API 与真实 Chrome 不同。iv8 的 C++ 层 API 就是 Chromium 源码编译的，在这些检查点上与真实浏览器**无法区分**。Boss直聘的 53 个检查点 iv8 全过。

> 详细工作流参考: [[iv8-nodejs-workflow]]

## debug-proxy — Proxy 调试监控 + 补丁生成

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

### 报告示例

```
════════════════════════════════════════════════
📊 debug-proxy 环境属性扫描报告
════════════════════════════════════════════════

── 属性访问清单 (33 个) ──

  navigator (3)
    ⚠️ scheduling
    ✅ userAgent
    ✅ platform

── 需要补的属性 (4 个) ──
  🟡 navigator.scheduling — 已知默认值
  🔴 document.all — 未知，需从真浏览器采集

═══ 📋 复制到 env_site.js 的补丁代码 ═══
// --- 补: navigator ---
Object.defineProperty(Navigator.prototype, 'scheduling', {
  get: function scheduling() { return ({ isInputPending: function() { return false; } }); },
  configurable: true, enumerable: true,
});
```

### 注意

- `DEBUG_PROXY` 未设置时，`watch()` 直接返回原对象，**零性能开销**。
- 日志默认去重（同一属性只记一次），避免刷屏。
- `undefined` 访问会以黄色警告单独标记。
- `window` 上的函数自动 `.bind(target)` 防止 Illegal invocation。
- `KNOWN_DEFAULTS` 知识库对常见浏览器 API 提供预置默认值，可在 `env_site.js` 中追加 `KNOWN_DEFAULTS["my.prop"] = "...";`
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
