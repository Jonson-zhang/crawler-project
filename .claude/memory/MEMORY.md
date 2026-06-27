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
- [线上资源保持原始完整](online-resources-keep-raw.md) — 从线上获取的 JS 源码/字节码必须和原始文件一模一样，禁止截断/格式化
- [WAF 浏览器引擎检测](waf-browser-engine.md) — **新**：阿里云 WAF 对 Firefox/Gecko 全线拦截，Chromium/Blink 天然通过
- [WAF 风控升级机制](waf-rate-limiting.md) — **新**：三级升级（JS 挑战→滑块→405 封杀）+ IP 冷却恢复
- [DrissionPage 踩坑汇总](drissionpage-practice.md) — **新**：API 陷阱、进程管理、headless 配置
- [最终方案禁用自动化工具](no-automation-in-final-solution.md) — **核心原则**：调试期可用 MCP/浏览器，最终交付代码只能用纯算或补环境
- [默认使用 cloakbrowser](default-cloakbrowser.md) — 自动化浏览器默认 `from cloakbrowser import launch`
- [Camoufox 版本兼容问题](camoufox-version-issue.md) — `cloakbrowser`→`camoufox` 改名导致 ModuleNotFoundError
- [Emscripten wasm2js 模式](emscripten-wasm2js-pattern.md) — 与 wasm-bindgen 完全不同，不需要 stub 生成
- [小红书 XYW_ / x-rap-param 缺口](xhs-xyw-xrap-gap.md) — 何时需要实现 XYW_ 签名和 x-rap-param（homefeed 不需要，暂不实现）
- [小红书离线 VM 签名方案](xhs-offline-vm.md) — **已攻克 (2026-06-26)**：env.js + eval 抠 DS + setter 拦截 → mns0301 ✓（实现见 `小红书/v2.0/`）
- [VMP env slot 预填充](xhs-setter-intercept.md) — 可复用的 VMP 通用技巧：setter 拦截 + env 数组预填 200 个构造槽位
- [换电脑恢复流程](backup-restore.md) — git push 即备份，bash install-mcp.sh 即恢复
- [Boss直聘逆向进度](boss-zhipin-reverse.md) — **2026-06-26**: VMP 9912状态map + 1318步trace, 补环境13轮(code 38→37), 明天转纯算

## iv8 引擎踩坑（Node.js → iv8 迁移）

> 四条经验来自小红书 iv8 迁移实战，每条都解决了一个"VMP 加载成功但 mnsv2=undefined"的根因。

- [DOM 方法必须提前 stub](iv8-dom-stubs.md) — iv8 真实 DOM 校验参数类型，VMP 调 removeChild 抛 TypeError → 必须在 VMP 前 stub
- [IIFE 隔离作用域](iv8-iife-scope.md) — iv8 无模块系统，var 全在全局作用域；ds_v2 覆盖 ds_script 的变量 → VMP 解码失败 → 必须 IIFE 包裹
- [.forEach() 闭包隔离](iv8-foreach-closure.md) — for + var 共享闭包变量 → VMP setter 拦截失效；forEach 每次回调独立闭包
- [navigator.plugins 空数组](iv8-navigator-plugins.md) — iv8 C++ navigator 默认含真实 Chrome 插件 → VMP 误判环境 → 必须显式设为 []
