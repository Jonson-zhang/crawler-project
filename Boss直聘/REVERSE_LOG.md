# Boss直聘 __zp_stoken__ 逆向工作日志

> 日期: 2026-06-26 | 状态: 补环境中（Token 可生成但未通过服务端验证）

---

## 一、加密参数概述

| 参数 | 位置 | 长度 | 说明 |
|------|------|------|------|
| `__zp_stoken__` | Cookie | ~459 字节(URL编码后) | 核心签名，JSVMP 虚拟机生成 |
| `__zp_sseed__` | Cookie(临时) | ~44 字节 | seed，由 API code=37 返回 |
| `__zp_sname__` | Cookie(临时) | ~8 字节 | JS 文件名（如 `7c91433f`，每天换） |
| `__zp_sts__` | Cookie(临时) | 13 位数字 | 时间戳 |
| `__a` | Cookie | ~52 字节 | 设备标识（客户端生成） |
| `__c` | Cookie | 10 位数字 | 时间戳（客户端生成） |

---

## 二、签名流程

```
1. Python 发送 joblist API 请求（不带 __zp_stoken__）
   → code=37，返回 {seed, ts, name}

2. 客户端调用: ABC.z(seed, ts)
   → 内部 JSVMP 状态机（9887 状态节点）
   → 输出: c66fgw + 自定义编码字符串 (~459 chars)

3. 将 token 写入 Cookie __zp_stoken__
   → 重新请求 API → code=0 成功
```

### 已验证的关键事实

- **Token 与 `__a`/`__c` session 无关** — 新 session 用旧 token 同样成功
- **Token 只依赖 (seed, ts) 对** — 固定输入 → 固定输出
- **安全 JS 每天凌晨更换** — 文件名 = `code=37` 返回的 `name` 字段
- **JS 文件位置**: `https://www.zhipin.com/web/common/security-js/{name}.js`

---

## 三、加密文件分析

### 3.1 安全 JS 文件

| 文件 | 大小 | 说明 |
|------|------|------|
| `security-7c91433f.js` | 322,507 字节 | 核心 JSVMP 虚拟机（当前版本） |
| URL | `/web/common/security-js/7c91433f.js` | 首次由 search 页面重定向加载 |

### 3.2 加密入口

来自 `app~2.10f543fb.js`（webpack chunk 49657）：

```javascript
var r = new e().z(seed, parseInt(ts) + (480 + new Date().getTimezoneOffset()) * 60000);
// e 来自 iframe.contentWindow.ABC
// ABC 在 security JS 加载后自动挂到全局
// 时区偏移: 480 + getTimezoneOffset() = 480 - 480 = 0（中国 UTC+8）
```

### 3.3 ABC.z() 调用链

```
seccore_signv2(url, body) → window.mnsv2(payload, MD5(payload), MD5(url))
  → 内部构造字节码 bc 和环境数组 env
    → _AUuXfEG27Xa3x(bc, env)  // VMP 字节码解释器
      → 解释执行 9887 状态节点 → 输出 200 char 哈希
```

---

## 四、VMP 访问的浏览器属性（Proxy 精确追踪）

按浏览器实际采集（385 token 路径）：

| 属性 | 访问次数 | 类型 | 值 |
|------|---------|------|-----|
| `navigator.plugins` | 13 | PluginArray实例 | 5 个 PDF Viewer plugin |
| `navigator.mimeTypes` | 6 | MimeTypeArray实例 | 2 个（application/pdf, text/pdf） |
| `navigator.languages` | 4 | Array | `["zh-CN", "zh"]` |
| `navigator.hardwareConcurrency` | 2 | Number | 8 |
| `screen.availWidth` / `availHeight` | 2+2 | Number | 3072 / 1680 |
| `screen.width` / `height` | 2+2 | Number | 3072 / 1728 |
| `navigator.webkitTemporaryStorage` | 1 | undefined | — |
| `navigator.language` | 1 | String | `"zh-CN"` |
| `navigator.deviceMemory` | 1 | undefined | — |
| `navigator.webdriver` | 1 | Boolean | false |
| `performance.memory` | 1 | Object | `{}` |
| `localStorage.getItem` | 2 | Function | — |

### Plugin 详细结构（5个 PDF Viewer）

```
PDF Viewer / Chrome PDF Viewer / Chromium PDF Viewer
  / Microsoft Edge PDF Viewer / WebKit built-in PDF
每个 plugin: { name, filename:"internal-pdf-viewer",
    description:"Portable Document Format", length:2,
    [0]: { type:"application/pdf", suffixes:"pdf" },
    [1]: { type:"text/pdf", suffixes:"pdf" } }
```

### 关键浏览器特征

| 属性 | 值 |
|------|-----|
| userAgent | `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0` |
| platform | `Win32` |
| vendor | `""` |
| screen resolution | 随窗口变化（1600x900 ~ 3072x1728） |
| `document.all` | `undefined` (Firefox 行为) |
| `CSSRuleList` | `function` (存在) |
| `typeof navigator.webkitTemporaryStorage` | `"undefined"` |
| `typeof navigator.deviceMemory` | `"undefined"` |

---

## 五、补环境方案（sign_boss.js）

### 架构

```
sign_boss.js (Node.js vm 沙箱)
  ├── 200+ 浏览器构造函数（原型链 + Symbol.toStringTag）
  ├── Navigator 实例（完整 Plugin/MimeType 对象树）
  ├── Document 实例（cookie getter + createElement 支持 iframe/canvas/script）
  ├── Location / Screen / History / Storage / Performance / Crypto
  ├── Native toString 保护 (memoryMap)
  └── 调用: new ABC().z(seed, ts) → 输出 token
```

### 补环境技术要点

1. **`window = globalThis`** — 不创建隔离对象
2. **原型链**: `new Constructor()` → `Object.create(parentProto)` 建立完整链
3. **`Symbol.toStringTag`**: Navigator→`[object Navigator]`、PluginArray→`[object PluginArray]` 等
4. **Native toString**: `memoryMap` + `Function.prototype.toString` 重写
5. **Plugin/MimeType 实例**: `Object.create(Plugin_.prototype)` 确保 `instanceof` 正确
6. **Canvas 2D context**: 完整方法存根 + `toDataURL` 返回 dummy PNG
7. **WebGL context**: 完整方法存根 + `getParameter` 返回正常值
8. **Anti-automation**: `_phantom=undefined`, `callphantom=undefined`, `Buffer=undefined`

### 当前结果

```
浏览器 token: 459 chars, 服务端 code=0
sign_boss.js: 421 chars, 服务端 code=38
仅匹配前缀 8 字符 (c66fgw)
```

### 根因

JSVMP 的 9887 状态机节点对环境检测极度敏感。即使所有顶层属性值一致，`typeof`/`instanceof`/`Object.prototype.toString.call()` 的细微差异（如某些内部类型标签）导致 VMP 走完全不同的代码路径。需要 AST 级别的分层验证才能逐阶段对齐。

---

## 六、文件清单

```
Boss直聘/
├── config/
│   ├── security-7c91433f.js     安全 JS（322KB，每天可能更换）
│   ├── app-bundle-2.js           webpack bundle（含加密入口逻辑）
│   └── sign_abc.js               旧版签名脚本
├── sign_boss.js                  **当前签名脚本**（vm 沙箱补环境）
├── sign_boss_v4.js               V4 试验版（直接 V8 global）
├── sign_boss_v5.js               V5 试验版（全部对象沙箱内创建）
├── main.py                       Python 主程序
├── main.js                       Node.js 主程序（Function 构造器方案）
├── test_*.js                     各种测试脚本
├── env_patch.js                 模块化补环境（未完成）
├── REVERSE_LOG.md                本文档
├── Boss直聘.md                   旧版逆向笔记（2025年，仅供参考）
└── 小红书逆向要点总结.md         关联：类似 JSVMP 补环境方法
```

---

## 七、关键经验

### 已验证的

1. security JS 直接用 `eval()` 在 Node.js 全局执行 → ABC 成功暴露，不需要 iframe
2. vm 沙箱内 `Function.prototype.toString` 修改**对沙箱内代码生效**
3. `Symbol.toStringTag` 在 vm 沙箱内正常工作
4. `document.cookie` 可以用 `Object.defineProperty` getter
5. `document.all` 必须为 `undefined`（Firefox 行为，VMP 检测）
6. `CSSRuleList` 必须存在且为 function（VMP 检测）

### 参考文章

- [某聘 __zp_stoken__ 逆向分析](https://mp.weixin.qq.com/s/F7PL7uZNtRj-8U_huFyfOw) — AST 反编译 + 分层验证方法论
  - 确认：VMP 是 3 层状态机、9887 状态节点、指纹采集包含 WebGL/Audio/Screen/Canvas
  - 确认：`func_1391()` 是指纹聚合函数

### 下一步

1. **AST 反编译** — 用 @babel/parser 提取状态表 + CFG
2. **分层验证** — 固定 seed/ts/random/fingerprint，逐阶段对比浏览器 vs Node.js
3. **本地对齐** — 找到第一个偏差点，针对性修复
4. **或改用 `Function()` 构造器** — 创建完全纯净的作用域，不依赖 vm 沙箱

---

## 八、环境迁移指南

在新电脑上继续：

```bash
# 1. 确保有 Node.js 20+
node -v

# 2. 确保 Python 3 + uv + curl_cffi
uv sync  # 在项目根目录运行

# 3. 测试签名脚本
cd Boss直聘
node sign_boss.js "__a值" "__c值" "seed值" ts值

# 4. 测试完整流程
uv run python main.py

# 5. 安全 JS 已缓存在 config/security-7c91433f.js
# 如果文件过期（服务端换了新版本）：
#   A. 先请求 API 拿到新的 name 字段
#   B. 下载 https://www.zhipin.com/web/common/security-js/{name}.js
#   C. 更新 sign_boss.js 中的文件路径
```
