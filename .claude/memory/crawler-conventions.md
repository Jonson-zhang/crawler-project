---
name: crawler-conventions
description: Crawler 项目的代码组织、输出方式、接口逆向默认约定
metadata:
  type: project
---

每个新网站逆向任务遵循以下默认约定：

**工具链**
- 使用 `mcp__js-reverse` 系列工具进行浏览器端 JS 分析与逆向
- 用 Python 实现加密/解密逻辑，供爬虫调用
- **生成Python代码，获取数据**
- **安装 Python 包必须用 `uv add <package>`**，禁止 `pip install`：`uv add` 会更新 `pyproject.toml` 和 `uv.lock`，确保 git 同步后 `uv sync` 能恢复；`pip install` 绕过锁文件，换电脑就丢依赖

**代码组织**
- 所有代码文件放在笔记 Markdown 文件所在的同一目录下
- 解密/签名函数单独放在一个文件中（如 `sign.py`），主爬虫文件（如 `crawl.py`）import 使用
- 无需创建额外的子目录结构

**版本迭代规则（目录级分支）**
- 代码一旦跑通（验证成功），**禁止原地修改**
- 要换方案或迭代，创建新目录如 `cloak_v1.0`、`drission_v1.0`，或递增 `v1.1`、`v1.2`
- 新目录必须完全自包含，复制所有依赖文件进来，不引用父级文件
- 相当于用目录模拟 git branch，每个版本独立可运行，互不干扰

**Why:** 防止改坏已验证通过的代码。每个版本独立运行，可以随时回退对比。项目结构如 `crawler.py` + `api_bridge.py`（DrissionPage v1）和 `cloak_v1.0/test_cloak.py` + `cloak_bridge.py` 并存。
**How to apply:** 用户请求"换用 CloakBrowser"时，不修改 `crawler.py`/`api_bridge.py`，而是新建 `cloak_v1.0/` 目录，把所需文件全复制进去再改。

**功能要求**
- Python 代码只需能够从网站获取数据、跑通即可，不追求工程化
- 提供参数控制返回多少页的数据：用顶部 `CONFIG` dict 集中配置（`start_page`、`pages`、`limit`），用户直观可改
- 提供 `fetch_page(page, limit)` 按页码获取（页码 1 起始，内部换算 offset），比 `fetch_movies(offset, limit)` 更符合使用直觉

**Python 代码模板**

- **签名函数**：`generate_sign(offset, timestamp=None)` + 注释写明算法公式和 WASM 反汇编过程

**输出方式**
- 返回的数据只在控制台 `print` 输出显示，不需要存盘（不写 CSV/JSON/数据库）
- 输出格式：分隔线 + 页码/总数 + 分隔线 + 每条一行 + 最终汇总行
- **禁止使用 emoji**（如 `✅❌⚠️`），用纯 ASCII 文本标记替代：
  - `✅` → `[OK]` 或直接省略
  - `❌` → `[FAIL]`
  - `⚠️` → `[WARN]`
  - 成功/失败状态用 `print("[模块] 描述", file=sys.stderr)` 格式输出到 stderr
- 原因：Windows 中文控制台（GBK 编码）无法渲染 emoji，显示为 `\uXXXX` 转义序列，影响可读性

**交付清理**
- 完成项目开发后，清理不再需要的文件
