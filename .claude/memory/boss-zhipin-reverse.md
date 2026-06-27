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

~~**为 `11f5a2fc.js`（2026版）运行 7 步 AST 管线**~~ → **已完成 VMP 追踪路线深入分析**

## 2026-06-27 最终状态

### 核心结论

**VMP replay 方案有根本性限制**：条件分支（`p = X ? A : B`）的选择依赖运行时变量，不同的环境产生不同的分支选择，导致 trace 索引错位。单纯替换 `p=N` 不足以保证路径一致性。

### 可行方案优先级

| 方案 | Token长度 | API结果 | 可行性 |
|------|----------|---------|--------|
| `sign_boss_minimal.js` | 305 | code=38 | ✅ 可用但被拒 |
| `sign_boss_v17.js` | 453 | code=38 | ✅ 可用但被拒 |
| 浏览器 replay | 理论匹配 | 未验证 | ⚠️ 条件分支不同步 |
| **社区 AST 管线** | 纯算法 | code=0 | 🎯 **正确方向** |

### 为什么社区方案可行

1. 先用 AST 解密/脱壳 → 去除所有混淆（字符串表、dispatcher、控制流平坦化）
2. 控制流平坦化**先于**执行——在 AST 层面就消除了所有分支
3. 最终输出是纯算法函数，输入 seed+ts，输出 token，**完全不访问浏览器环境**

### 我们与社区的差距

- 我们：跳过 AST 步骤，直接尝试运行时 VMP 路径修复 → 失败因条件分支不同步
- 社区：先 AST 处理消除所有分支，再运行 → 成功

### 关键资产（用于 AST 管线）

| 文件 | 用途 |
|------|------|
| `config/traces/browser_vmp_trace.txt` | 5629 步浏览器路径，用于 CFG 平坦化 |
| `config/vmp_complete_map.json` | 9705 个 CER→ops 映射 |
| `config/pure_operations.json` | 4616 步去重操作序列 |
| `config/browser_path.json` | p→next_p 映射表 |
| `config/0decrypt_ref.js` | 社区 7 步管线参考（旧版） |

## 当前状态（2026-06-27 最终）— 双路线方案

### 🎯 路线 A：浏览器桥接（推荐，code=0 ✅）

**原理**：Camoufox 浏览器中直接调用 Boss API，浏览器自带完整环境指纹

**已验证**：
- 在 Camoufox 中通过 `evaluate_js` 调用 `/wapi/zpgeek/search/joblist.json`
- code=0，返回 15 条职位（python/北京）
- 支持任意关键词（python、java 均通过）

**实现**：
1. 启动 Camoufox → 访问 `zhipin.com/web/geek/jobs`
2. 等待页面加载（安全检查自动完成）
3. `evaluate_js` 调用 API → 直接获取数据

**限制**：需要浏览器实例运行，速度慢于纯算

### ⚠️ 路线 B：Node.js 补环境（备选，code=38）

**原理**：在 Node.js 中模拟浏览器环境，运行原始 `security-11f5a2fc.js`

**现状**：
- `sign_boss_v17.js` 可生成 token（453 chars，前缀 `8ed5gw` 匹配）
- API 返回 code=38（环境异常）— token 有效但指纹不完全匹配
- 根因：Node.js 的 `typeof`/原型链/jitless 与真实浏览器有 C++ 层差异

**收益**：无需浏览器依赖，速度极快。通过进一步精确匹配指纹可做到 code=0

### 路线 C：纯算（远期，0 依赖）

需要完整的 AST 管线（解密→消除分发器→控制流平坦化），预估 2-3 天工作量。

## 2026-06-27 进度更新（深夜）

### 关键发现

1. **社区 AST 管线不适配 2026 版**：`11f5a2fc.js` 没有 base64 字符串表，直接用数字编码，7 步管线无法直接应用

2. **VMP 结构确认**：2026 版与旧版结构相同，变量名变化：
   - 旧：WSl=p&31, jSl=p>>5&31, FSl=p>>10&31
   - 新：Cbl=p&31, Ebl=p>>5&31, Rbl=p>>10&31

3. **成功提取状态表**：1254 CER 状态 + 1141 hp 级状态（含 53 个环境检查点）
   - 资产：`config/vmp_full_map_2026.json`

4. **浏览器端成功执行 traced JS**：
   - 在 Camoufox 浏览器中通过本地 HTTP 服务器加载 traced JS
   - Token: 373 chars（在 127.0.0.1 环境下）
   - VMP 追踪：107,830 步，5,629 唯一状态

5. **Node.js vs 浏览器路径对比**：
   - 前 2086 步路径完全一致
   - **第 2087 步首次分叉**：state 21679 (CER 15,5,21)
     - 浏览器 → p=11758 (Eg=_[Cg]: 属性查找)
     - Node.js → p=21126 (vS=g.call(void 0): 函数调用)
   - 浏览器独有 729 个状态，Node.js 独有 653 个状态

6. **安全问题**：
   - security JS 在 Boss直聘生产环境中通过 **iframe** 加载
   - 安全页面创建 `zhipinFrame` iframe，在其中加载 JS
   - ABC 通过 `iframe.contentWindow.ABC` 访问
   - 调用：`new ABC().z(seed, ts + 60*(480+timezoneOffset)*1000)`

### 资产更新

| 文件 | 说明 |
|------|------|
| `config/extract_map_2026.js` | VMP 状态提取（2026 版） |
| `config/extract_full_map_2026.js` | 增强版：含 hp 分发 |
| `config/vmp_full_map_2026.json` | 完整状态表（283KB） |
| `config/traces/browser_vmp_trace.txt` | 浏览器追踪（5629 唯一状态） |
| `config/traces/nodejs_vmp_trace.txt` | Node.js 追踪（4900 唯一状态） |
| `config/vmp_trace_2026.js` | 注入追踪点的脚本 |
| `config/security-traced-2026.js` | 含追踪的安全 JS（790KB） |
| `config/trace_runner.js` | Node.js 追踪执行器 |
| `config/test_browser.html` | 浏览器测试页面 |

### 下一步

修复首个分歧点 → 逐步消除环境差异 → 生成纯算法

定位 state 21679 的具体 hp 检查，修复 Node.js 环境使路径匹配浏览器。
