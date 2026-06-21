---
name: waf-tls-fingerprint
description: WAF TLS 指纹检测识别与应对——请求返回 WAF HTML 而非 JSON 时的诊断流程
metadata:
  type: project
---

## 问题

`requests` / `httpx` 等 Python HTTP 库发出的 HTTPS 请求，TLS Client Hello 指纹与真实浏览器不同。部分 CDN/WAF（如 Aliyun WAF、Cloudflare）会拦截非浏览器的 TLS 指纹。

## 诊断

```
现象: HTTP 200 + content-type: text/html + body 包含 "aliyun_waf"
但: Cookie 是有效的（同一套 Cookie 在浏览器 fetch/XHR 中能正常返回 JSON）

→ 结论: TLS 指纹被检测，非 Cookie 问题
```

**诊断方法（关键一步，不要跳过）**：

在获取了有效 Cookie 的浏览器会话中，直接用浏览器的 `fetch()` 发加密后的 API 请求：
- 如果浏览器 fetch 成功 → TLS 指纹问题，走浏览器桥接方案
- 如果浏览器 fetch 也失败 → Cookie/参数/加密问题，继续调试

## 解决方案（降级梯度）

### 梯度 1: curl_cffi（纯 Python，推荐先试）

```python
from curl_cffi import requests as curl_requests
resp = curl_requests.post(url, json=body, headers=headers,
                          impersonate="chrome110")
```

### 梯度 2: Playwright headless 桥接（本次采用）

```
Python crawler.py
  → subprocess → Playwright Chromium headless
  → page.evaluate(fetch()) → 利用 Chromium TLS 栈
  → 返回加密响应 → Python 解密
```

代价：每次 API 调用需启动 Chromium（~3 秒）。

### 梯度 3: Camoufox headless（已有基础设施时）

与梯度 2 类似，使用 Camoufox MCP 的反检测 TLS。

## Cookie 保鲜优化

当 Cookie 由浏览器内 JS SDK 动态生成且有时效性时：

```
├── Cookie 年龄 < 25 分钟 → 快速模式
│   只导航一次页面（让 Cookie 域名生效），不等 SDK
│   → ~5 秒（含 Chromium 启动 ~3 秒）
│
└── Cookie 过期/不存在 → 完整模式
    首页 → 机票页 → 等 SDK 生成 Cookie → 导出
    → ~12 秒
```

**Why**: Cookie 刷新和不刷新有 3× 时间差。每次请求都走完整模式是浪费。
**How to apply**: 记录 cookies.json 的 mtime，超过阈值才走完整刷新。

## 禁止的路径

1. **尝试在 Node.js 中复现 SDK 指纹生成** — 这些 SDK 使用 Web Worker + Canvas + WebGL + Audio，纯 Node.js 不可行。识别到这种 SDK 后 5 分钟内就应该放弃纯 Node.js 路径。
2. **用 `requests.Session` 反复试不同参数** — 如果 Cookie 有效但返回 WAF HTML，就是 TLS 问题，不要再改 Cookie 配置。
