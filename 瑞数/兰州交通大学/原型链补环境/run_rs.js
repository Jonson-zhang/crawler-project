/**
 * RS6 执行入口 — 供 Python subprocess 调用
 *
 * Python 写好 _loader_assembled.js 后，用 node 直接执行本脚本。
 * 输出: cookie 字符串到 stdout
 */
const path = require("path");

// 加载 Python 组装好的完整 loader
require(path.join(__dirname, "_loader_assembled.js"));

// 输出 Cookie（Node.js stdout 用 UTF-8，无编码问题）
const cookie = document.cookie;
process.stdout.write(cookie || "");
process.exit(0);
