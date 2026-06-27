# 小红书 API 逆向

PC Web 端首页推荐流：Cookie 引导 → x-s/x-s-common 签名 → 翻页爬取。

## 两种方案

| 方案 | 目录 | 运行时 | 说明 |
|------|------|--------|------|
| Node.js vm | [`v2.0/`](v2.0/) | Node.js `vm` + 400 行手动补环境 | 原方案，依赖 Node.js + npm |
| iv8 | [`iv8/`](iv8/) | C++ V8 引擎，纯 Python | **推荐**，无需 Node.js，无需补环境 |

## 快速开始

```bash
# iv8 方案（推荐）
cd iv8
python main_iv8.py

# Node.js 方案
cd v2.0
python main.py
```

## 签名管线

| 参数 | 生成方 | 方式 |
|------|--------|------|
| x-s | iv8 / sign.js | VMP 字节码解释器 (mns0301) |
| x-s-common | Python 纯算 | RC4 + CRC32 + 自定义 Base64 |
| x-t | Python | `int(time()*1000)` |
| x-b3-traceid | Python | `random.hex(16)` |
| x-xray-traceid | Python | `(ts<<23)|random` |

## Cookie 引导

`web_session` 由小红书服务端下发，需 4 步全自动引导：

```
a1/webId → scripting(解密websectiga) → shield/webprofile(DES+签名→gid) → activate → web_session
```

全程 Python 全自研，零外部依赖。
