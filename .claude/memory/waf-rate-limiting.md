---
name: waf-rate-limiting
description: 阿里云 WAF 三级升级机制——越请求越严格，休息即恢复
metadata:
  type: project
---

## 阿里云 WAF 三级风控

短时间内大量请求（尤其是异常流量）会触发风控逐步升级：

| 级别 | 现象 | 响应 |
|------|------|------|
| 1 级：JS 挑战 | API 返回 `aliyun_waf_aa` meta + JS 挑战页 | 浏览器页面加载自动求解 |
| 2 级：滑块验证 | 弹出 `aliyunCaptcha-sliding-slider` 拖动验证 | 需要真人拖拽（CDP 模拟很难通过） |
| 3 级：405 彻底封 | "your request has been blocked" | 任何请求都拒绝 |

## 关键认知

- **升级是单向的**：从 1→2→3，不会自动降级
- **冷却即恢复**：停止请求 30 分钟~2 小时后，IP 从黑名单移除，回到 0 级
- **不要跟滑块死磕**：出现 2 级时说明 IP 已被标记，继续请求只会升到 3 级。等待冷却比攻克滑块更有效
- **残留进程是主要罪魁**：东航项目曾因 30+ 个 Chrome 残留进程持续发送请求，导致 IP 被快速升级

## 实践规则

1. **出现滑块 → 立即停止，不重试**。重试只会加速升级到 405
2. **测试前先清 Chrome 进程**：`taskkill /F /IM chrome.exe`
3. **正常使用时不要高频调用**：同一 IP 每分钟不超过 2-3 次请求
4. **开发调试时用代理换 IP**，避免触发生产 IP 的风控

**Why**: 东航开发中因为反复重试滑块求解（CDP drag、JS MouseEvent、page.actions 全试了），导致 IP 从 2 级升到 3 级，浪费了 2+ 小时。实际上等 30 分钟就解决了。

**How to apply**: 遇到 `aliyun_waf` 响应时，先判断是 1 级还是 2 级。1 级可以继续（浏览器自动求解），2 级以上直接报错退出，不要 retry loop。

[[waf-browser-engine]]
