---
name: iv8-nodejs-workflow
description: Node.js 勘探 + iv8 交付的两阶段逆向工作流——MCP 提取原料，Node.js 调试算法，iv8 纯 Python 交付
metadata:
  type: project
---

# Node.js 勘探 + iv8 交付 — 两阶段逆向工作流

经过 Boss直聘、知乎、小红书三个站点的 iv8 迁移实战验证的标准流程。

## 核心原则

**Node.js 是勘探工具，iv8 是交付产物。前者追求迭代速度，后者追求零依赖。**

反过来的代价：小红书 iv8 迁移中花了 3+ 小时追 VMP 环境差异（mnsv2 128 vs 192 字符），最终发现是三个 Python 语法错误，与 iv8 环境完全无关。在 Node.js 中这些错误 5 分钟就能定位——有堆栈、有 console.log。

## 四阶段流程

### 阶段零：MCP 勘探（浏览器提取原料）

**工具**：camoufox-reverse / js-reverse MCP

**产出**：
- Chunk JS 文件（runtime.js / vendor.js / 签名 chunk）
- Cookie（浏览器登录一次，导出 cookies.json）
- API 请求格式（Network 面板抓取 Header 格式）
- Canvas 指纹样本（一次性从 DevTools Console 提取 base64 PNG）

**为什么不能跳过**：本地无法发 HTTP 请求达到浏览器 TLS 指纹级别（WAF 检测），登录页验证码无法纯算。

**只做一次**：Cookie 有 30 天有效期，Canvas 指纹固定不变，chunk 只在站点发版时更新。

### 阶段一：Node.js 勘探（边猜边测，快速试错）

**工具**：Node.js `vm.createContext` + 手写 env.js 补环境

**工作流**：
```
改一行 env.js → node sign.js → 看报错堆栈 → 再改 → 5 秒一轮
```

**为什么 Node.js 适合勘探**：

| 特性 | Node.js | iv8 |
|------|:---:|:---:|
| VMP 错误反馈 | ✅ 报错 crash，堆栈精确定位行号 | ❌ 静默失败 `mnsv2: undefined` 无堆栈 |
| document/window 操作 | ✅ 随便赋值 `document = {...}` | ❌ document 不可替换，必须用 getter |
| require() 模块隔离 | ✅ 天然正确 | ❌ 需要手动 IIFE 包裹 |
| 调试输出 | ✅ `console.log` 直接可见 | ⚠️ 需要 `ctx.eval("...")` 逐层插入 |
| 每次修改 → 看到结果 | ~1 秒 | ~3ms（但调试时反而慢，因为反馈差） |

**这个阶段的产出不是代码，是认知**：
- 签名函数的调用签名（参数是什么，返回什么）
- 签名 payload 的结构（JSON 键名、编码格式）
- 环境依赖清单（VMP 读了哪些属性）
- setter 拦截模式（VMP 升级机制）

### 阶段二：iv8 迁移（把已知逻辑搬过去）

**工具**：iv8 (C++ V8 引擎)

**工作流**：
```
Node.js 已跑通的逻辑 → 照抄到 iv8 ctx.eval() → 修 iv8 特有坑 → 测试通过
```

**iv8 独有的三个坑（每个站点都会遇到，记忆即解决）**：

| 坑 | 症状 | 修复 |
|---|------|------|
| `if body` 空 dict 判空 | x-s 签名被 API 拒（activate 406） | 改 `if body` → `if body is not None` |
| `_json_to_bytes(json.dumps(...))` | x-s 前缀与 Node.js 完全不同 | 直接传 dict |
| document 不可全局替换 | `document = {...}` 无效 | `Object.defineProperty(document, ...)` |

> **关键原则**：iv8 迁移遇到签名不匹配时，**先检查 Python 代码 bug**（特别是 Python/JS 语义差异），再怀疑 iv8 环境差异。小红书迁移中 90% 的调试时间浪费在追 env 对齐上，实际三个 bug 都是纯 Python 问题。

### 阶段三：交付（纯 Python，零外部依赖）

**产出**：`pip install iv8 requests` 即可运行，无 Node.js、无 npm、无浏览器。

## 站点复杂度 vs iv8 可行性的快速判定

| 指标 | 轻量（知乎） | 中等（小红书） | 重型（Boss直聘） |
|------|:---:|:---:|:---:|
| VMP 检测深度 | 无 VMP | VMP 读 doc.body + doc.cookie | VMP 53+ 检查点 |
| Canvas 指纹 | ❌ 不需要 | ❌ 不需要 | ✅ 需要精确 png base64 |
| iv8 可行性 | ✅ 一行改完 | ✅ 三行 Python bug | ✅ 需要 Canvas 指纹文本 |
| iv8 迁移耗时 | ~10 分钟 | ~4 小时（踩了上述三个坑）| ~1 小时 |

**关键结论**：iv8 无法通过的环境检测的站点极少——Boss直聘的 53 检查点都能过。VMP 的"检测"目标不是 iv8 这类真 V8 引擎，而是 jsdom/Node.js vm 这类 JS 层模拟——iv8 C++ API 在这些检查点上与真实 Chrome 无法区分。

## 与 Skill 的配合

- **`hello_js_reverse_skill`** 提供 Phase 1-5 流程路由：locate（定位加密代码）→ recover（提取 JS 资产）→ runtime（补环境让 JS 能在本地执行）→ validation（验证签名）
- 在 **locate/recover** 阶段：用 MCP (camoufox-reverse + js-reverse) 完成浏览器勘探
- 在 **runtime** 阶段：用 Node.js vm 快速迭代补环境
- 在 **final** 阶段：迁移到 iv8 做纯 Python 交付

**Why:** 每个工具做它最擅长的事——MCP 提取原料、Node.js 快速试错、iv8 纯净交付。一个工具包打天下会导致两难：iv8 调试体验差徒增痛苦，Node.js 方案带 Node.js 依赖无法独立部署。
**How to apply:** 接新站点时先走完 Node.js 勘探（搞清签名逻辑），再考虑是否需要 iv8 迁移。如果站点检测极浅（如知乎），可以跳过 Node.js 直接用 iv8。
