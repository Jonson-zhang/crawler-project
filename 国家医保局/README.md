# 国家医保局 医疗机构信息查询 API 逆向

## 最终方案

**纯协议 Python 客户端** — 无需浏览器、无需 CDP、无需 jsdom/iv8。

```bash
python nhsa_client_final.py "北京协和医院"
python nhsa_client_final.py --regn 110000 --page 1 --size 10
```

## 实现原理

| 组件 | 文件 | 说明 |
|------|------|------|
| 加密模块 | `gov_nhsa_encrypt.js` | webpack 精简提取版 (191KB)，包含 SM2/SM4/SHA256 |
| 客户端 | `nhsa_client_final.py` | Python + subprocess Node.js + requests |

## 加密协议

- **SM4-CBC**: 加密查询参数 (IV=0, PKCS7)
- **SM2**: 签名 (hash:true, hex→base64)
- **x-tif-signature**: `SHA256(timestamp + nonce + timestamp)`
- 密钥硬编码在 JS 中

## 目录结构

```
国家医保局/
├── nhsa_client_final.py     # 纯协议客户端 ← 直接使用
├── gov_nhsa_encrypt.js      # webpack 加密模块
├── package.json              # npm 依赖 (sm-crypto)
├── config/app.js             # 原始 JS 源码 (3.7MB, 参考)
├── reference/                # 参考实现 (victory-volunteer/fuwu_nhsa)
└── README.md
```

## 依赖

```bash
pip install requests
npm install sm-crypto
```

## 参考

- [victory-volunteer/fuwu_nhsa](https://github.com/victory-volunteer/fuwu_nhsa) — JS 加密模块提取参考
- [FlowerNotGiveYou 博客](https://www.cnblogs.com/FlowerNotGiveYou/p/17301335.html) — 逆向方法论
