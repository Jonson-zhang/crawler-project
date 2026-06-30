# 国家医保局 API 逆向技术文档

> 版本: 2026-06-30  
> 作者: Jonson-zhang  
> 参考: [victory-volunteer/fuwu_nhsa](https://github.com/victory-volunteer/fuwu_nhsa)、[FlowerNotGiveYou 博客](https://www.cnblogs.com/FlowerNotGiveYou/p/17301335.html)

---

## 一、目标概述

### 1.1 目标网站

- **服务名称**: 国家医保局定点医疗机构查询
- **页面地址**: `https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical`
- **API 地址**: `POST https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital`

### 1.2 逆向目标

逆向解密该 API 的完整请求/响应加密协议，实现纯 Python 协议调用（无浏览器依赖）。

### 1.3 最终方案

```bash
python nhsa_client_final.py "北京协和医院"
# → code:0, 解密 1 条: 中国医学科学院北京协和医院
```

---

## 二、加密架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      请求加密流程                            │
│                                                             │
│  查询参数 (JSON)                                             │
│      │                                                      │
│      ▼ SM4-CBC(key, IV=0, PKCS7)                            │
│  encData (hex)                                              │
│      │                                                      │
│      ▼ 组装 inner = {data:{encData}, appCode, ..., timestamp}│
│      │                                                      │
│      ▼ SM2 sign(inner, privateKey, hash:true)                │
│  signData (hex → base64)                                   │
│      │                                                      │
│      ▼ 组装 body = {data:{encData, appCode, ..., signData}}  │
│      │                                                      │
│      ▼ SHA256(timestamp + nonce + timestamp)                │
│  x-tif-signature (64 hex)                                   │
│      │                                                      │
│      ▼ HTTP POST + headers                                  │
│  API 服务器                                                  │
│      │                                                      │
│      ▼ SM4-CBC 解密响应                                      │
│  返回数据 (JSON)                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、请求参数详解

### 3.1 Query Parameters（实际格式）

```json
{
    "addr": "",
    "regnCode": "110000",
    "medinsName": "",
    "medinsLvCode": "",
    "medinsTypeCode": "",
    "openElec": "",
    "pageNum": 1,
    "pageSize": 10,
    "queryDataSource": "es"
}
```

| 字段 | 说明 |
|------|------|
| `addr` | 地址 |
| `regnCode` | 行政区划代码（`110000`=北京市） |
| `medinsName` | 医疗机构名称 |
| `medinsLvCode` | 等级代码 |
| `medinsTypeCode` | 类型代码 |
| `openElec` | 是否开通电子凭证 |
| `pageNum` | 页码 |
| `pageSize` | 每页条数 |
| `queryDataSource` | 数据源（ES） |

### 3.2 加密后的请求 Body

```json
{
    "data": {
        "data": {
            "encData": "<SM4-CBC加密后的查询参数(hex)>"
        },
        "appCode": "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
        "version": "1.0.0",
        "encType": "SM4",
        "signType": "SM2",
        "timestamp": 1782832179,
        "signData": "<SM2签名(base64)>"
    }
}
```

### 3.3 请求 Headers

| Header | 值 | 说明 |
|--------|-----|------|
| `x-tif-signature` | SHA256(ts + nonce + ts) | 请求签名 |
| `x-tif-timestamp` | Unix 秒时间戳 | |
| `x-tif-nonce` | 8位随机字串 | 格式: 6字母数字 + 1大写 + 1数字 |
| `x-tif-paasid` | `undefined` | |
| `channel` | `web` | |
| `contentType` | `application/x-www-form-urlencoded` | |
| `X-Tingyun` | `c=B\|4Nl_NnGbjwY;x=dbaf776fd2154ec1` | 监控 Header |
| `Accept` | `application/json` | |
| `Content-Type` | `application/json` | |

---

## 四、加密算法详解

### 4.1 SM4 加密（encData）

```
算法: SM4-CBC
密钥: C3AE5873D08418DA (16字节 ASCII)
IV:   00000000000000000000000000000000 (全零)
填充: PKCS7 (每个填充字节值 = 填充长度)
输出: hex 大写
```

**源码对应关系：**

```javascript
// 密钥来源（运行时动态传入）
function y(appCode, privateKey) { ... }  // 生成 SM4 密钥

// 加密函数
function b(key, plainBytes) {
    var pad = 16 - (plainBytes.length % 16);
    plainBytes = plainBytes.concat(new Array(pad).fill(pad));
    var encrypted = sm4.encrypt(plainBytes, key);
    return e_.Buffer.from(encrypted).toString("hex").toUpperCase();
}
```

**验证点：** `encrypt({"keys":""})` → `4A8E4673BB18D86FE780DACC31C49FE3`

### 4.2 SM2 签名（signData）

```
算法: SM2 with SM3 hash
私钥: 009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42
      (FIELD_D base64解码 → hex, 33字节去掉首字节后的32字节)
选项: hash: true
输出: hex(128 chars) → bytes(64) → base64(88 chars)
```

**源码对应关系：**

```javascript
// 签名对象
var l = {
    appCode: "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
    version: "1.0.0",
    appSecret: "NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P",
    publicKey: "BEKaw3Qtc31LG/hTPHFPlriKuAn/nzTWl8LiRxLw4iQiSUIyuglptFxNkdCiNXcXvkqTH79Rh/A2sEFU6hjeK3k=",
    privateKey: "AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC",  // base64
};

// ⚠️ 注意：必须取运行时 d 的值！
// 不能直接用 l.privateKey，否则产出签名长度不对
var d = "009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42";

// 签名流程
var r = v(i);  // v 处理内部对象
var a = o.doSignature(r, d, { hash: !0 });
return e.from(a, "hex").toString("base64");
```

**为什么 npm sm-crypto 不兼容？**

npm 版 `sm2.doSignature` 输出 96-108 字节（含 DER/raw 编码），而内部 webpack 模块输出 128 hex（64 字节）。必须使用从 app.js 提取的 webpack 精简版 `gov_nhsa_encrypt.js`。

### 4.3 x-tif-signature

```
算法: SHA-256
公式: SHA256(timestamp + nonce + timestamp)
输出: 64 hex 字符
```

**源码对应关系：**

```javascript
var s = Math.ceil((new Date).getTime() / 1e3);  // timestamp
var h = i();  // nonce
var f = s + h + s;  // "1782832179T1y85bly1782832179"
t.headers["x-tif-signature"] = r(f);  // r = createMethod() = SHA256
```

**验证：** 已用 5 个不同样本交叉验证通过。

### 4.4 x-tif-nonce 生成

```javascript
function i() {
    var e, t, n,
        i = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
        r = "0123456789";
    return e = o(6, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"),
           t = o(1, i),
           n = o(1, r),
           t + n + e;
    // 格式: 1大写字母 + 1数字 + 6混合字符
}
```

---

## 五、响应解密

### 5.1 响应 Body

```json
{
    "code": 0,
    "message": "成功",
    "data": {
        "signData": "<SM2签名(base64)>",
        "encType": "SM4",
        "signType": "SM2",
        "appCode": "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
        "version": "1.0.0",
        "timestamp": "1782832172249",
        "data": {
            "encData": "<SM4-CBC加密后的响应数据(hex)>"
        }
    }
}
```

### 5.2 解密函数

```javascript
function DecryptedData(t) {
    var n = e_.Buffer.from(t.data.data.encData, "hex");
    var i = sm4.decrypt(n, sm4Key);       // SM4-CBC 解密
    var r = i[i.length - 1];              // PKCS7 pad
    i = i.slice(0, i.length - r);         // 去掉填充
    return JSON.parse(e_.Buffer.from(i).toString("utf-8"));
}
```

### 5.3 解密后的数据

```json
{
    "list": [
        {
            "seq": 1,
            "medinsName": "中国医学科学院北京协和医院",
            "medinsTypeName": "综合医院",
            "medinsLvName": "三级",
            "addr": "北京协和医院东单院区...",
            "regnCode": "110000",
            "openElec": "1"
        }
    ],
    "total": 10
}
```

---

## 六、源码结构分析

### 6.1 app.js 概览

| 属性 | 值 |
|------|-----|
| 文件大小 | 3.7MB / 6.0MB (格式化后) |
| 代码行数 | 128,358 行 |
| 混淆方式 | OB (obfuscator.io) |
| 打包工具 | webpack |
| 加密库 | sm-crypto 内嵌 |
| 模块数量 | 594 个 webpack 模块 |

### 6.2 关键 webpack 模块

| 模块 ID | 功能 | 关键方法 |
|---------|------|----------|
| `68b2` | SM 聚合模块 | 导出 `{sm2, sm3, sm4}` |
| `4d09` | SM2 实现 | `doSignature`, `doEncrypt`, `generateKeyPairHex` |
| `e04e` | SM4 实现 | `encrypt`, `decrypt` |
| `21bf` | SHA256 实现 | `SHA256`, `HmacSHA256` (CryptoJS) |
| `6c27` | SHA256 底层 | SHA-256 算法常量 |
| `b639` | Buffer 实现 | `from`, `toString` (base64/hex 转换) |
| `b50d` | XHR 请求分发 | axios adapter |

### 6.3 密钥配置对象

```javascript
// 在 app.js 原始源码中的位置：_0x3d8a47
var l = {
    appCode: "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",     // 应用程序标识
    version: "1.0.0",
    appSecret: "NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P",   // 应用密钥(32字符)
    publicKey: "BEKaw3Qtc31LG/hTPHFPlriKuAn/...",     // SM2 公钥 (base64)
    privateKey: "AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC", // SM2 私钥 (base64)
    publicKeyType: "base64",
    privateKeyType: "base64"
};
```

---

## 七、实现方案对比

| 方案 | 文件 | 依赖 | 启动时间 | 可用性 |
|------|------|------|---------|--------|
| **纯协议** | `nhsa_client_final.py` | Node.js + requests | <1s | ✅ 最终方案 |
| CDP Bridge | `cdp_bridge.py` (已移除) | Chrome + websocket | ~8s | ❌ 重 |
| jsdom | `export_all.js` (已移除) | jsdom npm | ~5s | ❌ 重 |
| iv8 | `iv8_final.py` (已移除) | iv8 Python | ~3s | ❌ SM2不完整 |

### 7.1 纯协议方案原理

```
Python (nhsa_client_final.py)
  ├── subprocess → Node.js (gov_nhsa_encrypt.js)
  │     ├── SM4.encrypt(params) → encData
  │     ├── SM2.doSignature(inner) → signData  
  │     └── SHA256(ts+nonce+ts) → x-tif-signature
  └── requests → HTTPS POST → API
        └── JSON 解析 + SM4 解密响应
```

---

## 八、关键技术发现

### 8.1 SM2 私钥的动态值

源码中 `l.privateKey = "AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC"`，但实际运行时传递给 `doSignature` 的值是:

```
d = "009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42"
```

区别在于：`AJxKNdm...AtC` base64 解码后是 **33 字节**，前面多了一个 `00` 字节。实际的 SM2 私钥是后 **32 字节**。

### 8.2 npm sm-crypto 不兼容

| 对比项 | npm sm-crypto | 内部 webpack 模块 |
|--------|---------------|-------------------|
| `doSignature` 输出 | 96-108 bytes (DER) | 128 hex (64 bytes raw) |
| 密钥格式 | hex 字符串 | 带前导 `00` 的 hex |
| hash 处理 | 内部 SM3 | 明确 `{hash: true}` |

### 8.3 acw_tc cookie 并非必需

早期分析认为 `acw_tc`（阿里云 WAF Cookie）是必要条件。实测发现**不需要该 Cookie**，只需正确的加密参数和 `X-Tingyun` header 即可。

### 8.4 参数名陷阱

初版使用了 `{"keyword": "...", "pageNum": 1}` 格式，实际参数名为 `medinsName` 而非 `keyword`，且需要 `regnCode`、`queryDataSource` 等额外字段。

---

## 九、文件说明

| 文件 | 用途 |
|------|------|
| `nhsa_client_final.py` | **主程序** — Python 纯协议客户端 |
| `gov_nhsa_encrypt.js` | webpack 精简加密模块 (191KB) |
| `package.json` | npm 依赖声明 |
| `config/app.js` | 原始 app.js 源码 (3.7MB，仅供参考) |
| `reference/` | 参考实现 (victory-volunteer/fuwu_nhsa) |
| `PROGRESS.md` | 逆向过程记录 |
| `README.md` | 快速入门 |

---

## 十、Webpack 模块精简方法

当扣取 webpack 模块时，遵循以下原则：

### 10.1 基础步骤

1. 定位入口 loader 函数（`function o(t) { if (n[t]) return n[t].exports; ... }`）
2. 复制完整 loader 框架（含 `n`, `i`, `r`, `o` 变量）
3. 添加所需模块定义（`"4d09": function(...){...}` 等）
4. 注释掉未使用的 `require` 调用（如 CSS chunk 加载）

### 10.2 精简技巧

**注释非必要 require：**

```javascript
// 先注释掉，运行报错再逐步打开
// var i = n("85f2"),
// r = n.n(i);
```

**逗号表达式简化：**

```javascript
// 原: o = (n("6b54"), n("c5f6"), n("f33e").BigInteger)
// 简化为:
o = n("f33e").BigInteger
```

**等值替换：**

```javascript
// o.a = function(key) { ... return String(key); }
// 所以 Object(o.a)(i.key) 等价于 i.key
r()(e, Object(o.a)(i.key), i)  →  r()(e, i.key, i)
```

### 10.3 注意事项

- 某些模块的 import 是必需的（`n("46a7")` 可能设置全局变量），不能注释
- 逐步精简，每注释一处就测试一次
- 保留 webpack loader 的 `o.e` 函数（防止异步 chunk 加载报错）

---

## 十一、完整调用示例

```python
from nhsa_client_final import NhsaClient

client = NhsaClient()

# 查询北京协和医院
result = client.search(medins_name="协和医院", regn_code="110000")
# → code:0, 解密正常

# 查询所有三级医院
result = client.search(medins_name="", regn_code="110000",
                       page_num=1, page_size=20)

# 查询上海的医疗机构
result = client.search(medins_name="", regn_code="310000")

client.close()
```
