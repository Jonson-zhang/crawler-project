# 知乎 API 逆向

PC 端知乎 API 调用链路：登录 → x-zse 签名 → 爬虫。

## 两种方案

| 方案 | 目录 | 运行时 | 说明 |
|------|------|--------|------|
| Node.js vm | [`node_vm/`](node_vm/) | Node.js `vm` 沙箱 + 手动补环境 | 原方案，依赖 Node.js |
| iv8 | [`iv8/`](iv8/) | C++ V8 引擎，纯 Python | **推荐**，无需 Node.js，无需补环境 |

## 快速开始

```bash
# iv8 方案（推荐）
cd iv8
python main_iv8.py

# Node.js vm 方案
cd node_vm
python main.py
```

## 知乎检测特点

知乎对浏览器 API 的依赖较浅：
- 不检测 prototype、Canvas/WebGL、VMP
- 主要依赖 `crypto.webcrypto.getRandomValues`
- `fetch` / `XMLHttpRequest` 仅占位

## 签名原理

| Header | 格式 | 来源 |
|--------|------|------|
| `x-zse-96` | `2.0_{sig}` | webpack module 93823.nT |
| `x-zst-81` | `3_2.0{prefix}_{sig}` | 同上 |

签名源串：`"101_3_3.0" + encUrl + d_c0`

## Cookie 角色

| Cookie | 来源 | 作用 | 签名相关？ |
|--------|------|------|-----------|
| `d_c0` | 首页自动下发 | 设备指纹，签名输入 | ✅ 是 |
| `z_c0` | 登录后下发 | 登录凭证 | ❌ 无关 |
