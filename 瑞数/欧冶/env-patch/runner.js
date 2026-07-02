#!/usr/bin/env node
/**
 * runner.js — 欧冶 RS6 补环境执行器
 * ====================================
 *
 * 纯手动补环境方案：不使用 sdenv、iv8 或任何自动化浏览器工具。
 * 基于 .claude/env-patch/env_patch.js 构建浏览器环境补丁，
 * 在 Node.js 中模拟浏览器 API，执行 RS6 VM 代码生成 Cookie。
 *
 * ⚠️ 核心假设：RS6 挑战页面返回的 inline JS + external JS 在补丁
 *    环境中可以同步执行完毕（while(1) 字节码循环必须在超时前退出）。
 *
 * 用法:
 *   node runner.js                            # 静默执行
 *   DEBUG_PROXY=true node runner.js           # 调试模式，输出属性访问日志
 *
 * 输出:
 *   stdout: cookie_string（只输出 cookie，方便管道）
 *   stderr: 执行日志和诊断信息
 *
 * 环境变量:
 *   DEBUG_PROXY=true    — 启用 Proxy 属性访问监控
 *   RS6_TIMEOUT=60000   — RS6 VM 超时毫秒（默认 30000）
 */

// ═══════════════════════════════════════════════════════════════
// 0. 前置：保存 Node.js 原生引用（env_patch 在 windowToGlobal 模式下
//    会隐藏 process/require 等，避免 RS6 识别 Node.js 特征）
// ═══════════════════════════════════════════════════════════════
var REAL_PROCESS   = process;
var REAL_REQUIRE   = require;
var REAL_SET_TIMEOUT = setTimeout;
var REAL_CONSOLE   = console;
var REAL_BUFFER    = Buffer;

// ═══════════════════════════════════════════════════════════════
// 1. HTTPS 请求工具
// ═══════════════════════════════════════════════════════════════
var HTTPS = REAL_REQUIRE('https');
var URL  = REAL_REQUIRE('url');

/**
 * HTTPS GET 请求，返回 { status, headers, body }
 */
function httpsGet(url, cookieStr) {
  return new Promise(function (resolve, reject) {
    var opts = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/143.0.0.0 Safari/537.36',
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
      rejectUnauthorized: false,
      timeout: 15000,
    };
    if (cookieStr) opts.headers['Cookie'] = cookieStr;

    HTTPS.get(url, opts, function (res) {
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        resolve({
          status:     res.statusCode,
          headers:    res.headers,
          body:       body,
        });
      });
    }).on('error', reject)
      .on('timeout', function () { reject(new Error('HTTPS 请求超时')); });
  });
}

/**
 * HTTPS GET 同步包装（用于下载外部 JS 等场景）
 */
async function httpsGetBody(url, cookieStr) {
  var resp = await httpsGet(url, cookieStr);
  return resp.body;
}

// ═══════════════════════════════════════════════════════════════
// 2. HTML 解析工具
// ═══════════════════════════════════════════════════════════════

/**
 * 提取 RS6 挑战，保持脚本的 HTML 出现顺序。
 *
 * 返回:
 *   scripts: 有序数组，每项为 { type: 'inline', code: str } 或
 *            { type: 'external', url: str }
 *   metaContent: <meta content="..."> 最后一条
 *
 * ⚠️ 必须保持顺序！浏览器顺序执行 <script> 标签。
 *    外链 JS 可能定义函数，供后面的内联脚本调用。
 */
function extractRS6Challenge(html) {
  // 提取 meta content（取最后一个 meta content）
  var metaMatch, metaContent = '';
  var metaRe = /<meta[^>]+content=["']([^"']+)["']/gi;
  while ((metaMatch = metaRe.exec(html)) !== null) {
    metaContent = metaMatch[1];
  }

  // 顺序扫描 <script> 标签，保持出现顺序
  var scripts = [];
  // 正则匹配所有 <script> 标签（含 src 外链和 inline）
  var scriptRe = /<script\s*([^>]*)>([\s\S]*?)<\/script>/gi;
  var m;

  while ((m = scriptRe.exec(html)) !== null) {
    var attrs = m[1] || '';
    var content = (m[2] || '').trim();

    // 检查是否有 src 属性（外链 JS）
    var srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      // 外链 JS
      var url = srcMatch[1].trim();
      // 相对路径转绝对路径
      if (!url.startsWith('http')) {
        if (url.startsWith('/')) {
          url = 'https://www.ouyeel.com' + url;
        } else {
          url = 'https://www.ouyeel.com/' + url;
        }
      }
      scripts.push({ type: 'external', url: url });
    } else if (content) {
      // 内联脚本（有内容）
      scripts.push({ type: 'inline', code: content });
    }
    // 跳过空内容的内联脚本
  }

  return {
    metaContent: metaContent,
    scripts: scripts,
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. RS6 环境设置与执行
// ═══════════════════════════════════════════════════════════════

/**
 * 设置 RS6 执行环境并运行。
 *
 * 此函数在所有 HTTP 请求完成（获取了页面和外链 JS）后执行。
 * 此时 process/module/require 等已被隐藏，RS6 不会检测到 Node.js。
 */
function executeRS6(challenge, initialCookies) {
  // ── 3a. 加载 env_patch 环境（此时 process 等已被隐藏） ──
  REAL_REQUIRE('./env_site');

  // ⚠️ 注意：require('./env_site') 调用 setupEnv 时，
  //   windowToGlobal: true 会将以下全局变量设为 undefined：
  //     process, require, module, __dirname, __filename
  //   这是有意为之：RS6 通过这些特征检测 Node.js。
  //   我们在 Phase 0 已保存了引用（REAL_PROCESS 等）。

  // ── 3b. 导入 sn 函数（用于包装自定义函数为 native code） ──
  //    env_patch 的 Function.prototype.toString 已被覆盖，
  //    通过 sn() 注册的函数 toString() 会返回 [native code]。
  var sn = REAL_REQUIRE('../../../.claude/env-patch/env_patch.js').sn;

  // ── 3c. 设置初始 Cookie ──
  //    来自首次 HTTP 响应的 Set-Cookie（如有）
  if (initialCookies) {
    document.cookie = initialCookies;
  }

  // ── 3d. 设置 meta content 与 getElementsByTagName ──
  //
  //    RS6 通过 document.getElementsByTagName('META') 读取挑战值。
  //    env_patch 的默认实现只处理 head/body/link/style/script，
  //    不处理 meta 标签。我们需要覆盖。
  //
  //    创建一个 meta 元素对象（保存 content 属性）
  var metaContent = challenge.metaContent || '';
  var metaEl = Object.create(HTMLElement.prototype);
  Object.defineProperty(metaEl, Symbol.toStringTag, {
    value: 'HTMLMetaElement', configurable: true,
  });
  metaEl.tagName = 'META';
  metaEl.nodeName = 'META';
  metaEl._content = metaContent;

  metaEl.getAttribute = function (name) {
    if (name === 'content') return this._content;
    return null;
  };
  sn(metaEl.getAttribute, 'getAttribute');

  metaEl.setAttribute = function (name, value) {
    if (name === 'content') this._content = String(value);
  };
  sn(metaEl.setAttribute, 'setAttribute');

  // 覆盖 document.getElementsByTagName
  var origGetElementsByTagName = document.getElementsByTagName.bind(document);
  document.getElementsByTagName = function (tagName) {
    var tag = String(tagName).toUpperCase();

    // RS6 关键点：getElementsByTagName('META') 返回 meta 挑战值
    if (tag === 'META') {
      var collection = [metaEl];
      Object.defineProperty(collection, Symbol.toStringTag, {
        value: 'HTMLCollection', configurable: true,
      });
      collection.item = function (i) { return collection[i] || null; };
      sn(collection.item, 'item');
      collection.namedItem = function (name) {
        return name === 'content' ? metaEl : null;
      };
      sn(collection.namedItem, 'namedItem');
      return collection;
    }

    return origGetElementsByTagName(tagName);
  };
  sn(document.getElementsByTagName, 'getElementsByTagName');

  // ── 3e. 补 document.cookie getter（使其返回准确的 cookie 值） ──
  //    env_patch 已在 HTMLDocument.prototype 上定义了 cookie
  //    getter/setter，应可直接使用。如有问题，在此覆盖。

  // ── 3f. 替换 setTimeout/setInterval（在 RS6 入口执行前） ──
  //
  //    RS6 VM 在完成字节码解释后可能尝试 setTimeout 安排异步任务。
  //    在补环境场景中我们不需要这些异步任务，替换为 no-op
  //    防止 VM 产生非预期的行为。
  //
  //    ⚠️ 这个替换发生在 RS6 加载之后、入口点执行之前。
  //    目前阶段 RS6 代码尚未运行，所以此处不替换。
  //    替换操作在 Phase 4 中执行。

  // ── 3g. 替换 setTimeout/setInterval（在 RS6 执行前） ──
  //
  //    ⚠️ 这是关键：必须在外链 JS 执行前替换 setTimeout/setInterval。
  //    RS6 的 while(1) 字节码循环中可能调用 setTimeout，如果 setTimeout
  //    是真实的 Node.js 定时器，事件循环会在异步回调中执行 RS6 代码，
  //    导致 while(1) 循环状态混乱或永不退出。
  //
  //    替换为 no-op 后，任何 setTimeout/setInterval 调用静默失效，
  //    RS6 VM 只能走同步路径，在 while(1) 循环内完成所有字节码处理。
  global.setTimeout = function () {};
  global.setInterval = function () {};

  // ── 3h. 返回环境引用（后续执行用） ──
  return {
    sn: sn,
    metaEl: metaEl,
  };
}

// ═══════════════════════════════════════════════════════════════
// 4. 主流程
// ═══════════════════════════════════════════════════════════════

async function main() {
  REAL_CONSOLE.error('═'.repeat(54));
  REAL_CONSOLE.error('  欧冶 RS6 补环境执行器 (env-patch)');
  REAL_CONSOLE.error('═'.repeat(54));

  var vm = REAL_REQUIRE('vm');
  var TIMEOUT_MS = parseInt(REAL_PROCESS.env.RS6_TIMEOUT || '30000', 10);

  try {
    // ═══════════════════════════════════════════════════════
    // Phase 1: 请求页面
    // ═══════════════════════════════════════════════════════
    REAL_CONSOLE.error('\n[1/5] 请求 https://www.ouyeel.com/steel ...');
    var response = await httpsGet('https://www.ouyeel.com/steel');
    var html = response.body;
    REAL_CONSOLE.error('  → HTTP ' + response.status + ', ' + html.length + ' bytes');

    // 收集初始 cookies
    var initialCookies = '';
    if (response.headers['set-cookie']) {
      var cookies = Array.isArray(response.headers['set-cookie'])
        ? response.headers['set-cookie']
        : [response.headers['set-cookie']];
      initialCookies = cookies.map(function (c) {
        return c.split(';')[0];
      }).join('; ');
      if (initialCookies) {
        REAL_CONSOLE.error('  → Set-Cookie: ' + initialCookies.slice(0, 100));
      }
    }

    // 检查是否已经是正常页面（无 RS6 挑战）
    if (response.status === 200 && html.indexOf('window._ts') < 0) {
      REAL_CONSOLE.error('  → 未检测到 RS6 挑战，直接返回');
      REAL_CONSOLE.error('  → cookie (from response): ' +
        (response.headers['set-cookie'] || '(none)'));
      REAL_PROCESS.exit(0);
    }

    // ═══════════════════════════════════════════════════════
    // Phase 2: 提取 RS6 挑战
    // ═══════════════════════════════════════════════════════
    REAL_CONSOLE.error('\n[2/5] 提取 RS6 挑战参数 ...');
    var challenge = extractRS6Challenge(html);
    REAL_CONSOLE.error('  → meta content: ' +
      (challenge.metaContent || '(none)').slice(0, 50));

    // 统计脚本类型
    var inlineCount = 0, externalCount = 0;
    challenge.scripts.forEach(function (s) {
      if (s.type === 'inline') inlineCount++;
      else externalCount++;
    });
    REAL_CONSOLE.error('  → 脚本: ' + challenge.scripts.length + ' 个 (' +
      inlineCount + ' 内联, ' + externalCount + ' 外链)');

    if (challenge.scripts.length === 0) {
      throw new Error('未找到脚本，页面可能不是 RS6 挑战页');
    }

    // 列出脚本概要
    challenge.scripts.forEach(function (s, i) {
      if (s.type === 'inline') {
        REAL_CONSOLE.error('    #' + i + ' [inline] ' + s.code.length + ' bytes');
      } else {
        REAL_CONSOLE.error('    #' + i + ' [external] ' + s.url);
      }
    });

    // 检查是否需要先下载所有外链 JS（如果有的话）
    // 注：外链 JS 可能被后面的内联脚本引用，所以需要提前下载
    var externalUrls = challenge.scripts
      .filter(function (s) { return s.type === 'external'; })
      .map(function (s) { return s.url; });

    // ═══════════════════════════════════════════════════════
    // Phase 3: 下载所有外链 JS
    // ═══════════════════════════════════════════════════════
    var externalCodeMap = {};
    for (var ei = 0; ei < externalUrls.length; ei++) {
      var eurl = externalUrls[ei];
      REAL_CONSOLE.error('  → 下载外链: ' + eurl);
      externalCodeMap[eurl] = await httpsGetBody(eurl, initialCookies);
      REAL_CONSOLE.error('    → ' + externalCodeMap[eurl].length + ' bytes');
    }

    // ═══════════════════════════════════════════════════════
    // Phase 4: 设置浏览器环境 + 执行 RS6 VM
    // ═══════════════════════════════════════════════════════
    //
    // 执行顺序 = HTML 中 <script> 的出现顺序（浏览器行为）:
    //   <script>document.createElement("section")</script>
    //   <script>$_ts=...; $_ts.cd="..."</script>
    //   <script src="external.js"></script>    ← 在此位置加载执行
    //   <script>_$eB();</script>              ← 此时 _$eB 已定义
    //
    REAL_CONSOLE.error('\n[4/5] 加载浏览器环境 + 按顺序执行 RS6 脚本 ...');

    // 4a. 加载 env_patch + RS6 环境覆盖
    //     executeRS6() 内部已完成:
    //       - require('./env_site') → setupEnv
    //       - setTimeout/setInterval 替换为 noop
    //       - meta content 注入
    //       - getElementsByTagName 覆盖
    var env = executeRS6(challenge, initialCookies);

    // 4b. 按照 HTML 顺序执行脚本
    var totalBytes = 0;
    var failedCount = 0;
    var executedExternal = {};

    challenge.scripts.forEach(function (scriptItem, idx) {
      if (scriptItem.type === 'inline') {
        // 内联脚本：直接执行
        var code = scriptItem.code;
        totalBytes += code.length;
        try {
          vm.runInThisContext(code, {
            filename: 'inline_' + idx + '.js',
            timeout: TIMEOUT_MS,
            displayErrors: false,
          });
        } catch (e) {
          failedCount++;
          REAL_CONSOLE.error('    ⚠️ [inline#' + idx + '] ' + e.message.slice(0, 120));
        }
      } else if (scriptItem.type === 'external') {
        // 外链 JS：执行已下载的代码（Phase 3 已下载到 externalCodeMap）
        var eurl = scriptItem.url;
        var ecode = externalCodeMap[eurl];
        if (!ecode) {
          REAL_CONSOLE.error('    ⚠️ [external#' + idx + '] 未下载: ' + eurl);
          return;
        }
        totalBytes += ecode.length;
        REAL_CONSOLE.error('    → [external#' + idx + '] ' + eurl +
          ' (' + ecode.length + ' bytes)');
        try {
          vm.runInThisContext(ecode, {
            filename: 'external_' + idx + '.js',
            timeout: TIMEOUT_MS,
            displayErrors: false,
          });
        } catch (e) {
          failedCount++;
          REAL_CONSOLE.error('    ⚠️ [external#' + idx + '] ' + e.message.slice(0, 150));
        }
        executedExternal[eurl] = true;
      }
    });

    // 4c. 触发 load 事件（RS6 可能绑定事件处理）
    try {
      vm.runInThisContext(
        'try { window.dispatchEvent(new Event("load")); } catch(e) {}',
        { filename: 'rs6_trigger_load.js', timeout: 5000, displayErrors: false }
      );
      vm.runInThisContext(
        'try { document.dispatchEvent(new Event("DOMContentLoaded")); } catch(e) {}',
        { filename: 'rs6_trigger_dcl.js', timeout: 5000, displayErrors: false }
      );
      vm.runInThisContext(
        'try { document.dispatchEvent(new Event("readystatechange")); } catch(e) {}',
        { filename: 'rs6_trigger_rsc.js', timeout: 5000, displayErrors: false }
      );
      REAL_CONSOLE.error('  → 事件已触发');
    } catch (_) { /* ignore */ }

    REAL_CONSOLE.error('  → 已执行 ' + totalBytes + ' bytes' +
      (failedCount > 0 ? ', ' + failedCount + ' 个报错(跳过)' : ''));

    // ═══════════════════════════════════════════════════════
    // Phase 5: 提取 Cookie
    // ═══════════════════════════════════════════════════════
    REAL_CONSOLE.error('\n[5/5] 提取 Cookie ...');

    var cookie = '';
    try {
      var rawCookie = vm.runInThisContext(
        'document.cookie',
        { filename: 'rs6_getcookie.js', timeout: 5000 }
      );
      // 浏览器中 document.cookie 只返回 name=value，不包含 path/expires/Secure 等属性。
      // env_patch 的 cookie setter 直接存储原始 Set-Cookie 字符串，需要清理。
      var cleanParts = [];
      (rawCookie || '').split(';').forEach(function (part) {
        part = part.trim();
        if (!part) return;
        var eqIdx = part.indexOf('=');
        if (eqIdx < 0) return;
        var name = part.slice(0, eqIdx).trim().toLowerCase();
        // 跳过 cookie 属性名（不是真正的 cookie）
        var attrs = ['path', 'expires', 'domain', 'max-age', 'samesite', 'httponly', 'secure'];
        if (attrs.indexOf(name) >= 0) return;
        cleanParts.push(part);
      });
      cookie = cleanParts.join('; ');
    } catch (e) {
      cookie = document.cookie || '';
    }

    // 检查 cookie 是否有效
    var effectiveParts = cookie.split(';').filter(function (p) {
      return p.trim().length > 0;
    });

    if (effectiveParts.length >= 2 || cookie.length > 50) {
      REAL_CONSOLE.error('  ✅ 成功! Cookie: ' + cookie.length + ' 字节, ' +
        effectiveParts.length + ' 个键值对');
      REAL_CONSOLE.log(cookie);
      REAL_PROCESS.exit(0);
    } else if (cookie.length > 0) {
      REAL_CONSOLE.error('  ⚠️  生成了 Cookie 但可能不完整 (' +
        cookie.length + ' 字节): ' + cookie.slice(0, 100));
      REAL_CONSOLE.log(cookie);
      REAL_PROCESS.exit(0);
    } else {
      REAL_CONSOLE.error('  ❌ Cookie 为空');

      // 检查是否有 cookie 相关操作被记录
      // 尝试读取内部存储
      try {
        var track = vm.runInThisContext(
          'typeof document._cookie !== "undefined" ? document._cookie : "(none)"',
          { filename: 'rs6_debug.js', timeout: 5000 }
        );
        REAL_CONSOLE.error('  → document._cookie = ' + track);
      } catch (_) {}

      REAL_CONSOLE.error('\n💡 排查建议:');
      REAL_CONSOLE.error('   1. 用 DEBUG_PROXY=true node runner.js 查看缺失属性');
      REAL_CONSOLE.error('   2. 用 rtk curl 对比浏览器中同样的页面');
      REAL_CONSOLE.error('   3. 检查页面是否已变化（RS6 可能升级）');
      REAL_PROCESS.exit(1);
    }
  } catch (err) {
    REAL_CONSOLE.error('\n❌ 错误: ' + (err.message || err));
    if (err.stack) {
      var lines = err.stack.split('\n');
      for (var i = 0; i < Math.min(lines.length, 5); i++) {
        REAL_CONSOLE.error('  ' + lines[i]);
      }
    }
    REAL_PROCESS.exit(1);
  }
}

main();
