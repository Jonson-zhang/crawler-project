# 兰州交通大学招标信息获取

## 目标

从 https://zbzx.lzjtu.edu.cn/zbxx/hwl.htm 获取招标信息（货物类/工程类/服务类）。

## 反爬类型

瑞数 6 代（RS6）— 签名型 JSVMP

### 识别特征
- 首次请求返回 HTTP 412
- 响应内含 `$_ts` 全局变量（`nsd` + `cd` 配置字符串）
- 外部 RS VM 文件 230KB+，`_$` 前缀混淆变量
- 入口函数调用 `<script>_$xx();</script>`
- Cookie: `evbSrBv8QGpBO`（服务端下发 S）+ `evbSrBv8QGpBP`（客户端生成 P/T）
- 页面使用 DWR（Direct Web Remoting）+ 网站群 CMS

### 加密链路
```
$_ts.cd 配置 → RS JSVMP VM 解释器加载
  → 采集浏览器指纹（Canvas/WebGL/UA/Screen/...）
  → Huffman 编码 → XOR → AES-128-CBC → CRC32 → AES-128-CBC → Base64
  → 写入 evbSrBv8QGpBP Cookie
  → location.reload 带 Cookie 重定向 → 200
```

## 方案

基于 [sdenv](https://github.com/pysunday/sdenv)（魔改 jsdom + C++ V8 Addon）纯 Node.js 方案。

sdenv 通过 C++ 层实现 `document.all` 的浏览器特有行为（`typeof === "undefined"` 但可调用），让 RS6 JSVMP 在 jsdom 中真实运行并生成有效 Cookie。

## 运行

```bash
npm install
node main.js hwl     # 货物类（默认）
node main.js gcl     # 工程类
node main.js fwl     # 服务类
node main.js all     # 全部三类
```

## 输出

- `货物类.json` — 结构化招标数据
- `工程类.json` — 工程类招标数据
- `服务类.json` — 服务类招标数据

每条记录：`{ title, url, date }`

## 依赖

- sdenv ^1.1.3（需 node-gyp 编译原生模块，需 Visual Studio Build Tools + Python）
- cheerio

## 技术要点

1. **sdenv 的 cookieJar 必须在 window 关闭前捕获**：`sdenv:exit` 事件触发后 cookieJar 可能变为 null
2. **DWR AJAX 加载**：列表内容不是服务端渲染的，由 DWR 框架动态加载，必须在 jsdom 中执行才能看到
3. **URL 相对路径解析**：站内链接使用 `../info/10446/xxxxx.htm` 格式，需正确 resolve
4. **sdenv 保持 event loop**：jsdom 内部定时器导致进程不退出，需 `process.exit(0)`
