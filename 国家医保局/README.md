# 国家医保局 医疗机构信息查询 API 逆向

## 目标

- **网站**: https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical
- **API**: `POST /ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital`
- **加密**: SM4-CBC + SM2 签名 (国密算法), app.js 经 OB 混淆 (3.7MB)

## 🔑 密钥发现

在 app.js (字符串表索引 10224) 中通过 XOR 解码提取:

| 字段 | 解码值 |
|------|--------|
| `_0x3d8a47['a']` | SM2 公钥 (32 chars, 类似 base32 编码) |
| `_0x3d8a47['b']` | `"1.0.0"` (version) |
| `_0x3d8a47['c']` | SM2 私钥 (base64, 65 bytes = SM2 private key DER) |
| `_0x3d8a47['d']` | SM4 密钥/IV 材料 (base64, 33 bytes) |
| `_0x3d8a47['e']` | `T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ` (appCode) |

**关键发现**: 加密密钥通过 `sm2.generateKeyPairHex()` **每次会话动态生成**，已从字符串表解码确认密钥材料在 JS 中以 XOR 混淆存储。

模块引用链:
```
_0x144871[_0x4aaf71("sm2")]  → sm2.generateKeyPairHex()
_0x144871[_0x4aaf71("sm4")]  → sm4.encrypt()
_0x144871[_0x4aaf71("sm3")]  → sm3.hash()
```

## 运行方式

### CDP 桥接 (推荐 — 利用页面自身加密)

```bash
python cdp_bridge.py                    # 默认查询"北京协和医院"
python cdp_bridge.py "北京大学第一医院"    # 指定关键词
python cdp_bridge.py 医院 --page 2 --size 5
```

### 纯协议 (需先配置密钥)

```bash
# 1. 确保 config/keys.json 配置了正确的密钥
# 2. 运行
python main.py 北京协和医院
```

## 项目结构

```
国家医保局/
├── cdp_bridge.py         # CDP 桥接方案 (推荐)
├── main.py               # Python 纯协议入口
├── main.js               # Node.js 入口
├── decode_key.py         # XOR 密钥解码器
├── decode_strings.py     # OB 字符串表解码器
├── verify_keys.py        # 密钥验证
├── brute_keys.py         # 批量密钥测试
├── key_extract.py        # 密钥分析
├── config/
│   ├── samples.json      # 4组完整请求/响应样本
│   ├── app.js            # 页面主 JS (3.7MB)
│   └── keys.example.json # 密钥配置模板
├── utils/
│   ├── sm_crypto.py      # SM2/SM3/SM4 封装
│   └── signer.py         # 请求签名器
├── extract_from_browser.md
├── package.json
└── README.md
```

## 加密协议分析

### 请求格式

```
POST /ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital

Headers:
  x-tif-signature: SHA-256 (64 hex)        # 待确认算法
  x-tif-timestamp: Unix秒时间戳
  x-tif-nonce:      8位随机字母数字
  x-tif-paasid:     undefined
  channel:          web

Body:
{
  "data": {
    "data": {"encData": "<SM4-CBC 加密的查询参数>"},
    "appCode": "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
    "version": "1.0.0",
    "encType": "SM4",
    "signType": "SM2",
    "timestamp": <Unix秒>,
    "signData": "<SM2 签名 (base64)>"
  }
}
```

### 响应格式

```json
{
  "code": 0,
  "data": {
    "data": {"encData": "<SM4-CBC 加密数据>"},
    "encType": "SM4", "signType": "SM2",
    "appCode": "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
    "version": "1.0.0",
    "timestamp": "<服务器时间戳>",
    "signData": "<SM2 签名 (base64)>"
  },
  "message": "成功"
}
```

### 解密后的数据 (示例)

```json
{
  "list": [
    {
      "seq": 1,
      "medName": "北京协和医院",
      "medTypeName": "综合医院",
      "medLevelName": "三级",
      "addr": "北京协和医院东单院区..."
    }
  ],
  "total": 10
}
```

## 技术细节

### OB 混淆分析
- 10,224 个字符串在表中, 通过 `_0x7e206d(idx)` 函数查找
- XOR 密钥: `[0x13,0x07,0x1f,0x2b,0x0b,0x1d,0x25]`
- SM2/SM4 模块 ID 映射: `0x372`→sm2, `0x7e4`→sm3, `0x2080`→sm4
- 函数映射: `0x2650`→generateKeyPairHex, `0x19ac`→doEncrypt, `0xf8c`→doSignature

### SM4-CBC
- IV: `00000000000000000000000000000000` (全零)
- 填充: PKCS7
- 密钥: 每会话动态生成 (sm2.generateKeyPairHex → SM2 公钥加密 SM4 会话密钥)

### SM2 签名
- 曲线参数内嵌 (P/A/B 从字符串表解码)
- 输出: base64 DER 编码

### x-tif-signature
- 长度: 64 hex (SHA-256)
- 输入组合: 待确认 (包含 appCode + timestamp + nonce + body 或其部分)

## 参考

- [GMSSL Python](https://github.com/duanhongyi/gmssl)
- [sm-crypto JS](https://github.com/JuneAndGreen/sm-crypto)
- [国密算法标准](https://www.oscca.gov.cn/)
