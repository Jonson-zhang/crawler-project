# 小红书离线签名 — 状态报告

## 架构

```
Python (main.py)
  → subprocess: node sign.js <url> <body_json>
    → env.dom.js (原型链补环境)
    → vendor.js (webpack bundle, ~1.36MB)
      ├── 模块 68274: signV2Init() → eval(VMP字节码) → 创建 mnsv2
      └── 模块 40055: seccore_signv2(url, body) → MD5 + mnsv2 + 自定义Base64
    → sign() → stdout JSON {x-s, x-t}
  → HTTP 请求 → 解析展示
```

## ✅ 已完成

| 项目 | 状态 | 详情 |
|------|------|------|
| 目录清理 | ✅ | 58 → 6 个文件 |
| vendor.js 加载 | ✅ | Node.js VM 中 14ms 完成 |
| env.dom.js 原型链 | ✅ | EventTarget→Node→Element→HTMLElement，constructor.name 正确 |
| webpack runtime | ✅ | 拦截 chunk push，注册 300+ 模块 |
| signV2Init | ✅ | 成功运行，eval 创建 VMP 函数 |
| MD5 哈希 | ✅ | Node crypto |
| 自定义 Base64 | ✅ | 字母表 `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5` |
| Python↔Node 桥接 | ✅ | subprocess 调用，JSON 传参 |
| x-s payload 结构 | ✅ | `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:<mnsv2结果>, x4:"object"}` |

## ❌ 剩余问题

### mnsv2 哈希函数无法在 Node.js VM 中创建

**根因**: `signV2Init()` 的 eval 代码创建了 VMP 字节码运行器 `_AUuXfEG27Xa3x`，但 VMP 字节码需要完整浏览器环境才能初始化并生成真正的 mnsv2 哈希函数。在 Node.js VM 中，字节码运行到一半访问 `undefined` 属性时静默失败。

**症状**: 调用 `_AUuXfEG27Xa3x(combined, hashCombined, hashUrl)` 抛出 `err:d93135`（第一个参数必须是 VMP 字节码，不是 URL 字符串）。

**影响**: seccore_signv2 其他部分（MD5、自定义Base64、payload 组装）均已就绪，但因为 mnsv2 结果不正确，服务端返回 406。

### 文件清单

```
小红书/
├── VM_STATUS.md    # 本文档
├── main.py         # Python 入口（subprocess 调 sign.js）
├── sign.js         # Node.js 签名（加载 vendor.js + 签名逻辑）
├── env.dom.js      # 浏览器原型链补环境
└── data/
    ├── vendor.js   # 完整 webpack bundle（含 seccore_signv2 + signV2Init）
    └── cookies.json # 手动刷新的 cookie
```

## 下一步

**打通 VMP 字节码初始化链路** — 需要让 signV2Init eval 创建的字节码解释器能完整初始化并生成 mnsv2 哈希函数。可能的路径：
1. 增强 env.dom.js（添加更多 Canvas/WebGL/Crypto API 细节）
2. 用 Proxy 追踪 VMP 字节码访问了哪些缺失属性，精确补全
3. 在浏览器中运行一次 VMP 并用 Proxy 录制 mnsv2 的输入/输出对（如果 mnsv2 是纯函数，录制足够样本后可在 Node.js 中查表）
