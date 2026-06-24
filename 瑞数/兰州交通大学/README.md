# 兰州交通大学招标信息获取

## 架构

```
兰州交通大学/
├── cookie_gen/
│   └── generate.js    ← 第 1 层：sdenv 生成 RS6 Cookie（Node.js）
│
├── main.py            ← 第 2 层：Python 主控
│                         ① 调用 generate.js → 获取 Cookie
│                         ② requests 协议请求
│                         ③ BeautifulSoup 解析
│                         ④ 输出 JSON
│
├── package.json       ← Node.js 依赖声明（sdenv）
│
└── 原型链补环境/       ← 备用方案：手动原型链补环境
    ├── env_framework.js   通用浏览器环境框架
    ├── loader.js          站点加载器
    ├── run_rs.js          Node.js 入口
    └── main.py            Python 主控
```

## 运行

```bash
npm install           # 仅第一次
pip install requests beautifulsoup4
python main.py
```

## 原理

```
GET /zbxx/hwl.htm
  → HTTP 412 + Set-Cookie(keyS) + $_ts 配置 + RS VM JS
  → sdenv (C++ V8 Addon) 伪造 Chrome 环境
  → RS VM 在 sdenv 中执行 → 写入 Cookie P
  → Python 提取 Cookie → 协议请求 → 解析招标列表
```

## 换站点只需改

`main.py` 顶部 4 行配置：
```python
HOST       = "目标域名"
ENTRY_PATH = "/目标路径"
UA         = "真实浏览器 UA"
```
