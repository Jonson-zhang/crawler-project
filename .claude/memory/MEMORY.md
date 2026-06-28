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

> ⚠️ **补环境 3 轮后签名仍错误（不 crash）时，对照天花板规则判定是否切 iv8。**

- [env_patch 天花板判定](env-patch-iv8-ceiling.md) — 3 轮法则 + 引擎层差异信号 + iv8 可行性数据（Boss直聘 13 轮→iv8 一次过）

## 其他经验

- [env.js / sign.js 分离架构](env-sign-separation.md) — 补环境与签名逻辑分离的目录结构规范
- [Crawler 项目约定](crawler-conventions.md) — 工具链、代码组织、输出方式的默认约定
- [WAF/TLS 指纹识别与应对](waf-tls-fingerprint.md) — requests 返回 WAF HTML 的诊断 + 浏览器桥接方案 + Cookie 保鲜
- [线上资源保持原始完整](online-resources-keep-raw.md) — 从线上获取的 JS 源码/字节码必须和原始文件一模一样，禁止截断/格式化
- [WAF 浏览器引擎检测](waf-browser-engine.md) — **新**：阿里云 WAF 对 Firefox/Gecko 全线拦截，Chromium/Blink 天然通过
- [WAF 风控升级机制](waf-rate-limiting.md) — **新**：三级升级（JS 挑战→滑块→405 封杀）+ IP 冷却恢复
- [DrissionPage 踩坑汇总](drissionpage-practice.md) — **新**：API 陷阱、进程管理、headless 配置
- [env-patch 使用规范](env-patch-usage.md) — **核心框架**：env_patch.js 是通用底座不可改，每个站点写 env_site.js 层叠差异
- [最终方案禁用自动化工具](no-automation-in-final-solution.md) — **核心原则**：调试期可用 MCP/浏览器，最终交付代码只能用纯算或补环境
- [默认使用 cloakbrowser](default-cloakbrowser.md) — 自动化浏览器默认 `from cloakbrowser import launch`
- [Camoufox 版本兼容问题](camoufox-version-issue.md) — `cloakbrowser`→`camoufox` 改名导致 ModuleNotFoundError
- [Emscripten wasm2js 模式](emscripten-wasm2js-pattern.md) — 与 wasm-bindgen 完全不同，不需要 stub 生成
- [小红书 XYW_ / x-rap-param 缺口](xhs-xyw-xrap-gap.md) — 何时需要实现 XYW_ 签名和 x-rap-param（homefeed 不需要，暂不实现）
- [小红书离线 VM 签名方案](xhs-offline-vm.md) — **已攻克 (2026-06-26)**：env.js + eval 抠 DS + setter 拦截 → mns0301 ✓（实现见 `小红书/v2.0/`）
- [VMP env slot 预填充](xhs-setter-intercept.md) — 可复用的 VMP 通用技巧：setter 拦截 + env 数组预填 200 个构造槽位
- [换电脑恢复流程](backup-restore.md) — git push 即备份，bash install-mcp.sh 即恢复
- [Boss直聘逆向进度](boss-zhipin-reverse.md) — **2026-06-26**: VMP 9912状态map + 1318步trace, 补环境13轮(code 38→37), 明天转纯算

## iv8 引擎 + 逆向方法论（Boss直聘 + 知乎 + 小红书三轮实战）

> 三个站点的 iv8 迁移沉淀出的完整工作流、工具分工、常见陷阱。

### 核心工作流

- [两阶段逆向工作流](iv8-nodejs-workflow.md) — **Node.js 勘探 + iv8 交付**：MCP 提取原料 → Node.js 快速试错 → iv8 纯 Python 交付。每个工具做它最擅长的事
- [Python/JS 语义差异](python-js-semantic-gaps.md) — **签名被拒时先查这四条**：空 dict 判空、双重序列化、Base64 编码表对齐、JSON 分隔符

### iv8 引擎特定踩坑（VMP 加载 → mnsv2 可用）

- [DOM 方法必须提前 stub](iv8-dom-stubs.md) — iv8 真实 DOM 校验参数类型 → TypeError
- [IIFE 隔离作用域](iv8-iife-scope.md) — 模拟 Node.js require 模块作用域
- [.forEach() 闭包隔离](iv8-foreach-closure.md) — for + var 共享闭包 → setter 拦截失效
- [navigator.plugins 空数组](iv8-navigator-plugins.md) — iv8 默认值 ≠ env.js
- [document.cookie 直接赋值](iv8-doc-cookie.md) — iv8 document 不可 POJO 替换，用 getter 覆盖

### 目录组织

- [iv8 目录自包含](iv8-self-contained.md) — **强制规则**：每个站点的 SDK 文件必须复制到本目录，禁止跨目录引用。复制整个文件夹即可独立部署，版本隔离。

### 各站点总结

- **Boss直聘** — VMP 53 检查点，Canvas 指纹文本关键。iv8 可行：`_canvas_png.txt` 注入
- **知乎** — 最轻量，无 VMP，只读 `crypto.getRandomValues`。iv8 一线过
- **小红书** — VMP 中量，只读 `doc.body + doc.cookie`。iv8 可行但踩了 Python 语法坑。**结论：VMP 检测不深于 iv8 C++ 能力范围**
