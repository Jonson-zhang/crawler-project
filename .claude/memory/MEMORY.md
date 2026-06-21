# 通用经验

> 领域专用 memory 在子目录下，不会自动加载到每次会话。做特定领域逆向时，Agent 检测到关键词后主动读对应子索引：
> - WASM → `memory/wasm/MEMORY.md`
> - WAF / TLS / Cookie 保鲜 → `memory/waf-tls-fingerprint.md`
> - 止损判定 → `memory/stop-loss-rules.md`
> - （未来：`js/` `android/` …）

## 止损规则（每次逆向必查）

> ⚠️ **当 SKILL CHECK-2 未命中已有案例时，在走标准 Phase 1 之前，必须先对照止损规则做快速判定。**
> 这三条规则的核心价值：**5 分钟内判死，避免在东航实战中曾浪费 2 小时的方向上重复投入。**

- [止损规则](stop-loss-rules.md) — 3 条强制判定：
  1. 指纹 SDK 不可纯 Node.js 复现
  2. 请求返回 WAF HTML ≠ Cookie 问题
  3. `Module._malloc` + `Module.cwrap` → Emscripten wasm2js

## 其他经验

- [Crawler 项目约定](crawler-conventions.md) — 工具链、代码组织、输出方式的默认约定
- [WAF/TLS 指纹识别与应对](waf-tls-fingerprint.md) — requests 返回 WAF HTML 的诊断 + 浏览器桥接方案 + Cookie 保鲜
- [Emscripten wasm2js 模式](emscripten-wasm2js-pattern.md) — 与 wasm-bindgen 完全不同，不需要 stub 生成
- [换电脑恢复流程](backup-restore.md) — git push 即备份，bash install-mcp.sh 即恢复
