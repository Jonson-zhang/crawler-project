---
name: boss-zhipin-reverse
description: Boss直聘 __zp_stoken__ 逆向进度（补环境13轮 + AST提取 + 纯算方向）
metadata:
  type: project
---

# Boss直聘 __zp_stoken__ 逆向进度

> 日期: 2026-06-26 | 状态: 补环境 31/31 自检通过但 code=37，准备转纯算

## 当前结论

**补环境 13 轮（v1→v12）**，code 从 38 降到 37（环境异常消失），31/31 自检全通过但始终无法突破 code=0。

**根因**：VMP 有 9912 个状态节点，其中 9861 个（99.5%）是环境检测死代码（浏览器只访问了 51 个 (W,j) 组合 + 展开 chain 后约 8700 个）。vm 沙箱在 `typeof`/`prototype`/hidden classes 等 C++ 层面的细微差异导致 VMP 分流到不同代码路径。

**社区方案**（52pojie/微信文章）之所以成功：先 AST 脱壳 → 剪枝 → 硬编码 typeof 检查 → 再补环境。我们跳过了剪枝 + 硬编码步骤。

**Why:** 日经 13 轮迭代，99% 时间卡在 JS 文本替换/注入的工程问题上。纯算路线可彻底避开环境检测问题。
**How to apply:** 明天从第 4 步开始——用 Python 实现 algo_trace.json 中的 1580 个操作。

## 关键资产

| 文件 | 路径 | 说明 |
|------|------|------|
| 9912 状态 map | `Boss直聘/config/vmp_state_map.json` | (W,j,F) → 操作+下一状态 |
| 1580 操作 trace | `Boss直聘/config/algo_trace.json` | 浏览器路径的完整操作序列 |
| v12 补环境 | `Boss直聘/sign_boss_v12.js` | 31/31 自检通过, 130 Chrome 构造函数 |
| 浏览器 trace | MCP 录制 | 1318 步 l().apply 调用, 52 唯一状态, 131 状态 (含 chain) |
| 线性 VMP 构造器 | `Boss直聘/config/build_linear_v2.js` | for 循环边界计算有 bug |
| FSl 覆盖 v4 | `Boss直聘/config/security-patched-v4.js` | parse 通过, 运行时卡 |
| 纯算法骨架 | `Boss直聘/config/pure_algo.py` | Python 模板, 未完成 |
| 算法操作 | `Boss直聘/config/trace_extractor.js` | 从 map+trace 提取 1580 操作 |
| 状态解码 | `h:\Crawler\Boss直聘\config\extract_state_map.js` 等 | 提取 (W,j,F) 的 Babel 脚本 |
| API 流程 | `Boss直聘/main.py`, `Boss直聘/test_v8_loop.py` | curl_cffi + Node.js 集成 |

## VMP 三层结构

```
状态 p 编码: W = p & 31, j = (p>>5) & 31, F = (p>>10) & 31
for (; p !== void 0; ) { WSl=..., jSl=..., FSl=...; switch(WSl) { ... } }
  每个 WSl case: var zSl = function() { switch(jSl) { ... } }.apply()
    每个 jSl case: var a = function() { FSl===0 ? (...) : FSl===1 ? (...) : void 0 }.apply()
```

## 浏览器追踪分析

- 1318 步 l().apply 调用
- 52 个唯一顶层状态
- 核心循环: 16974 ↔ 10689（36 对 = 72 步）
- 392 次 2164（toLowerCase 变换）
- 696 次 16974（构建 "c66fgw" 前缀 + 浏览器属性检查）

## API 测试结论

- curl_cffi 可用（浏览器 cookie → code=0 ✅）
- POST + form data 走浏览器路径（code=0）
- 两次 GET 调用间隔必须极短（< 100ms）
- Token 与 __a / __c 无关，只依赖 (seed, ts)

## 开源项目查证（2026-06-27）

6 个项目全部结论：**纯算方案在开源社区零存在**。

| # | 项目 | 方案 | token逆向 |
|---|------|------|:--:|
| 1 | willson-wen/boss-jd-scraper | bb-browser Skill | ❌ |
| 2 | kevinstaff/boss-zhipin-anti-scraping | CDP 架构 Skill | ❌ |
| 3 | zwgFF/zp_stoken_jsLearn | jsdom 补环境 (3年前Chrome84) | ⚠️ 过期 |
| 4 | nothing248/boss-scrapy | Patchright 桥接 | ❌ |
| 5 | warterbili/BossZhipin_reverse | mitm-rpc (最完善) | ❌ |
| 6 | Jing7-Zhang/BOSS_ZhiPin | DevTools 入门教程 | ❌ |

## 纯算进度（2026-06-27）

**vmp_full_executor v2** 成功：
- 82 步顶层 walk + 12 个子程序 trace
- 揭示了完整算法结构：
  - State 3463: 构建自定义 Base64 表 (A-Za-z0-9+/=)
  - State 3218/6798/20492: 构建属性名检查环境 (Geolocation, HTMLElement, NodeIterator, charCodeAt)
  - State 10734: 检查 Math.random/floor
  - State 20754: 检查 SVGPointList
  - State 3655/3463: 最终编码
  - 147/1580 ops 直接依赖环境

- **根因确认**: byte 5 开始 v12 token 就与浏览器分叉，走完全不同的 VMP 代码路径

## 当前状态（2026-06-27 深夜）

**补环境 v15**：453 chars，与浏览器同前缀 `8ed5gw`，code 37/38。差 24 chars。

**社区方案确认**（chencchen/webcrawler，402 stars）：
1. `0decrypt.js` + `2module_result.js` → 7步AST管线
2. `step1-7`: 解密字符串→拆分逗号→替换dispatcher→hex2dec→**控制流平坦化**→字符串数组合并→minify→替换函数
3. 最终输出 `20210525.js`（纯算法，不需补环境）
4. `4reverse.js`：20行极简环境 + `Function.prototype.toString=""`

**关键认知**：社区从未补环境。他们先 AST 脱壳得到纯算法，纯算法只需 seed/ts，不碰环境。

## 明天计划（2026-06-28）

**为 `11f5a2fc.js`（2026版）运行 7 步 AST 管线**：
1. 提取新版 JS 的字符串表 → `2module_result_new.js`
2. `0decrypt.js → step1-7` → 生成 `20210525_new.js`
3. 纯算法验证：`ABC.z(seed, ts)` → 与浏览器对比

**备选**：如果 AST 管线遇到新 VMP 结构问题，用 MCP 浏览器 trace 获取新版 VMP 的状态表（9912 states），再走之前的老路。
