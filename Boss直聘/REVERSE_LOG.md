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

## 五、补环境方案总结与最终方案

### 探索历程

| 版本 | 方法 | Token 长度 | 前缀匹配 | API 结果 |
|------|------|-----------|---------|---------|
| v1 (sign_boss.js) | vm 沙箱 + 基本浏览器对象 | 421 | 6 chars (c66fgw) | code=38 |
| v2 (test_env_fix.js) | vm 沙箱 + 浏览器精确值 | 365 | 7 chars (c66fgw) | code=38 |
| v3 (minimal env) | vm 沙箱 + 最小浏览器存根 | 285 | 8 chars (c66fgw5V) | - |
| v4 (浏览器直接) | 真实浏览器 security-check | 465 | full match | code=0 ✅ |

### 关键发现（2026-06-26）

1. **security JS 本身不含浏览器 API 调用** — 但初始化需要浏览器全局对象存在，否则 ABC 不实例化
2. **`crypto.getRandomValues()` 引入随机性** — 相同 seed/ts 两次调用的 token 不同
3. **补环境越精确，token 越短** — 说明 VMP 对不同环境走不同的代码路径（指纹提取 vs 核心计算）
4. **TLS 指纹一致性检查** — 即使浏览器生成的合法 token，从 Node.js https.get() 发送也被拒
5. **服务器全链路校验** — token + TLS + cookie chain + 请求特征必须一致

### 最终方案：基于浏览器的 token 生成

由于 JSVMP 的 9887 状态机对 VM 沙箱环境的 `typeof`/`instanceof`/原型链差异极度敏感，
且服务器同时校验 TLS 指纹，**纯 Node.js 离线签名在当前条件下不可行**。

**可用的替代方案：**

1. **Playwright/Camoufox 浏览器方案** — 启动浏览器自动完成 security-check → 获取 token → curl_cffi 请求
2. **RPC 方案** — 远程浏览器服务生成 token，本地 Python 消费
3. **纯 AST 反编译（长期）** — 参考 52pojie 文章，多层 switch 还原 + 提取纯算法

### 待研究

- 多层 switch VMP 的 AST 反编译（3 层嵌套 → 1 层 → 顺序代码）
- 参考文章 4 开源代码：https://github.com/chencchen/webcrawler/tree/master/6,某直聘
- 52pojie 文章纯算思路：https://www.52pojie.cn/thread-2058603-1-3.html

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
