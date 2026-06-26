---
name: no-automation-in-final-solution
description: 最终解决方案禁止使用MCP或浏览器自动化工具
metadata:
  type: feedback
  tags: [原则, 交付标准, 逆向工程]
---

## 核心原则

在逆向一个网站时，分为两个阶段：

### 调试阶段（允许）
- 可以使用 MCP（js-reverse、camoufox-reverse 等）
- 可以使用浏览器自动化工具（Playwright、Camoufox 等）
- 用于分析、定位、验证、对比

### 最终解决方案阶段（禁止）
- **严禁**使用 MCP 或浏览器自动化工具
- 只能采用以下两种方式：
  1. **纯算**：将加密算法完整还原，用 Python/Node.js 直接计算
  2. **补环境**：用 Node.js vm/Function 构造器等模拟浏览器环境，执行原始 JS 生成签名

**Why:** 最终解决方案需要独立运行，不依赖外部浏览器进程或 MCP 服务。纯算或补环境方案可以直接部署、集成到自动化流水线中，性能高、可维护、不依赖特定浏览器版本。

**How to apply:** 每次逆向完成后，检查最终代码中是否包含 MCP 调用或浏览器自动化（Playwright/Camoufox/puppeteer 等）。如果包含，说明还需要继续推进到纯算或补环境阶段才能交付。
