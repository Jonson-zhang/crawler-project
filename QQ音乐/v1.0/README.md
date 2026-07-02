# QQ音乐 逆向方案

## 概述

QQ 音乐榜单 API (`u6.y.qq.com/cgi-bin/musics.fcg`) 使用三层保护：

| 保护 | 函数 | 位置 | 说明 |
|------|------|------|------|
| **zzc 签名** | `_getSecuritySign2` | vendor.chunk.js 模块 | URL query param `sign`，同步函数 |
| **请求体加密** | `__cgiEncrypt` | vendor.chunk.js 模块 8 (VMP) | POST body，返回 base64，随机 IV |
| **响应体解密** | `__cgiDecrypt` | vendor.chunk.js 模块 8 (VMP) | 解密 API 响应，同步函数 |

其中 `__cgiEncrypt` / `__cgiDecrypt` 位于模块 8 的 **VMP（虚拟机保护）** 中——一个 while(1) + switch/case 字节码解释器，需要解码一段 100KB+ 的编码数据才能产出加密/解密函数。

---

## 三种方案

### 1. env-patch 方案（原始手工补环境）

**目录**: `env-patch/`

**原理**:
- 使用 `.claude/env-patch/env_patch.js` 框架（纯 JS 原型链补环境）
- 在 Node.js 中构建浏览器环境的 Mock
- 加载腾讯 CDN webpack chunk（runtime.js + vendor.chunk.js）
- 调用 `_getSecuritySign2` / `__cgiEncrypt` / `__cgiDecrypt`

**调用方式**:
```bash
node env-patch/qqmusic_api.js sign '{"test":"hello"}'
node env-patch/qqmusic_api.js encrypt '{"comm":{...}}'
```

**关键文件**:
| 文件 | 来源 | 作用 |
|------|------|------|
| `qqmusic_api.js` | 手写 | 加载器 + CLI 入口 |
| `qqmusic.py` | 手写 | Python 爬虫 |
| `env_site.js` | 手写 | env_patch 配置 |
| `runtime.js` | QQ音乐 CDN | webpack 运行时 |
| `vendor.chunk.js` | QQ音乐 CDN | 业务模块（含 VMP 加密） |
| `common.chunk.js` | QQ音乐 CDN | 辅助模块 |

**实现路径**: Python → subprocess → node qqmusic_api.js → 每次调用独立进程

---

### 2. iv8 方案（Python C++ V8 嵌入）

**目录**: `iv8/`

**原理**:
- iv8 是 Python 原生 C++ V8 嵌入，在同进程中创建 V8 Isolate
- sign 在 iv8 V8 引擎中直接执行（1ms），无需 subprocess
- encrypt/decrypt 因 VMP 执行上下文检测问题，回退到 `qqmusic_api.js` subprocess

**为什么 encrypt 不能纯 iv8**:
```
VMP 模块 8 的字节码解释器能检测到代码执行的 V8 上下文：
  - node file.js（Module 上下文）→ 解码成功 ✅
  - ctx.eval()（Script 上下文）→ 解码失败 ❌
  
这并非环境补丁问题，而是 V8 引擎层的脚本编译模式差异。
iv8 的 ctx.eval() 无法模拟 Node.js 的 CommonJS 模块加载上下文。
```

**混合架构**:
```
sign → iv8 V8 同进程 (1ms)
encrypt → subprocess → node env-patch/qqmusic_api.js (200ms)
decrypt → subprocess → node env-patch/qqmusic_api.js (200ms)
```

**关键文件**（全部在 `iv8/` 目录，自包含）:
| 文件 | 来源 | 作用 |
|------|------|------|
| `qqmusic_iv8.py` | 手写 | Python 入口（iv8 V8 + subprocess 回退） |
| `qqmusic_api.js` | 复制自 env-patch | encrypt/decrypt 回退入口 |
| `env_site.js` | 手写 | env_patch 配置 |
| `runtime.js` | QQ音乐 CDN | webpack 运行时 |
| `vendor.chunk.js` | QQ音乐 CDN | 业务模块 |
| `common.chunk.js` | QQ音乐 CDN | 辅助模块 |

**调用方式**:
```bash
cd iv8
python qqmusic_iv8.py --toplist 62
```

---

### 3. sdenv 方案（C++ V8 Addon + jsdom）

**目录**: `sdenv/`

**原理**:
- sdenv = C++ V8 Addon + 魔改 jsdom，提供完整的 Chrome 浏览器环境
- 比 env_patch 更完整的 DOM API（真实 Canvas、EventTarget 原型链、CookieJar）
- sign 在 sdenv 环境中直接执行
- encrypt/decrypt 因与 env-patch 相同的 VMP 上下文问题，回退子进程

**混合架构**（同 iv8）:
```
sign → sdenv jsdom 环境 (200ms)
encrypt → subprocess → node env-patch/qqmusic_api.js (200ms)
decrypt → subprocess → node env-patch/qqmusic_api.js (200ms)
```

**关键文件**（全部在 `sdenv/` 目录，自包含）:
| 文件 | 来源 | 作用 |
|------|------|------|
| `runner.js` | 手写 | Node.js 入口（env_patch + subprocess 回退） |
| `qqmusic_sdenv.py` | 手写 | Python 爬虫 |
| `env_site.js` | 手写 | env_patch 配置 |
| `runtime.js` | QQ音乐 CDN | webpack 运行时 |
| `vendor.chunk.js` | QQ音乐 CDN | 业务模块 |

**调用方式**:
```bash
cd sdenv
python qqmusic_sdenv.py --toplist 62
```

---

## VMP 解码问题详解

### 现象

| 测试方式 | `_getSecuritySign2` | `__cgiEncrypt` | 执行上下文 |
|---------|:------------------:|:--------------:|-----------|
| `node env-patch/qqmusic_api.js` | ✅ function | ✅ function | CommonJS Module |
| `node env-patch/test_replicate.js` | ✅ function | ✅ function | CommonJS Module |
| `node sdenv/runner.js` | ✅ function | ❌ undefined | async 函数内 |
| `node -e "..."` | ✅ function | ❌ undefined | Script 上下文 |
| iv8 `ctx.eval()` | ✅ function | ❌ undefined | Script 上下文 |

### 原因

VMP 模块 8 的字节码解释器在执行过程中，检测了代码的执行上下文。具体检测手段可能包括：

1. **`Error().stack` 分析** — 检查堆栈帧是否包含 `eval` 或 `module` 标识
2. **`arguments.callee` / `caller`** — 检测调用者上下文
3. **V8 隐藏类（Hidden Class）差异** — Module 与 Script 模式下 V8 对函数的编译优化策略不同

这类检测在 **JS 层无法绕过**，因为它是 V8 引擎本身的行为差异。无论补多少个环境属性（window、document、navigator），只要执行上下文是 Script 而非 Module，VMP 就拒绝解码。

### 唯一可靠的绕过方式

```
subprocess → node env-patch/qqmusic_api.js → CommonJS Module 上下文中解码
```

这就是三个方案都保留 subprocess 回退的原因。

---

## 方案选择

| 维度 | env-patch | iv8 | sdenv |
|------|-----------|-----|-------|
| **运行时** | Node.js 进程 | Python V8 嵌入 | Node.js 进程 |
| **sign 延迟** | ~200ms (subprocess) | ~1ms (同进程 V8) | ~200ms (subprocess) |
| **encrypt 延迟** | ~200ms (subprocess) | ~200ms (subprocess) | ~200ms (subprocess) |
| **安装依赖** | env_patch.js (本地) | `pip install iv8` | sdenv (C++ Addon) |
| **编码问题** | GBK 需处理 | ✅ 纯 UTF-8 | GBK 需处理 |
| **文件自包含** | 所有文件在 env-patch/ | 所有文件在 iv8/ | 所有文件在 sdenv/ |

**推荐**: 追求最快 sign 用 iv8（1ms），追求简单统一直接用 env-patch 的 `qqmusic_api.js`。
