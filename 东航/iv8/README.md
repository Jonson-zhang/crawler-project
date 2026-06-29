# 东航 iv8 — 纯 Python 非自动化方案

## 原理

```
test_iv8.py
  ├─ CeairWasm (iv8)    → WASM 白盒 AES CBC 加解密
  └─ ApiClient  (httpx) → HTTP POST shoppingv2 (TLS 指纹问题见下)
```

与 `cloak/` 和 `dp/` 方案的区别：**无浏览器自动化**。

| 方案 | 加密 | HTTP | Cookie 保鲜 | 启动开销 |
|------|------|------|-------------|---------|
| cloak (CloakBrowser) | Node.js 子进程 | 浏览器 fetch | 自动 | ~5-10s |
| dp (DrissionPage) | Node.js 子进程 | 浏览器 fetch | 自动 | ~5-10s |
| **iv8** | **iv8 内嵌 V8** | **httpx 直连** | **手动** | **<0.5s** |

## 用法

```bash
# 安装 iv8 (一次性)
uv add iv8

# 准备 Cookie (首次，之后每次 Cookie 过期时刷新)
# 1. 浏览器打开 https://m.ceair.com/mapp/reserve/flightList
# 2. F12 → Application → Cookies → m.ceair.com
# 3. 全部复制，保存到 ../browser_cookies.txt
#    格式: k1=v1; k2=v2; k3=v3; ...

# 搜索航班
python test_iv8.py 上海 北京
python test_iv8.py SHA BJS 20260630
python test_iv8.py                    # 读 config.json 默认值

# 单独测试加密/解密
python ceair_iv8.py encrypt '{"routes":[...]}'
python ceair_iv8.py decrypt 'base64...'
```

## TLS 指纹问题

Python `httpx` 的 TLS 指纹与 Chrome 不同，东航 WAF 可能拦截。

**解决方案**: 换成 `curl_cffi` 模拟 Chrome TLS:

```bash
uv add curl_cffi
```

然后修改 `test_iv8.py` 的 import:
```python
# 替换 import httpx 为:
from curl_cffi import requests as curl_requests

# 替换 httpx.Client → curl_requests.Session(impersonate="chrome124")
```

## Cookie 刷新频率

- `acw_tc` — WAF 令牌，有效期较长
- `ssxmod_itna` — Tongdun 指纹 Cookie，~25 分钟过期
- `SERVERID` — 负载均衡，session 级

过期后需重新从浏览器复制 Cookie 到 `browser_cookies.txt`。

## 未来可能

1. **iv8 跑 Tongdun SDK**：让 iv8 在 V8 中执行指纹 JS，自动生成 ssxmod_itna，彻底去浏览器
2. **curl_cffi TLS impersonation**：解决 TLS 指纹问题，使 httpx 请求不被 WAF 拦截
