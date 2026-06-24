# 兰州交通大学招标信息获取

## 目标

从 https://zbzx.lzjtu.edu.cn/zbxx/hwl.htm 获取招标信息。

## 反爬类型

瑞数 6 代（RS6）— 签名型 JSVMP

## 架构

```
main.py (Python 主控)
  ├── 调用 generate_cookies.js (Node.js sdenv 子进程)
  │     └── sdenv jsdom → RS JSVMP 执行 → 生成 Cookie
  ├── requests → 协议请求（携带 Cookie）
  ├── BeautifulSoup → 解析招标列表
  └── JSON 输出

仅 Cookie 生成依赖 Node.js（sdenv C++ V8 Addon 不可替代），
数据爬取全在 Python 侧完成。
```

## 运行

```bash
npm install        # 安装 sdenv（仅一次）
uv sync            # Python 依赖（requests, beautifulsoup4）

python main.py hwl     # 货物类（默认）
python main.py gcl     # 工程类
python main.py fwl     # 服务类
python main.py all     # 全部三类
```

## 输出

- `货物类.json` — `{ category, items: [{ title, url, date }], total }`

## 文件

| 文件 | 语言 | 作用 |
|------|------|------|
| `main.py` | Python | 主控：调用 Cookie 生成、HTTP 爬取、解析、存储 |
| `generate_cookies.js` | Node.js | 仅 RS Cookie 生成（sdenv 原生模块） |
| `main.js` | Node.js | 参考实现（纯 JS 版本，含 cheerio 解析） |
