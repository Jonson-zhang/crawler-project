# 欧冶 RS6 补环境逆向方案

纯手动原型链补环境，不使用 sdenv、iv8 或任何自动化浏览器工具。

## 原理

基于 `.claude/env-patch/env_patch.js` 通用框架，在 Node.js 中构建"看起来和 Chrome 一样"的浏览器环境，让瑞数 6 的 JSVMP 混淆代码在补丁环境中正常执行并生成 Cookie。

## 文件说明

```
瑞数/欧冶/env-patch/
├── README.md           # 本文档
├── env_site.js         # 欧冶站点专属环境配置 + RS6 覆盖
├── runner.js           # 执行器：请求页面 → 提取挑战 → 补环境 → 生成 Cookie
└── crawler.py          # Python 爬虫：调用 runner.js + 查数据
```

## 用法

```bash
# 生成 Cookie
node runner.js

# 调试模式（查看缺失属性）
DEBUG_PROXY=true node runner.js

# 爬取数据
python crawler.py
python crawler.py --channel LG --page 1 --size 100
python crawler.py --json
```

## 已解决的问题

| 问题 | 症状 | 修复位置 |
|------|------|---------|
| `HTMLElement.prototype.getElementsByTagName` 缺失 | RS6 VM 创建 div 后立即崩溃 | `env_site.js` 2.9 |
| `document.appendChild`/`removeChild` 缺失 | 外链 JS while(1) 循环 60s 超时 | `env_site.js` 2.11 |
| `document.createELement` 不设 tagName/nodeName | RS6 反射检测失败 | `env_site.js` 2.12 |
| style 原型共享（同一个对象） | RS6 修改 style 影响全部元素 | `env_site.js` 2.10 |
| `window.indexedDB` 缺失 | 环境指纹不完整 | `env_site.js` 2.13 |
| Cookie 包含 path/expires/Secure | Python 端解析出多余键值对 | `runner.js` Phase 5 清理逻辑 |
| Cookie name 被 toLowerCase | `T0k1m0u5AfREP`→`t0k1m0u5afrep` 大小写错误 | `runner.js` parseInto 修正 |

## 当前状态

### ✅ 已完成

- **Cookie 生成**：304 字节，含 T0k1m0u5AfREP 主 Cookie
- **202 挑战通过**：首次 GET /steel 的 RS6 挑战已完整处理
- **API HTTP 200**：POST 查询 API 返回 200

### ❌ 未完成

- **API 返回空数据**：HTTP 200 但响应体为空（0 字节）
- **根因**：RS6 服务器验证环境指纹的 C++ 引擎层差异，JS 补环境无法完全模拟

对比：sdenv 方案（C++ V8 Addon + jsdom）可正常获取 410KB 的 JSON 数据。

### env_patch 天花板

```
env_patch → 202 bypass ✅ → Cookie generated ✅ → API 200 ✅ → Empty body ❌
sdenv     → 202 bypass ✅ → Cookie generated ✅ → API 200 ✅ → 410KB data ✅
```

env_patch 生成的 cookie **结构正确**（通过了 202 挑战），但**环境指纹不完整**导致 RS6 服务器拒绝返回数据。

env_patch 在此场景已达到 JS 层补环境的上限。如需生产环境使用，请用 `瑞数/欧冶/ouyeel_sdenv.py`（sdenv 方案）。

详见 `.claude/env-patch/README.md` 中的「env_patch 天花板」章节。
