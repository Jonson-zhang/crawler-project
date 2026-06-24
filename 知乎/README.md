# 知乎 API 逆向

PC 端知乎 API 调用链路：登录 → x-zse 签名 → 爬虫。

## 文件结构

```
知乎/
├── main.py          Python 入口：登录 + Cookie 管理 + 爬取命令
├── sign.js          Node 签名入口：接收 stdin JSON，输出签名头
├── env.js           补环境模块：vm 沙箱定义 + 加载知乎 webpack chunk
├── runtime.js       知乎 webpack runtime（浏览器提取，17KB）
├── vendor.js        知乎 vendor chunk（浏览器提取，215KB）
├── 479.js           签名模块所在 chunk（浏览器提取，3.4MB）
└── cookies.json     Cookie 缓存（自动生成，gitignore）
```

## 架构

```
main.py (Python)                              sign.js (Node)
─────────────                                ──────────────
ensure_login()  ← Cookie 检查/弹窗登录         require("./env")  ← 补环境
ZhihuAPI._sign()                              sign(url, d_c0)    ← 签名
  └─ subprocess ["node","sign.js"]              └─ x-zse-96 / x-zst-81
       stdin ← {"url":"...","d_c0":"..."}                │
       stdout → {"x-zse-96":"...","x-zst-81":"..."}  ←──┘
requests.get() → 知乎 API
```

## 用法

```bash
# 获取推荐流（自动检查/弹窗登录）
python main.py feed

# 获取 3 页
python main.py feed --pages 3

# 用户信息
python main.py me

# 无参数默认 = feed 1 页
python main.py
```

Cookie 自动管理：首次弹 Camoufox 浏览器手工登录 → 保存 `cookies.json` → 后续启动自动验证有效性 → 失效则重新弹窗。

## 签名原理

知乎 PC 端 API 需要两个签名头：

| Header | 格式 | 来源 |
|--------|------|------|
| `x-zse-96` | `2.0_{sig}` | webpack module 93823.nT |
| `x-zst-81` | `3_2.0{prefix}_{sig}` | 同上，固定前缀 |

流程：`mR(url)` 编码 → `"101_3_3.0" + encUrl + d_c0` 拼接 → `nT(src).encrypt(src)` 加密 → 兜底 MD5。

关键 webpack 模块：

| 模块 ID | 变量 | 用途 |
|---------|------|------|
| 93823 | `nT` | 签名工厂 → `{ encrypt, version }` |
| 18543 | `mR` | URL 编码器 |
| 常量 | `zse93` | `"101_3_3.0"` |

## 补环境

知乎 chunk 对浏览器 API 依赖浅，`env.js` 用 Node.js `vm` 模块 + 几十行 stub 即可：

| 对象 | 补的程度 | 备注 |
|------|---------|------|
| `location` | 完整字段 | chunk 读 `href`/`host` |
| `document` | 空 stub | 不实际操作 DOM |
| `navigator` | 基础字段 | `userAgent`/`webdriver` |
| `crypto.webcrypto` | 完整 | `getRandomValues` 被调用 |
| `window`/`self` | 循环引用 | `window === self === s` |
| `XMLHttpRequest`/`fetch` | 空实现 | 仅占位 |

runtime.js 注入点：

```js
// 在 chunk 加载前替换，将 webpack 加载器 p 暴露到 globalThis.__wp
rt.replace(
  /u\.push=s\.bind\(null,u\.push\.bind\(u\)\)\}/,
  "u.push=s.bind(null,u.push.bind(u));globalThis.__wp=p}"
);
```

## 手动测试签名

```bash
echo '{"url":"/api/v4/me","d_c0":"xxx"}' | node sign.js
# → {"x-zse-96":"2.0_...","x-zst-81":"3_2.0..._..."}
```

## 依赖

```bash
uv add requests DrissionPage urllib3
node --version  # >= 20
```

## 注意事项

- `runtime.js`/`vendor.js`/`479.js` 从浏览器 Sources 提取，知乎发版后可能需更新
- `cookies.json` 含个人凭证，已被 `.gitignore` 排除
- Cookie 关键字段：`z_c0`（登录凭证）+ `d_c0`（签名参数）
