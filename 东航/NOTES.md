# 东航逆向全过程笔记

## 一、目标

- **网站**: m.ceair.com（东航移动端）
- **API**: `POST https://m.ceair.com/m-base/sale/shoppingv2`
- **加密**: WASM white-box AES-CBC
- **反爬**: Aliyun WAF + Tongdun/TrustDecision 指纹 SDK

## 二、技术发现

### WASM

- 类型: Emscripten wasm2js（非 wasm-bindgen）
- 文件: `wbsk_Wbox.js` (~1MB, C++→JS 编译)
- 导出: `wbsk_AES_cbc_encrypt`, `wbsk_AES_cbc_decrypt` 等 6 个函数
- IV: `[121,96,7,103,57,95,61,124,121,96,7,103,57,95,61,124]`
- Node.js 加载: `global.Module = require('./wbsk_Wbox.js')` 一行，无需补环境

### Cookie 体系

| Cookie | 来源 | 有效期 |
|--------|------|--------|
| `ssxmod_itna` | Tongdun/TrustDecision SDK 生成 | ~30 分钟 |
| `ssxmod_itna2` | 同 SDK 补充字段 | ~30 分钟 |
| `acw_tc` | Aliyun WAF 首页 Set-Cookie | ~30 分钟 |
| `acw_sc__v3` | WAF JS 挑战后生成 | ~30 分钟 |
| `_c_WBKFRo` | WAF 令牌 | ~1 年 |

关键: `acw_tc` + `ssxmod_itna` 必须来自同一浏览器会话，跨会话复制无效。

### 三层 WAF 防线

1. **TLS 指纹**: Python requests (OpenSSL TLS) 直接拦; Playwright Chromium/Firefox 被拒; Camoufox (定制 Firefox) ✅; CloakBrowser (定制 Chromium, 49 C++ 补丁) ✅
2. **IP + UA 风控**: 同一 IP 用 Chrome UA 多次请求→加入黑名单; 换 Edge UA 立刻正常
3. **Cookie 会话绑定**: Cookie 必须在生成它的同一浏览器会话中使用

## 三、方案演进

### 阶段 1: Python requests + Node.js (❌)

`crawler.py` + `sign.js` → Python requests 发请求 → WAF 拦截

### 阶段 2: Camoufox MCP 手动 (✅ 临时)

通过 MCP 工具在 Camoufox 浏览器中注入 script → fetch → localStorage → 解密

### 阶段 3: Playwright Firefox (❌)

刷新用 Python 子进程调用 Playwright → `page.evaluate(fetch)` → SPA 替换 page → 报 TargetClosedError

### 阶段 4: Playwright Chromium (❌)

同 Firefox, SPA 替换 page 问题依旧

### 阶段 5: Playwright context.request (❌)

`context.request.post()` → 返回 WAF HTML（TLS 指纹不匹配）

### 阶段 6: CloakBrowser v1 (✅ 部分)

`page.evaluate(fetch)` → 有的成功有的超时→SPA 问题未完全解决

### 阶段 7: CloakBrowser v2 — ctx.pages 轮询 (✅ 最终方案)

```python
# api_bridge.py 核心修复
for attempt in range(3):
    for pg in ctx.pages:
        if pg.is_closed(): continue
        try:
            resp = pg.evaluate(fetch_js, enc_req)
            break
        except Exception:
            time.sleep(1)
```

两个独立 CloakBrowser session: Session 1 刷新 Cookie → Session 2 注入 Cookie + 调用 API

## 四、弯路与止损规则

### 弯路 1: 分析 Tongdun/TrustDecision 指纹 SDK (~2h)

下载分析了 tongdun_fm.js / trustdecision_normal.js / tingyun-origin.js, 搜索 itna/FECU/FECA, Hook document.cookie, 尝试 jsdom 运行。

**结论**: SDK 依赖 Web Worker + Canvas + WebGL + AudioContext, 纯 Node.js 不可复现

**止损规则**: 看到 trustdecision.com / tongdun.net 在加载列表 → 5 分钟内判死, 直接走浏览器桥接

### 弯路 2: 追踪博客文章 FECU/X-Tingyun (~30min)

搜索 2025 年文章提到的 `FECU`/`X-Tingyun`/`hxk_fec` → 所有已加载脚本中均未找到 → 站点已升级

### 弯路 3: api_bridge.py 极简页面方案 (多次尝试)

route.fulfill 返回空 HTML; 只加载 WAF 脚本; 用 add_init_script 注入 fetch。均因缺少完整 WAF 初始化上下文而失败。

## 五、最终文件清单

```
东航/
├── crawler.py            # Python 主控
├── api_bridge.py         # CloakBrowser 桥（Cookie + API）
├── sign.js               # WASM AES-CBC 加解密
├── wbsk_Wbox.js          # Emscripten wasm2js 运行时
├── wbsk_skb_orig.js      # 浏览器原始加密包装器
└── config.json           # 出发/到达/日期
```

## 六、沉淀的记忆文件

- `.claude/memory/stop-loss-rules.md` — 3 条止损规则
- `.claude/memory/waf-tls-fingerprint.md` — WAF/TLS 诊断流程
- `.claude/memory/emscripten-wasm2js-pattern.md` — wasm2js 标准加载
- `.claude/memory/crawler-conventions.md` — emoji 禁用规范

## 七、运行

```bash
cd 东航
python crawler.py              # 读 config.json
python crawler.py 杭州 北京    # CLI 覆盖
```

Cookie 自动保鲜（过期自动刷新），无需手动操作。
