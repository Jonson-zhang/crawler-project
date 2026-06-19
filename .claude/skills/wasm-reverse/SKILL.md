---
name: wasm-reverse
description: Reverse-engineer WASM-based API signatures. Generate correct wbg stub templates from wasm-objdump Type section, avoid silent argument-count bugs. Use when analyzing .wasm files, wasm-bindgen modules, or API endpoints with WASM-generated signatures.
---

# WASM 逆向工程

## 核心原则

**wasm-bindgen 生成的 wbg 导入函数，参数数量错了不会崩溃——会静默产生错误结果。**

永远不要猜参数数量。从 WASM 二进制本身获取。

## 运行时选择

| 运行时 | 结论 |
|--------|------|
| Node.js `new WebAssembly.Instance` | ✅ 唯一推荐 |
| wasmtime / wasmtime-py / wasmtime-go | ❌ 禁止 |

wasmtime 是独立 WASM 运行时，不兼容 wasm-bindgen 体系。wbg 函数深度依赖 JS 对象引用链和 Web API。仅在 WASM 完全不依赖任何 Web API（无 wbg 导入）时才可考虑 wasmtime。

## 前置条件

```bash
npm install -g wabt
```

## 流程

### 一、生成 stub 骨架（不猜参数数量）

```bash
wasm-objdump -x target.wasm | node gen_stub_template.js
```

输出是完整的 `wbg = { ... }` 对象骨架。每个函数的参数数量来自 WASM Type section，100% 准确。复制进 sign.js 直接填实现。

### 二、最小环境，先跑起来

以**能跑通 WASM 导出的入口函数为第一目标**（用 `wasm-objdump -x` 看 Export section），不要预先补一堆可能不需要的环境。

最小启动模板：

```js
// 用模板生成的 wbg 复制到这里，每个函数返回 0 或空实现

// self 引用链（大部分 wasm-bindgen 模块需要）
var fakeWindow = { crypto: globalThis.crypto, document: fakeDoc,
                   navigator: { userAgent: '...' } };
globalThis.self = fakeWindow;
globalThis.window = fakeWindow;
```

WASM 通过 `SELF() → crypto(selfRef) → getRandomValues(selfRef, bufRef)` 链式访问，所以 fakeWindow 上必须直接挂相关属性。

跑第一次：`node sign.js`。三种可能结果：

| 结果 | 下一步 |
|------|--------|
| 跑通，签名输出正常 | → 三 |
| unreachable | → 查「崩溃症状」 |
| 跑通但服务器 403 | → 查「签名无效症状」 |

### 三、验证 + 补环境

端到端请求 API，看服务器返回。HTTP 200 + 数据 = 完成。否则按症状查表。

### 四、按症状匹配

> 下面所有坑都不是每次都触发。**先跑最小环境，遇到哪个查哪个。**

---

#### 崩溃症状

**`RuntimeError: unreachable`（初始化阶段——调用 WASM 导出的初始化函数时崩溃）**

可能原因及排查顺序：

| # | 检查项 | 怎么验证 |
|---|--------|---------|
| 1 | 引用表初始化是否用了 `!0`/`!1` 而非 `true`/`false` | 改为 `table.push(void 0, null, !0, !1)` |
| 2 | 是否有 `__wbg_randomFillSync` 且 Node 侧 crypto 缺少该方法 | `globalThis.crypto.randomFillSync = ...` 补上 |
| 3 | `__wbg_newwithlength` 的 len 参数是否是原始值（未错误地调 getRef） | 确认 `function(len) { return add(new Uint8Array(len >>> 0)) }` |
| 4 | WASM 是否有 `__wbg_eval` / `__wbg_require` 等 Node 检测，需要伪装 | 这些函数全返回 0，让 WASM 以为不在 Node 环境 |

**`RuntimeError: unreachable`（签名阶段——调用 WASM 导出的签名函数时崩溃）**

| # | 检查项 | 怎么验证 |
|---|--------|---------|
| 1 | `crypto.getRandomValues` 触发的非确定性路径 | 加重试循环 |
| 2 | `__wbg_set(targetRef, srcRef, offset)` — offset 是否错误地调了 getRef | 应该是 `get(target).set(get(src), offset)` |

**非确定性 unreachable 的重试模板**：

```js
for (var attempt = 0; attempt < 10; attempt++) {
    try { return sign(url, ts); }
    catch (e) { signer = null; if (attempt >= 9) throw e; }
}
```

---

#### 签名无效症状

**服务器返回 403 "signature invalid" 或 200 + 空 body**

签名能跑通、格式正确、但密码学上无效。原因一定是某个 wbg 函数的**语义错了**（参数数量对，但返回值不对）。

| # | 可能原因 | 排查方向 |
|---|---------|---------|
| 1 | `__wbg_crypto(selfRef)` 返回的不是 `self.crypto` | 应该 `add(get(selfRef).crypto)`，不是 `add(require('crypto'))` |
| 2 | `__wbg_navigator(selfRef)` 返回的不是 `self.navigator` | 应该从 selfRef 链上取，不是新建空对象 |
| 3 | `__wbg_document(selfRef)` 返回的不是 `self.document` | 同上 |
| 4 | `__wbg_new_a12002a7f91c75be(bufRef)` — 参数是 buffer 引用还是 (ptr,len) | 模板标注了 `(i32)→i32`，就是单参数 bufRef |
| 5 | DOM 值（favicon、keywords 等）是否与真实页面一致 | 从浏览器实时提取 |
| 6 | `__wbg_getAttribute` / `__wbg_querySelector` 参数是 ref 还是 (ptr,len) | 这两个函数的字符串参数是从 WASM 内存直传的 |

**判断 key 是否派生正确的办法**：与另一个已知可行的实现（如有）相同时间戳对比签名，看中间段是否一致。

---

#### 环境检测症状

**启动时立即崩溃 / 报找不到 process / 报 require is not defined**

| # | 现象 | 对策 |
|---|------|------|
| 1 | WASM 尝试访问 `process.versions.node` | 所有 `__wbg_process`/`__wbg_versions`/`__wbg_node`/`__wbg_require` 返回 0 |
| 2 | 崩溃在 `delete global` / `delete process` 之后 | 在 require 前保存 Node API：`var _argv=process.argv`，再删 |
| 3 | `__wbg_instanceof_Window` 检测失败 | `Location = function Location() {}` 赋值到全局变量名，不用 `function Location() {}` |
| 4 | `__wbg_newnoargs` 通过 eval 执行代码报错 | 代码字符串传自 WASM 内存，确认 readStr 正确 |

注意：`delete global; delete process;` 不是所有 WASM 都需要。**先不要删**，只有 WASM 启动时报 Node 检测相关错误才加。米画师不需要这行，荔枝网需要。

## 调用约定速查

wbg 函数有三种参数模式，实现新函数前先判断：

| 模式 | 签名特征 | 参数含义 | 示例 |
|------|---------|---------|------|
| 返回 ref | `→i32` | 全是 ref | `__wbg_crypto(selfRef)` → `return add(...)` |
| 写入 outPtr | `(i32,i32,...)→void` | 第一个 i32 = WASM 内存指针 | `__wbg_getAttribute(outPtr, elRef, ptr, len)` → 结果写到 outPtr |
| 混合 | `(ref, ref, raw)` | 前几个 ref，最后是原始值 | `__wbg_set(targetRef, srcRef, offset_raw)` → offset 不调 getRef() |

**字符串参数**：看函数名判断传递方式：

| 模式 | 函数名特征 | 怎么读 |
|------|-----------|--------|
| 返回 ref | `string_new` | 参数是 (ptr, len)，从 WASM 内存读 |
| 写入 outPtr | `string_get` | 结果不 return，写到 outPtr |
| 直传 | `querySelector`、`getAttribute`、`newnoargs` | 字符串参数是 (ptr, len) 从 WASM 内存读，不经过引用表 |

## 工具边界

| 能自动化 | 必须人工 |
|---------|---------|
| 参数数量 → Type section | 参数语义（ref vs raw）→ 浏览器 trace |
| 函数骨架 → gen_stub_template.js | DOM 环境值 → 浏览器采集 |
| unreachable 位置 → wasm-objdump | unreachable 根因 → 按症状查表 |

## 便携说明

复制整个 `wasm-reverse/` 目录到任意项目的 `.claude/skills/` 下即可生效。
依赖：Node.js + `npm install -g wabt`。
