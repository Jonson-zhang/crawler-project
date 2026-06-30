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

## 下一步行动清单

1. [ ] 浏览器 MCP Hook `setRequestHeader('x-tif-signature', ...)` 获取精确签名输入
2. [ ] 从 jsdom 中提取 `Uint8Array(16)` 获取 SM4 密钥
3. [ ] 确认 SM4 密钥 → 解密已知 response encData 验证
4. [ ] 补全 x-tif-signature 算法 → API 调用成功
5. [ ] 实现响应 SM4 解密
6. [ ] 最终交付: 纯协议 Python main.py，无浏览器依赖
