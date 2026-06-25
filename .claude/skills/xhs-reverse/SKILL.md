# 小红书 Web API 逆向 Skill

逆向小红书 PC Web 端 API 签名参数的完整方法论。

## 硬约束

1. **禁止使用第三方逆向成品库** — 所有签名算法必须自研，不得参考他人逆向项目。
2. **每个请求必须带完整签名头** — x-s + x-s-common + x-t + x-b3-traceid + x-xray-traceid，缺一不可。
3. **访客 Cookie 可以拿数据** — 不需要 `web_session`（登录态Cookie），访客 Cookie 足以请求 homefeed 并返回数据。
4. **对比法优先** — 遇到 code=0 items=0 或 406 时，第一时间用真实浏览器抓请求做逐行对比，不要猜。
5. **补环境必须用原型链** — 详见 [references/env-patching.md](references/env-patching.md)。

## MCP 使用原则

| MCP | 用途 | 场景 |
|-----|------|------|
| `js-reverse` | Chrome DevTools 调试（断点、搜索、调用栈） | 定位签名函数、追踪调用链、抠代码 |
| `camoufox-reverse` | 反检测浏览器（绕过 TLS 指纹、执行 JS） | 抓取线上脚本、触发 API 请求、导出 Cookie |

**优先使用 `js-reverse`** 做代码调试和断点分析；`camoufox-reverse` 用于需要反检测指纹的场景。

## 签名参数清单

| 参数 | 来源 | 复杂度 | 说明 |
|------|------|--------|------|
| `x-s` (XYS_) | 线上 VMP 字节码 + 补环境 | **最高** | 核心签名，依赖 VMP 解释器执行字节码 |
| `x-t` | `int(time.time() * 1000)` | 低 | 毫秒时间戳 |
| `x-b3-traceid` | `random.choices(hex, k=16)` | 低 | 16 位 hex 随机串 |
| `x-xray-traceid` | `(ts << 23) \| random(0, 0x7FFFFF)` → hex | 低 | 时间戳编码 + 随机数 |
| `x-s-common` | 14+ 字段指纹 JSON → RC4 → URLEncode → 自定义 Base64 | 中 | 含 a1、b1 指纹、CRC32 校验 |
| Cookie 引导 | 多次请求链获取 Set-Cookie | 中 | 每次引导请求**必须带完整签名头** |

## 访客 Cookie 真相

**不需要 `web_session`**。访客模式下 homefeed API 能正常返回数据。

homefeed API 需要的 Cookie 集合：
```
a1, webId, webBuild, xsecappid, loadts, abRequestId,
websectiga, sec_poison_id, gid
```

Cookie 引导流程（见 [references/cookie-bootstrap.md](references/cookie-bootstrap.md)）中，
shield/webprofile 和 activate 两个步骤**都必须带完整 5 项签名头**（x-s + x-s-common + x-t + x-b3 + x-xray），否则服务端静默降级。

## 逆向总流程

### Phase 1：抓包分析（浏览器）

1. 打开 `https://www.xiaohongshu.com/explore`
2. Network 面板过滤 `homefeed`
3. 滚动触发瀑布流 → 捕获 homefeed POST 请求
4. 记录：请求头（5 项签名 + Cookie）、请求体、响应体结构

### Phase 2：x-s 签名逆向（Node.js 补环境）

这是最难的部分。当前线上架构：

```
vendor-dynamic.js (webpack, 1.3MB)
  └─ seccore_signv2() 调用 window.mnsv2(u, m, w)
       └─ 构建 {x0,x1,x2,x3,x4} → JSON → UTF8 → 自定义Base64 → "XYS_" + result

mnsv2 创建链：
  ds_loader.js (151KB) → VMP 解释器基础
  ds_api.js (60KB)     → _BHjFmfUMEtxhI(__$c, env) → __bc 字节码 (2466 chars)
  ds_v2.js (62KB)      → _AUuXfEG27Xa3x(__$c, env) → 覆盖升级 → mns0301
```

详细步骤见 [references/mns-extraction.md](references/mns-extraction.md)。

补环境方法见 [references/env-patching.md](references/env-patching.md)。

### Phase 3：x-s-common 签名（Python 自研）

见 [references/xsc-common.md](references/xsc-common.md)。

### Phase 4：Cookie 引导（Python 自研）

见 [references/cookie-bootstrap.md](references/cookie-bootstrap.md)。

### Phase 5：集成翻页

1. Cookie 引导获取全部访客 Cookie
2. 每条 API 请求：Python 生成 x-s-common + 辅助头，Node.js 子进程生成 x-s
3. homefeed 翻页：`cursor_score` 来自上一页响应 `data.cursor_score`

## 流程速查

### 场景 1：从零开始逆向

→ [references/new-site-workflow.md](references/new-site-workflow.md)

### 场景 2：homefeed 返回 items=0

1. 检查请求头中 5 项签名是否全部存在
2. 检查 Cookie 是否包含 a1、webId、gid（最少集合）
3. 用真实浏览器的 Cookie + 签名对比自己生成的
4. → 详见 [references/common-pitfalls.md](references/common-pitfalls.md) 坑 1

### 场景 3：x-s 生成失败 / mnsv2 不存在

1. `node sign.js` 报错 → 缺环境变量，对照 [references/env-patching.md](references/env-patching.md)
2. 输出 mns0201 而非 mns0301 → ds_v2 覆盖失败，检查 `_AUuXfEG27Xa3x` setter
3. `undefined is not a constructor` → VMP 字节码解释时缺少构造器，补对应的 HTMLxxxElement

### 场景 4：x-s-common 验证未通过

1. 抓浏览器真实 x-s-common → 解码 → 对比字段
2. webBuild 版本号会随小红书发版变动，从浏览器 Cookie 或请求头中获取当前值
3. → 详见 [references/xsc-common.md](references/xsc-common.md)

## 经验法则

1. **访客 Cookie 就能拿数据** — 不要被"缺 web_session"误导
2. **禁止使用第三方逆向成品库** — 所有签名必须自研
3. **每个 API 请求都必须带 5 项签名头** — 缺一项可能 406 或静默降级
4. **code=0 items=0 不是"无数据"，是签名/Cookie 不完整**
5. **先对比再补环境** — 用真实浏览器的请求做逐字段对照
6. **补环境用原型链** — 不是简单扔 Object.assign，要有正确的原型链和 native toString
7. **VMP 字节码不能跳过** — 必须用正确环境执行 VMP 解释器，不能手动构造 x-s
8. **webBuild 会更新** — 每次逆向先检查线上当前版本号
9. **x-s-common 新增 x12 字段** — 当前线上版本是 15 字段（不是文档里的 14 字段）
10. **不要假定 TLS 指纹是根因** — 签名不正确时，换 TLS 指纹也拿不到数据
