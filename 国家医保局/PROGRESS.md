# 国家医保局 API 逆向 — 最终状态

> 2026-06-30 完成

## ✅ 最终成果

```bash
python nhsa_client_final.py "北京协和医院"
# → code:0, 解密 1 条: 中国医学科学院北京协和医院（综合医院，三级）
```

## 加密参数

| 参数 | 算法 | 公式/密钥 |
|------|------|----------|
| `encData` | SM4-CBC | 密钥 `C3AE5873D08418DA`, IV=0, PKCS7 |
| `signData` | SM2 | 私钥 `009c4a35...`, hash:true, hex→base64 |
| `x-tif-signature` | SHA256 | `SHA256(timestamp + nonce + timestamp)` |
| `x-tif-nonce` | 随机 | 6位字母数字 + 1位大写 + 1位数字 |

## 关键技术突破

1. ✅ `x-tif-signature = SHA256(ts + nonce + ts)` — 来自 cnblogs 博客
2. ✅ 查询参数格式为 `{addr, regnCode, medinsName, ..., queryDataSource:"es"}`
3. ✅ SM2 签名必须使用 webpack 提取版模块（非 npm sm-crypto）
4. ✅ `acw_tc` cookie 不是必需的

## 易错点

- SM2 `doSignature(r, d, {hash:!0})` 中 `d` 必须取运行时值，源码中的 `l.privateKey` 会产出错误长度
- npm sm-crypto 的 doSignature 输出 96-108B，内部模块输出 64B
- 请求 headers 需要 `X-Tingyun` 和 `contentType: application/x-www-form-urlencoded`

## 参考

- [victory-volunteer/fuwu_nhsa](https://github.com/victory-volunteer/fuwu_nhsa) — 加密模块 webpack 提取
- [FlowerNotGiveYou 博客](https://www.cnblogs.com/FlowerNotGiveYou/p/17301335.html) — x-tif-signature 公式 + 密钥配置
