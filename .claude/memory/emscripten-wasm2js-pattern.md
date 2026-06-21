---
name: emscripten-wasm2js-pattern
description: Emscripten wasm2js 模块的识别和在 Node.js 中加载的标准模式——与 wasm-bindgen 完全不同，不需要 stub 生成
metadata:
  type: project
---

## 识别

```
特征:
  - JS 文件 ~1MB，开头带 "Copyright 2010 The Emscripten Authors"
  - 内部有 `var wasmBinaryFile = 'xxx.wasm'` 注释（但 .wasm 文件可能不存在）
  - 使用 `Module._malloc`、`Module.HEAP8`、`Module.cwrap` API
  - 无 `wbg.__xxx` 导入函数（非 wasm-bindgen）

vs wasm-bindgen:
  - wasm-bindgen 有 .wasm 文件 + wbg 导入函数表
  - Emscripten 把 C++ 编译成 JS，无外部导入
```

## Node.js 加载（唯一标准方式）

```js
global.Module = require('./wbsk_Wbox.js');
// 完成。无需 self/window/document/crypto/DOM。
```

**Why**: Emscripten 编译输出自带 `ENVIRONMENT_IS_NODE` 分支，内置 `module.exports = Module`。

**常见错误**: 写成 `global.Module = {}` 然后 `require('./wbsk_Wbox.js')`——这样 `global.Module` 只是空对象，`_malloc`、`cwrap` 等方法没挂上去。必须用 `require` 的返回值。

## 提取导出函数签名

```bash
# 从 wasm2js 源码中提取（不需要 .wasm 文件）
grep -o 'asm\["[^"]*"\]' wbsk_Wbox.js | sort -u

# 函数签名来自于 C 源码，通过 cwrap 的类型参数确定：
Module.cwrap('wbsk_AES_cbc_encrypt', 'number', ['array','number','number','number','array','number'])
#                                         返回值      参数1    参数2   参数3   参数4   参数5   参数6
```

**不需要 wasm-objdump**——Emscripten wasm2js 无 .wasm 文件。

## 与 wasm-bindgen 的对比

| | wasm-bindgen | Emscripten wasm2js |
|---|---|---|
| 原始 .wasm | ✅ 有 | ❌ 编译为 JS |
| stub 生成 | wasm-objdump -x | **不适用** |
| 导入函数 | wbg.__xxx (30+) | 无 |
| Node 环境 | self/window/document/crypto 全套补 | 仅 global.Module = require() |
| SKILL | wasm-reverse | **本文档** |

## 东航案例

- 文件: wbsk_Wbox.js (~1MB, wasm2js)
- 导出: wbsk_AES_ecb_encrypt/decrypt, wbsk_AES_cbc_encrypt/decrypt, wbsk_skb_encrypt/decrypt
- IV: `[121,96,7,103,57,95,61,124,121,96,7,103,57,95,61,124]`
- 环境补丁: 一行 `global.Module = require('./wbsk_Wbox.js')`
- 无需 self/window/document/crypto
