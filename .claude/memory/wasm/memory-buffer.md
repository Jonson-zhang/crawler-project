---
name: memory-buffer
description: WASM memory buffer 不能缓存引用——每次调用前后必须重新获取
metadata:
  type: feedback
---

每次调用 WASM 导出函数前后**必须**重新获取 `memory.buffer`。禁止缓存 `Uint8Array` 引用跨多次 WASM 调用。

**Why:** `__wbindgen_realloc`（wbg 内部的内存重分配）可能触发 `WebAssembly.Memory.grow()`，导致旧的 `ArrayBuffer` 被 detach。缓存的 `Uint8Array` 指向已释放内存，后续读写静默操作无效缓冲区——不抛异常，读出来的是旧数据或无意义的零值。

**How to apply:**
- ❌ 缓存：`const mem = new Uint8Array(instance.exports.memory.buffer); /* 跨多次调用复用 */`
- ✅ 每次重新获取：
  ```js
  function getMemory() {
    return new Uint8Array(instance.exports.memory.buffer);
  }
  function readWasmString(ptr) {
    const mem = getMemory(); // 不缓存
    // ...
  }
  ```
- 经验法则：任何涉及 `memory.buffer` 的地方，写成函数调用 `getMemory()` 而非变量引用

相关：[[string-abi]] [[stub-template]]
