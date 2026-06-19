# spa14.scrape.center API 逆向

## 目标

逆向分析 `https://spa14.scrape.center/api/movie/` 接口的 `sign` 参数生成算法。

## 接口分析

| 项目 | 内容 |
|------|------|
| URL | `https://spa14.scrape.center/api/movie/` |
| Method | GET |
| 参数 | `limit`, `offset`, `sign` |
| 响应 | JSON 明文（count + results 数组） |

## 签名算法

**WASM 反编译结果**：

签名由 Emscripten 编译的 WASM 模块中的 `encrypt` 函数生成。

WASM 函数反汇编：
```wasm
(func (param i32 i32) (result i32)
  local.get 0       ;; offset
  local.get 1       ;; timestamp (Unix seconds)
  i32.const 3
  i32.div_s         ;; timestamp / 3
  i32.add           ;; offset + timestamp / 3
  i32.const 16358   ;; 硬编码常量
  i32.add           ;; offset + timestamp / 3 + 16358
)
```

**Node.js 实现**：
```js
function generateSign(offset, timestamp) {
  return offset + Math.floor(timestamp / 3) + 16358;
}
```

## 技术要点

- **WASM 逆向**：通过 `wasm-objdump -x` 和 hex dump 手动反汇编 Code section
- **关键发现**：`0x6D` 是 `i32.div_s`（有符号除法），而非常见混淆中的 `i32.mul`
- **常量提取**：LEB128 编码 `e6 ff 00` → 有符号值 16358
- **零依赖**：纯 Node.js `https` 模块，无浏览器依赖，Docker 友好

## WASM 文件结构

| Section | 描述 |
|---------|------|
| Type (1) | 5 种函数签名，含 encrypt: (i32,i32)→i32 |
| Function (3) | 5 个函数索引 |
| Table (4) | funcref, min=2, max=2 |
| Memory (5) | 256 pages (16MB) |
| Global (6) | 1 个可变 i32 = 5243920 (栈指针) |
| Export (7) | encrypt, _initialize, stackSave/Restore/Alloc, memory |
| Element (9) | _initialize → func[0] |
| Code (10) | 5 个函数体 |

## 运行

```bash
# 无外部依赖，直接运行
node main.js

# 或在代码中引用
const { generateSign, fetchMovies } = require('./main');
const data = await fetchMovies(0, 10);
```

## 项目结构

```
spa14-scrape-center/
├── main.js          # 主脚本（签名生成 + API 调用）
├── config/
│   ├── chunk-67143ceb.js   # 原始 JS 源码（含 WASM 调用逻辑）
│   └── Wasm.wasm           # WASM 二进制
├── utils/
└── README.md
```
