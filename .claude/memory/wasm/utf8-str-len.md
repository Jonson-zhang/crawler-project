---
name: utf8-str-len
description: WASM 字符串长度 = TextEncoder.encode(str).length，不是 str.length
metadata:
  type: feedback
---

向 WASM 写入字符串时，长度必须用 **UTF-8 字节数**，不是 JS 的 `.length`。

```js
// ❌ 错误——str.length 是 UTF-16 码元数
const len = str.length;

// ✅ 正确——WASM 需要 UTF-8 字节数
const encoded = new TextEncoder().encode(str);
const len = encoded.length;
```

**Why:** JS 字符串的 `.length` 是 UTF-16 码元数。中文 "中国" = 2 码元，UTF-8 = 6 字节。用错会导致缓冲区只有实际需要的 1/3 大小，数据截断。纯 ASCII 字符串（token、URL 路径、数字）两者相同，bug **只在非 ASCII 字符时暴露**——测试时容易漏掉，线上签名间歇性失败。

**How to apply:**
1. 所有 WASM 字符串写入的通用函数：
   ```js
   function writeString(memory, str, ptr) {
     const encoded = new TextEncoder().encode(str);
     new Uint8Array(memory.buffer, ptr, encoded.length).set(encoded);
     return encoded.length; // 不是 str.length
   }
   ```
2. 写测试时**必须**包含中文/Unicode 字符串，不能只用 ASCII 测
3. 发现签名"偶尔有效"但不确定原因时，优先排查这一条

相关：[[memory-buffer]]
