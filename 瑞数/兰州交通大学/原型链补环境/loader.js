/************************************************************
 * RS6 加载器 — 兰州交通大学 (zbzx.lzjtu.edu.cn)
 *
 * 职责：
 *   1. 加载补环境框架 (env_framework.js)
 *   2. 注入站点专属变量 (meta_content, JS 代码)
 *   3. 加载 RS VM 执行生成 Cookie
 *   4. 导出 get_cookie() 供 Python 调用
 *
 * Python 侧通过字符串替换注入：
 *   __METACONTENT__  → 从 412 页面提取的 meta content
 *   __INLINE_CODE__  → 412 页面中的内联 JS（$_ts 初始化）
 *   __EXTERNAL_CODE__ → 外链 RS VM JS 文件内容
 *   __ENTRY_CALL__   → 入口函数调用（如 _$g6()）
 ************************************************************/

// ═══ Step 1：加载补环境框架 ═══
require("./env_framework");

// ═══ Step 2：注入站点专属变量 ═══

// meta content — RS6 核心：getElementsByTagName("META") 需要返回这个
globalThis.__metacontent = "__METACONTENT__";

// ═══ Step 3：屏蔽定时器（防止 RS 用定时器做反调试） ═══
globalThis.setTimeout = function () { return 0; };
globalThis.setInterval = function () { return 0; };
globalThis.clearTimeout = function () {};
globalThis.clearInterval = function () {};

// ═══ Step 4：加载站点 RS VM 代码 ═══

// 4.1 执行内联 JS（初始化 $_ts 全局变量）
__INLINE_CODE__

// 4.2 执行外链 RS JS（VM 解释器主体，230KB+）
__EXTERNAL_CODE__

// 4.3 调用入口函数（触发 Cookie 生成）
__ENTRY_CALL__

// ═══ Step 5：导出接口 ═══
function get_cookie() {
    return document.cookie;
}

function get_debug_info() {
    return {
        variable: globalThis.__metacontent,
        dom_content: document.getElementsByTagName("META").item(0).getAttribute("content"),
        cookie_length: String(document.cookie).length,
    };
}
