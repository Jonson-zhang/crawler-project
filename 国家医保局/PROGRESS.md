# 国家医保局 API 逆向 — 进度报告

> 2026-06-30

## 目标

```
POST https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital
```

完整还原签名/加密，纯 Python 协议调用，无浏览器依赖。

## 已完成

### 1. 网络抓包 ✅

4 组完整的请求/响应样本保存在 `config/samples.json`，格式：

```
请求头: x-tif-signature(64hex) + x-tif-timestamp(秒) + x-tif-nonce(8位)
请求体: {data: {data: {encData: "hex"}, appCode, version, encType:"SM4", signType:"SM2", timestamp, signData: "base64"}}
响应体: {code, data: {data: {encData: "hex"}, encType, signType, appCode, version, timestamp, signData}}
```

### 2. JS 源码分析 ✅

| 项目 | 详情 |
|------|------|
| 主文件 | `app.1781684502962.js` (3.7MB) |
| 混淆方式 | OB (obfuscator.io), 10224 字符串表 |
| XOR 解码密钥 | `[0x13, 0x07, 0x1f, 0x2b, 0x0b, 0x1d, 0x25]` |
| 加密库 | `sm-crypto` 内嵌 (sm2/sm3/sm4) |
| SM2 模块 ID | 字符串表 [882] = "sm2" |
| SM3 模块 ID | 字符串表 [2020] = "sm3" |
| SM4 模块 ID | 字符串表 [8320] = "sm4" |

### 3. 密钥材料提取 ✅

从 XOR 解码的字符串表中提取的关键材料：

```
_0x3d8a47 = {
    'a': "NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P"     // 32 chars, 疑似 base32 编码
    'b': "1.0.0"                                  // version
    'c': base64(65 bytes)                         // SM2 公钥: 04 || x(32) || y(32)
    'd': base64(33 bytes)                         // SM4 密钥材料
    'e': "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"     // appCode !!
}
```

解码细节：
- `c_val` = base64 → 65 bytes → `04` + 64 hex = SM2 public key
- `e_val` = XOR 解码 → **appCode** = `T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ`
- appCode 的 bytes → hex → 64 hex chars → 正好 SM2 私钥长度!

SM2 私钥 = `Buffer.from("T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ", "ascii").toString("hex")`
= `"543938485043474e355a5656514253384c5a514e4f4145585649394759484b51"`

### 4. 加密流程还原 ✅

从 app.js 代码分析确认的调用链：

```javascript
// 1. 生成 SM2 密钥对
const kp = sm2.generateKeyPairHex();           // _0x2650 → "generateKeyPairHex"

// 2. SM4 加密查询参数
const encData = sm4.encrypt(plaintext, key, {mode:'cbc', iv:0});  // _0x19ac → "doEncrypt"

// 3. SM2 签名
const signData = sm2.doSignature(innerJson, appCodeBytes, {hash: false});
                                                // _0xf8c → "doSignature"
// 4. x-tif-signature
const sig = SHA256(???)                         // 精确输入待确认
```

### 5. 项目文件 ✅

```
国家医保局/
├── 加密服务器.js          # Node.js 加密服务器 (sm-crypto, JSON-RPC/CLI)
├── main.py               # Python 客户端
├── iv8_bridge.js          # iv8 (V8) 环境补丁
├── nhsa_iv8.py            # iv8 Python 封装
├── decode_key.py          # XOR 密钥解码器
├── decode_strings.py      # OB 字符串表解码器
├── extract_keys_jsdom.js  # jsdom 密钥提取
├── real_request.js        # jsdom + 真实 HTTP 请求
├── find_key.js            # 已知明文攻击密钥推导
├── config/
│   ├── samples.json       # 4 组请求/响应样本
│   ├── app.js             # 页面 JS (3.7MB)
│   └── keys.example.json  # 密钥配置模板
├── utils/
│   ├── sm_crypto.py       # SM2/SM3/SM4 Python 封装
│   └── signer.py          # 请求签名器
├── README.md              # 项目文档
└── PROGRESS.md            # 本进度报告
```

## 待解决

### ⚠️ x-tif-signature 算法 (阻塞项)

- **格式**: SHA-256 (64 hex) 已确认
- **输入**: **未知**，已穷举测试以下组合均不匹配：
  ```
  SHA256(appCode+ts+nonce)
  SHA256(appCode+ts+nonce+body)
  SHA256(appCode+ts+nonce+body_noSign)
  SHA256(ts+nonce+body)
  SHA256(encData+ts+nonce)
  SHA256(ts+nonce+appCode)
  SHA256(appCode+body)
  HMAC-SHA256(appCode, ts+nonce+body)
  ... (30+ 组合)
  ```

- **可能原因**:
  1. 签名中包含某个 session secret 或动态生成的 token
  2. 签名计算的时机在 signData 填入之前（body 组装时缺 signData）
  3. app.js 中有反调试/防篡改代码改变了运行行为

- **验证方法**:
  ```
  浏览器 MCP → Hook XMLHttpRequest.prototype.setRequestHeader
  在 setRequestHeader('x-tif-signature', value) 时同时捕获:
    1. 此时的完整 body (this.__body)
    2. 当前的 timestamp/nonce
  然后从外围反向推导 SHA256 输入
  ```

### ⚠️ SM4 密钥 (部分阻塞)

- **线索**: `_0x3d8a47['d']` 解码后 33 bytes
- **已测试**: d[0:16], d[1:17], d[17:33], SM3(appCode)[:16], MD5(appCode), SHA256(appCode)[:16], 皆不匹配
- **验证方法**: 用 jsdom 加载 app.js 后拦截 Uint8Array(16) 创建，找到 SM4 密钥

### ⚠️ iv8 加载 app.js

- 前 500KB 正常，之后报 `undefined is not a function`
- 原因: 缺少某个 Web API (可能在 Worker/MessagePort/navigation 相关)
- **备选**: jsdom 可以完整加载 app.js (已验证)

## 降级方案

如果 x-tif-signature 短期内无法还原，以下方案可用：

### 方案 A: jsdom 加密服务器

```
Node.js (jsdom + app.js) → 真实 HTTPS 请求
                         → 签名由 app.js 自身完成
                         → Python 通过 stdin/stdout 调用
```

### 方案 B: CDP 桥接

```
Python → Chrome CDP → evaluate_js → DOM 操作 → 触发搜索
                                    → 拦截 XHR → 返回加密请求
```

### 方案 C: Node.js 加密服务器 (当前)

```
Python → subprocess → 加密服务器.js (sm-crypto npm)
       → SM2(appCode) + SM4(SM3(appCode)[:16]) 生成加密请求
       → API 返回 173370 (签名不匹配)
```

## 2026-06-30 进展

### 6. jsdom 验证 ✅

jsdom 可以成功加载 app.js (3.7MB) 并生成有效的加密请求:

```
jsdom → app.js → selectByKeys API 调用
→ x-tif-signature 正确生成 (SHA-256, 64 hex)
→ SM2 签名正确 (base64)
→ SM4 加密正确
```

**关键发现**:
- Vue 组件不会渲染 (`#app` 为空)，但 API 服务层正常初始化
- `selectByKeys` 在 app.js 加载期间自动触发 (不带用户交互)
- `queryFixedHospital` 需要 Vue 搜索组件触发，jsdom 中不可用
- 加密模块 (sm2/sm3/sm4) 在 webpack 闭包内，无法通过 `window` 访问

### 7. x-tif-signature 算法分析

**穷举测试结果**: 对所有合理组合 (appCode+ts+nonce+body 的 SHA-256/SM3/HMAC 各种排列) 均不匹配。

**结论**: x-tif-signature 包含某种**动态会话密钥**，可能:
- `sm2.generateKeyPairHex()` 生成的私钥参与计算
- 某个 session-level secret 在初始化阶段生成
- SHA-256 输入包含我们未发现的字段

**验证**: jsdom 中每次启动产生不同的 x-tif-signature (即使同一 appCode)， 证明密钥是动态的。

### 8. 新增工具文件

| 文件 | 用途 |
|------|------|
| `nhsa_client.py` | 统一客户端 (CDP 模式, encrypt 模式) |
| `capture_sig.js` | jsdom 拦截 XHR 捕获签名 |
| `capture_sig2.js` | 增强版: 捕获调用栈 |
| `jsdom_server.js` | jsdom JSON-RPC 加密服务器 |
| `extract_crypto.js` | 尝试提取 sm-crypto 模块 |
| `extract_crypto2.js` | 通过 defineProperty hook 提取 |
| `find_api.js` | 扫描 window 查找 API 服务 |
| `debug_jsdom.js` | 调试 jsdom DOM 状态 |
| `brute_xtif_sig.py` | 暴力测试 SHA-256 输入 |
| `brute_xtif_sig2.py` | 暴力测试 SHA-256 + SM3 |

### 9. Camoufox 浏览器测试

- CSP 策略阻止 `eval()`，导致 app.js 产生大量 CSP 错误
- `hook_function` 和 `inject_hook_preset` 兼容性有问题
- **结论**: js-reverse MCP (CDP-based) 更可靠

## 2026-06-30 突破: SM4 密钥成功提取

### 10. SM4 密钥捕获 ✅🎉

通过 patch app.js 中 SM4 内部函数 `_0x32a5f1`，成功捕获加密参数：

| 字段 | 值 |
|------|-----|
| **SM4 密钥** | `C3AE5873D08418DA` (16字节ASCII) |
| **密钥来源** | app.js 运行时动态传入 (非来自 FIELD_D) |
| **验证方式** | `sm4.encrypt({"keys":""}, key)` → `4A8E4673...` ✅ 精确匹配 |
| **encData 明文** | `{"keys":""}` (PKCS7 padded) |
| **SM2 私钥** | APP_CODE bytes → hex (`54393848...`) |
| **SM4 模式** | CBC, IV = `00000000000000000000000000000000` |
| **兼容性** | 标准 `sm-crypto` npm 库 ✅ |

### 11. Patch 方案验证 ✅

```
app.js 源码
  → Patch 1: module "68b2" → window.__c = {sm2, sm3, sm4} ✅
  → Patch 2: module SM4 → hook _0x32a5f1 → 捕获 key/plaintext ✅
  → Patch 3: module "6c27" (SHA256) → 语法错误 (三元表达式内) ❌
```

### 12. x-tif-signature 状态

**穷举测试**: 对 ts, nonce, AC, body, encData, signData, SM4 key, SM2 pubkey 的所有排列/组合做 SHA256/SM3/HMAC — **全部不匹配**。

**可能原因**:
1. SHA256 输入格式不是简单的字符串拼接 (可能是二进制/ArrayBuffer)
2. 包含未捕获的字段 (session ID, internal state)
3. 使用了非标准哈希 (自定义SHA256变体)

**下一步**: 修复 Patch 3，正确 hook SHA256 模块捕获输入。

## 当前可用方案

### 选项 A: CDP Bridge (立即可用)

```bash
python nhsa_client.py encrypt --keyword "医院"
# 完整加密请求，包括 x-tif-signature
```

### 选项 B: jsdom 加密服务器 (SM4+SM2 完整)

SM4 加密和 SM2 签名已在 `nhsa_server.js` 中实现，仅缺 x-tif-signature。

### 选项 C: 纯协议 Python (待补全 x-tif-sig)
