# 国家医保局 医疗机构信息查询 API 逆向

## 目标

- **目标网站**: https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical
- **API 接口**: `POST https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital`
- **加密方式**: SM4-CBC 加密 + SM2 签名 (国密算法)
- **请求头签名**: x-tif-signature (SHA-256) + x-tif-nonce + x-tif-timestamp

## 项目结构

```
国家医保局/
├── main.py              # Python 入口 (使用 gmssl)
├── main.js              # Node.js 入口 (使用 sm-crypto)
├── verify_keys.py       # 密钥验证脚本
├── key_extract.py       # 密钥提取分析器
├── extract_crypto.js    # Node.js 密钥提取
├── config/
│   ├── samples.json     # 抓包样本数据
│   ├── app.js           # 页面主 JS (3.7MB, OB混淆)
│   ├── keys.example.json # 密钥配置模板
│   └── keys.json        # 实际密钥配置
├── utils/
│   ├── sm_crypto.py     # SM2/SM3/SM4 国密封装
│   └── signer.py        # 请求签名器
├── package.json
└── README.md
```

## 加密方案分析

### 请求加密

```
POST /ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital

Headers:
  x-tif-signature: SHA-256 (64 hex chars)
  x-tif-timestamp: Unix timestamp (秒)
  x-tif-nonce:      8位随机字母数字
  channel:          web
  x-tif-paasid:     undefined

Body:
{
  "data": {
    "data": {
      "encData": "<SM4-CBC 加密的查询参数 (hex)>"
    },
    "appCode": "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
    "version": "1.0.0",
    "encType": "SM4",
    "signType": "SM2",
    "timestamp": <Unix时间戳>,
    "signData": "<SM2 签名 (base64)>"
  }
}
```

### 响应解密

```
{
  "code": 0,
  "data": {
    "data": {
      "encData": "<SM4-CBC 加密的响应数据 (hex)>"
    },
    "encType": "SM4",
    "signType": "SM2",
    "appCode": "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
    "version": "1.0.0",
    "timestamp": "<服务器时间戳>",
    "signData": "<SM2 签名 (base64)>"
  },
  "message": "成功"
}
```

### 加密算法详情

| 组件 | 算法 | 说明 |
|------|------|------|
| 请求体加密 | SM4-CBC | 16字节密钥, 全零IV, PKCS7填充 |
| 请求体签名 | SM2 | 标准国密SM2签名 |
| 请求头签名 | SHA-256 | 64位hex |
| 响应体加密 | SM4-CBC | 与请求使用相同密钥 |

## 快速开始

### Python 版本

前置条件已安装在项目虚拟环境中。

### Node.js 版本

```bash
npm install
```

### 待完成: 密钥提取

主 JS 文件 (`config/app.js`, 3.7MB) 经过 OB 混淆，无法直接提取密钥。

**提取密钥的方法**:

1. 通过浏览器 MCP 工具提取 (见 `extract_from_browser.md`)
2. 将提取到的密钥写入 `config/keys.json`

**已知参数**:
- `appCode`: `T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ`
- `version`: `1.0.0`
- `encType`: `SM4`, `signType`: `SM2`
- `encData` 格式: hex (大写)
- `signData` 格式: base64
- `x-tif-signature` 格式: SHA-256 hex (64字符)

**待提取参数**:
- `sm4_key`: 16字节 SM4 密钥 (32字符 hex)
- `sm4_iv`: 全零 (已验证)
- `x-tif-signature 算法`: SHA-256 的精确输入组合

## 技术分析记录

### JS 文件分析
- 主文件: `app.1781684502962.js` (3.7MB)
- 混淆方式: OB 混淆 (obfuscator.io)
- 模块系统: 自定义 IIFE 模块加载
- 加密库: `sm-crypto` (内嵌)

### SM4 加密细节
- 模式: CBC
- IV: 全零 `00000000000000000000000000000000`
- 填充: PKCS7
- 输出: 大写 hex

### SM2 签名
- 曲线: 标准 SM2 曲线
- 哈希: SM3
- 私钥: 动态生成 (每会话)
- 输出: base64 编码的 DER 签名

### 请求头签名 (x-tif-signature)
- 长度: 64 hex chars (32 bytes = SHA-256)
- 输入: 待确认 (包含 appCode + timestamp + nonce + 可能的 body)

## 参考

- [GMSSL Python](https://github.com/duanhongyi/gmssl)
- [sm-crypto JS](https://github.com/JuneAndGreen/sm-crypto)
- [国密算法标准](https://www.oscca.gov.cn/)
