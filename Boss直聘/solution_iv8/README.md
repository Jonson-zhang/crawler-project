# Boss直聘 — iv8 方案

## 原理

[iv8](https://github.com/HanZzzzz000/iv8) 是 Python 原生 C++ 扩展，嵌入 Chrome 同款 V8 引擎，
并在 **C++ 层** 实现浏览器 API（navigator / document / screen / canvas / WebGL 等）。

因为浏览器 API 在 V8 引擎的 C++ 层实现（而非 JS 层模拟），原型链、`typeof`、`toString` 等
与真实浏览器完全一致，VMP 环境检测无法区分。

## 依赖

```bash
pip install iv8 requests
# iv8 是预编译 wheel（~50MB），含 V8 引擎，无需安装 Node.js 或浏览器
```

## 使用

```bash
python boss_iv8.py 101010100 python    # 北京 Python 职位
python boss_iv8.py 101010100 java      # 北京 Java 职位
```

或运行 iv8 官方示例：

```bash
python zp_stoken.py                    # 官方示例（含 canvas 指纹）
```

## 流程

```
requests → API code=37 → 拿到 seed/ts
  → 下载 security JS
  → iv8 C++ V8 执行 → new ABC().z(seed, ts)
  → 拿到 token
  → requests 重试 → code=0
```

全程不到 100 行 Python，无浏览器、无 MCP、无 Node.js。

## 文件

| 文件 | 说明 |
|------|------|
| `boss_iv8.py` | 简洁版（60 行核心逻辑） |
| `zp_stoken.py` | iv8 官方示例（含 canvas 指纹精确值） |

## 为什么之前的补环境方案（v1-v20）都失败了

| 方案 | 方式 | 为什么不行 |
|------|------|-----------|
| sign_boss_v1-v20 | Node.js 手动补环境 | JS 层模拟的 `typeof` / 原型链与真实 V8 C++ 层有差异 |
| Camoufox 浏览器 | 真实 Firefox | 指纹每次随机化，token 无法稳定复现 |
| Playwright Chromium | 真实 Chrome | 需要启动浏览器，5s+ 启动时间 |
| **iv8** | **C++ V8 + 原生 API** | **C++ 层实现 = 无差异 = code=0** |
