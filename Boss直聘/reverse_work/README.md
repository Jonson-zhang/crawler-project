# Boss直聘逆向全过程记录（2026-06-26 ~ 2026-06-27）

## 最终结论

**iv8（C++ V8 + 原生浏览器 API）是唯一通过 code=0 的无浏览器方案。**

JavaScript 层补环境（Node.js / jsdom / vm）无法解决 `typeof` / 原型链 / hidden class 等
C++ 引擎层差异，导致 VMP 走不同的条件分支，token 永远与浏览器不一致。

## 时间线

| 日期 | 版本 | 进展 |
|------|------|------|
| 06-26 | v1-v9 | 初步补环境，token 生成成功但 code=37/38 |
| 06-26 | v10-v12 | vm 沙箱 + 完整构造函数，31/31 自检通过 |
| 06-26 | v13-v15 | 社区方案参考（4reverse.js），code 从 37→38 |
| 06-26 | v15-v18 | 精确 Camoufox 指纹对齐，始终 code=38 |
| 06-27 | VMP 分析 | 提取 9705 状态 + 5629 步浏览器 trace |
| 06-27 | 分叉定位 | 发现第 2087 步分叉，定位 22 个检测点 |
| 06-27 | v19-v20 | iframe 上下文修复 + 精确指纹，code=38 |
| 06-27 | iv8 | 找到 iv8，C++ 层实现浏览器 API → **code=0** |

## 关键技术分析资产

### VMP 结构
- `config/vmp_complete_map.json` — 9705 个 CER → 操作映射
- `config/vmp_full_map_2026.json` — 1254 CER + 53 环境检查点
- `config/traces/browser_vmp_trace.txt` — 5629 步浏览器执行路径
- `config/traces/nodejs_vmp_trace.txt` — 4900 步 Node.js 执行路径
- `config/pure_operations.json` — 4616 步去重操作序列
- `config/resolved_ops.json` — 1153 个已解析字符串

### 环境检测点
- `config/prop_access_log.json` — 22 个 VMP 检测点完整列表
- `config/env_decisions.json` — 167 个条件分支决策

### 分析脚本
- `config/extract_*.js` — 状态表提取系列
- `config/build_*.js` — 纯算法构建系列
- `config/gen_*.js` — 代码生成系列
- `config/find_divergence.js` — 分叉点定位
- `config/eliminate_env_checks.js` — 环境检查消除
- `config/env_trace.js` — Proxy 环境探测

### sign_boss 版本迭代
- `sign_boss_v1.js` ~ `sign_boss_v20.js` — 20 轮补环境迭代
- `sign_boss_final.js` — 最终版（vm 沙箱）
- `sign_boss_minimal.js` — 社区最小环境
- `sign_boss_determ.js` — 确定性 token 尝试
- `sign_boss_sdenv.js` — sdenv-jsdom 尝试
- `sign_boss_browser.js` — 浏览器桥接
- `sign_boss_replay.js` — trace 回放尝试

### 参考资源
- `BossReverse_ref/` — 社区 7 步 AST 管线（chencchen/webcrawler）
- `rs-reverse/` — 瑞数逆向参考
- `env_patch.js` — 环境补丁

## 核心认知

1. **Node.js 补环境无法通过 code=0** 的根本原因是 C++ 引擎层差异，不是属性值不对
2. **VMP 的条件分支**（`p = X ? A : B`）中的 X 来自 `typeof`、比较运算、原型链检查，
   这些在 JS 层无法完全模拟
3. **Camoufox 指纹随机化** 导致 token 无法稳定复现——每次启动指纹不同，对应不同 VMP 路径
4. **iv8 之所以能过**，是因为浏览器 API 在 V8 引擎的 C++ 层实现，而非 JS 层模拟
5. **纯算路线（AST 平坦化）** 理论可行但工作量巨大——需要消除 167 个条件分支和嵌套函数包装

## 可用于未来续接的路线

1. **iv8 不行时 → C++ 层修复**：iv8 源码在 C++ 层，可自行 patch 添加缺失的 API
2. **AST 纯算**：167 个条件分支已在 `env_decisions.json` 中记录了浏览器选择，
   配合 `vmp_complete_map.json` 可消除条件分支，需要处理嵌套函数包装
3. **Firefox-Reverse**：C++ 引擎层 trace 工具，可以逐属性对比浏览器 vs Node.js 差异
