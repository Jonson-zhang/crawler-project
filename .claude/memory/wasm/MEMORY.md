# WASM 逆向经验

> 此目录下的 memory 不会自动加载。Agent 在检测到 WASM 逆向场景时（用户提及 WASM/wasm-bindgen/wbg/signtool 或要求补 WASM 环境），应主动 `Read` 本文件再按需加载具体 memory。

- [trace 先于 code](trace-first.md) — WASM 补环境第一步是对 signtool_new/signtool_sign 做完整 wbg 调用追踪，不是直接写 stub
- [stub 模板生成器](stub-template.md) — 逆向 WASM 时必须先用 gen_stub_template.js，防止参数签名错误导致静默正确性 bug
- [禁止 wasmtime](no-wasmtime.md) — WASM 逆向只用 Node.js WebAssembly.Instance，不用 wasmtime
- [字符串 ABI](string-abi.md) — wbg 字符串传参有两种不可混用的 ABI：单指针 vs (ptr, len) 对
- [memory buffer 不可缓存](memory-buffer.md) — 每次调用 WASM 前后必须重新获取 memory.buffer
- [UTF-8 字符串长度](utf8-str-len.md) — WASM 字符串长度 = TextEncoder.encode(str).length，不是 str.length
