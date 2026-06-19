# 米画师 (mihuashi.com) — WASM 签名逆向

## 反爬类型

**WASM 签名**（wasm-bindgen 模块 `mhs_fe_sign_bg.wasm`）

- 签名参数通过 HTTP Headers 发送: `m-s` (签名), `m-t` (时间戳)
- WASM 内嵌环境指纹检测（DOM 查询 favicon、meta 标签等）
- 签名算法: `signtool.sign(url, timestamp_sec)` → 签名字符串
- 时间戳精度: Unix 秒

## 文件说明

| 文件 | 说明 |
|------|------|
| `sign.js` | Node.js WASM 签名模块（42 个 wbg 导入 + 环境伪装）|
| `sign.py` | Python 签名封装（通过 subprocess 调用 sign.js）|
| `crawl.py` | Python 爬虫入口（调用 sign.py 获取签名后发请求）|
| `mhs_fe_sign_bg.wasm` | 原始 WASM 文件（64979 bytes, 9 exports, 42 imports）|
| `http_NcR9CHD7.js` | 浏览器端 JS 胶水代码（参考实现）|

## 环境要求

- Node.js >= 19（`WebAssembly.instantiate` + `globalThis.crypto`）
- Python >= 3.10 + `requests`

## 使用

```bash
# 测试签名
python sign.py

# 爬取画师（默认 3 页）
python crawl.py

# 爬取画师（指定 5 页）
python crawl.py 5
```

## 技术要点

### WASM 导入 (42 个 wbg 函数)

由 wasm-objdump Type section 生成精确的参数签名，在 Node.js 中实现等价语义:

- `signtool_new()` — 创建签名器实例
- `signtool_sign(stackPtr, ptr, urlPtr, urlLen, timestamp)` → 输出签名字符串
- crypto 操作: `getRandomValues`, `randomFillSync`
- DOM 指纹: `querySelector`, `getAttribute` 读取 favicon/meta 等
- 环境检测规避: `process`/`versions`/`node`/`require`/`GLOBAL` 全部返回 0

### 环境伪装要点

1. **crypto**: Node.js `getRandomValues` 需要绑定到原生 `Crypto` 实例，否则 `TypeError: Value of "this" must be of type Crypto`
2. **DOM**: WASM 查询 `link[rel*='icon']` 获取 favicon URL，`meta[name='keywords']` 等，需构造 `getAttribute` 方法
3. **Node 检测隐藏**: `__wbg_process`/`__wbg_versions`/`__wbg_node`/`__wbg_require`/`__wbg_GLOBAL` 全部返回 0
4. **非确定性重试**: 签名内部使用 `getRandomValues`，偶发 unreachable，需加 10 次重试
