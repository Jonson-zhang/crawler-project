---
name: nhsa-reverse
description: 国家医保局 SM2/SM4 国密逆向 — 教训总结和完成状态
metadata:
  type: project
---

国家医保局 API 逆向（2026-06-30 完成）。

**最终方案**: `nhsa_client_final.py` + `gov_nhsa_encrypt.js`（webpack 提取版），纯 Python 协议调用。

### 核心教训 → [[js-reverse-priority]]

内部 SM2 实现与 npm sm-crypto 不兼容（输出 64B vs 96B），所有外部重建尝试均失败。
最终通过 [[victory-volunteer/fuwu_nhsa]] 参考仓库的 webpack 提取版解决了签名问题。

### 已破解参数

- `encData`: SM4-CBC, key=`C3AE5873D08418DA`, IV=0, PKCS7
- `signData`: SM2, key=`009c4a35...` (FIELD_D hex 去首字节), hash:true
- `x-tif-signature`: SHA256(ts + nonce + ts)
- `x-tif-nonce`: 1大写 + 1数字 + 6混合

### 错误方向（详见 TECH_DOC.md 复盘章节）

1. 参数格式错误（`keyword` → `medinsName`，缺少 `regnCode`、`queryDataSource`）
2. 试图穷举 x-tif-signature 公式 120+ 种
3. npm sm-crypto 不兼容内部 SM2
4. source patch 6 次失败
5. 21370 误判为 acw_tc cookie 问题（实际是参数格式）

### 文件位置

`国家医保局/` 目录，最终仅保留 9 个文件。
