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

- [env.js / sign.js 分离架构](env-sign-separation.md) — 补环境与签名逻辑分离的目录结构规范
- [Crawler 项目约定](crawler-conventions.md) — 工具链、代码组织、输出方式的默认约定
- [WAF/TLS 指纹识别与应对](waf-tls-fingerprint.md) — requests 返回 WAF HTML 的诊断 + 浏览器桥接方案 + Cookie 保鲜
- [补环境通用模板](env-core-template.md) — 经小红书实战验证的通用补环境核心（toString保护/setNative/watch），可复用于任何 JS 逆向
- [线上资源保持原始完整](online-resources-keep-raw.md) — 从线上获取的 JS 源码/字节码必须和原始文件一模一样，禁止截断/格式化
- [WAF 浏览器引擎检测](waf-browser-engine.md) — **新**：阿里云 WAF 对 Firefox/Gecko 全线拦截，Chromium/Blink 天然通过
- [WAF 风控升级机制](waf-rate-limiting.md) — **新**：三级升级（JS 挑战→滑块→405 封杀）+ IP 冷却恢复
- [DrissionPage 踩坑汇总](drissionpage-practice.md) — **新**：API 陷阱、进程管理、headless 配置
- [默认使用 cloakbrowser](default-cloakbrowser.md) — 自动化浏览器默认 `from cloakbrowser import launch`
- [Camoufox 版本兼容问题](camoufox-version-issue.md) — `cloakbrowser`→`camoufox` 改名导致 ModuleNotFoundError
- [Emscripten wasm2js 模式](emscripten-wasm2js-pattern.md) — 与 wasm-bindgen 完全不同，不需要 stub 生成
- [小红书 XYW_ / x-rap-param 缺口](xhs-xyw-xrap-gap.md) — 何时需要实现 XYW_ 签名和 x-rap-param（homefeed 不需要，暂不实现）
- [小红书离线 VM 签名方案](xhs-offline-vm.md) — **当前项目**：VMP 逆向进度、env.dom.js 原型链、阻塞点（2026-06-24）
- [换电脑恢复流程](backup-restore.md) — git push 即备份，bash install-mcp.sh 即恢复
- [安装新工具时间步更新脚本](install-script-sync.md) — 装 MCP/Skill 必须同步更新 install-mcp.sh + .gitignore
