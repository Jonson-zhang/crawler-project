---
name: string-abi
description: wbg 字符串传参有两种不可混用的 ABI——单指针模式 vs (ptr, len) 对
metadata:
  type: feedback
---

wasm-bindgen 的字符串传参有两种 ABI，**不可混用**：

- **模式 A**：`passStringToWasm0` — 单个 i32 指针，字符串长度以内部头方式编码在指针前 4 字节
- **模式 B**：显式 `(ptr, len)` 对 — 两个 i32，分别传指针和长度

gen_stub_template.js 通过参数个数可以区分：1 个 i32 = 模式 A，2 个 i32 = 可能是模式 B。但最终确认必须靠浏览器 trace 捕获实际调用值。

**Why:** 用错模式不会报错——WASM 读到错误内存区域，签名结果看起来正常但值是错的（米画师逆向中因此浪费大量时间排查签名不一致）。

**How to apply:**
1. 用 gen_stub_template.js 获取参数个数后，标注每个字符串参数是 1 个还是 2 个 i32
2. 不确定时用 MCP trace（hook_function + get_console_logs）捕获浏览器侧实际调用值
3. 1 i32 = `(str) => passStringToWasm0(str)`，2 i32 = `(str) => { const ptr = alloc(str); return [ptr, strLen]; }`
4. 纯 ASCII 字符串（token、URL 路径）两种模式产生的签名外观可能相同，容易漏判——必须用中文测试字符串验证

相关：[[stub-template]]
