---
name: waf-browser-engine
description: 阿里云 WAF 对浏览器引擎的检测——Firefox 全部被拦，Chromium 可以通过
metadata:
  type: project
---

## 核心结论

阿里云 WAF 检测的是**浏览器引擎指纹**，不是 User-Agent。这一结论经过 6 组对照实验验证：

| 浏览器 | 引擎 | UA | 结果 |
|--------|------|-----|------|
| Camoufox（Firefox） | Gecko | Firefox 原生 | ❌ WAF |
| Camoufox（Firefox） | Gecko | 手机 Safari | ❌ WAF |
| Camoufox（Firefox） | Gecko | Chrome 桌面 | ❌ WAF |
| DrissionPage（Chromium） | Blink | Chrome 原生 | ✅ 通过 |
| DrissionPage（Chromium headless） | Blink | Chrome 125 | ✅ 通过 |
| Node.js `https` 模块 | 无 | Chrome | ❌ WAF |

**结论：只要是 Gecko 引擎，无论怎么伪装 UA 都会被 WAF 挑战；只要是 Blink 引擎（Chromium），默认就能通过。**

## 为什么会这样

- Firefox 全球市占率 ~3%
- 真人 Firefox 用户极少访问国内航司网站
- 阿里云 WAF 的规则很可能是：**罕见的 Firefox TLS/JS 指纹 → 直接拦截**

这不是 Camoufox 的技术问题，是浏览器生态的现实。

## 实践指导

做国内网站逆向时：
1. **首选 Chromium 系**（DrissionPage / Playwright / Puppeteer）
2. **不要默认用 Camoufox**，除非目标站明确对 Chrome 做了反制
3. 如果必须用 Firefox，先做一个快速对照测试（Chrome vs Firefox 调同一个 API）

**Why**: 东航项目在 Camoufox → DrissionPage 迁移上花了大量时间，如果在开头就做对照测试，5 分钟内就能确认 Firefox 不可用。

**How to apply**: 接手新站点时，用 Chrome 和 Firefox 各调一次 API，对比响应。Firefox 被拦就果断切 Chromium。

[[waf-rate-limiting]] [[drissionpage-practice]]
