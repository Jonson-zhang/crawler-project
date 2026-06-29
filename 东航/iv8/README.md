# 东航 iv8 — 纯 Python 非浏览器自动化方案

## 原理

```
test_iv8.py
  ├─ CeairWasm (iv8 C++ V8)       → WASM 白盒 AES CBC 加解密
  └─ ApiClient  (Python requests) → HTTP POST shoppingv2
```

`wbsk_Wbox.js` 是 **Emscripten wasm2js**（自带 `var WebAssembly = {...}` ASM.js polyfill），
浏览器 API 仅检测 `window` 存在性 → 走 `ENVIRONMENT_IS_WEB` 路径 → 闭包注入 ASM.js exports → 
`Module.asm` 直接持有 `wbsk_AES_cbc_encrypt` / `malloc` / `cwrap` 等函数。

iv8 零补丁运行：WebAssembly polyfill 是纯 JS 闭包，不需要真实 WASM 引擎/DOM/fetch。

## 与 cloak/dp 方案对比

| | cloak (CloakBrowser) | dp (DrissionPage) | iv8 |
|---|---|---|---|
| WASM 加密 | Node.js subprocess | Node.js subprocess | **iv8 内嵌 V8** |
| HTTP 请求 | 浏览器 fetch | 浏览器 fetch | **Python requests** |
| Cookie 保鲜 | 自动 (浏览器) | 自动 (浏览器) | **手动复制** |
| 启动耗时 | ~5-10s | ~5-10s | **~0.5s** |
| TLS 指纹 | ✅ Chrome C++ 引擎 | ✅ Chrome 浏览器 | ⚠ Python OpenSSL |

## 文件

```
iv8/
├── ceair_iv8.py      # WASM 加解密核心 (CeairWasm context manager)
├── test_iv8.py        # 完整搜索流程 (encrypt → HTTP → decrypt → show)
├── config.json        # 默认出发/到达/日期
└── README.md
```

依赖的 JS 文件 (引用自 `../cloak/v1.0/`)：
- `wbsk_Wbox.js` — Emscripten wasm2js 运行时 (~1MB, 17 个 AES export)
- `wbsk_skb_orig.js` — AES CBC/ECB 高层包装

## 用法

```bash
# 安装 iv8 (一次性)
uv add iv8

# 测试加密/解密 (不依赖 Cookie/网络)
python ceair_iv8.py encrypt '{"routes":[...]}'
python ceair_iv8.py decrypt 'base64...'

# 完整搜索 (需要先手动准备 Cookie)
# 1. 浏览器打开 https://m.ceair.com/mapp/reserve/flightList
# 2. F12 → Application → Cookies → m.ceair.com → 全量复制
# 3. 保存到 ../browser_cookies.txt (格式: k1=v1; k2=v2; k3=v3; ...)
# 4. 运行:
python test_iv8.py 上海 北京
python test_iv8.py SHA BJS 20260630

# Python API 调用
from ceair_iv8 import CeairWasm
with CeairWasm() as w:
    enc = w.encrypt({"routes": [...]})   # → {"req": "..."}
    data = w.decrypt(enc["req"])         # → dict
```

## 已验证

- [x] iv8 encrypt ↔ Node.js sign.js decrypt (跨兼容)
- [x] Node.js sign.js encrypt ↔ iv8 decrypt (跨兼容)  
- [x] iv8 encrypt → decrypt roundtrip
- [x] 与 cloak/v1.0/sign.js 加密结果一致 (仅 transactionId 随机部分不同)
- [ ] HTTP POST with valid cookies (依赖 TLS 指纹通过 WAF)

## 局限：TLS 指纹

Python `requests` 底层 OpenSSL 的 TLS 指纹与 Chrome 不同，东航 WAF 第一层可能拦截。

**后续改进方向**：
1. `uv add curl_cffi` → `from curl_cffi import requests` (模拟 Chrome124 TLS)
2. iv8 内嵌 `curl_cffi` HTTP → Python 层统一处理 (需解决 HTTP 层 TLS 伪装)
3. 手动刷新 `browser_cookies.txt` + 25 分钟窗口内使用
