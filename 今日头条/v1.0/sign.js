/**
 * sign.js — 今日头条 /api/pc/list/feed 签名生成
 *
 * 加载 toutiao SDK (acrawler + sdk-glue + bdms) 通过 env_patch 补环境，
 * SDK 拦截 fetch 调用并自动附加 a_bogus + msToken。
 *
 * 用法:
 *   node sign.js '/api/pc/list/feed?channel_id=3189398972&...'
 *
 * 输出: JSON { a_bogus: "...", msToken: "...", url: "..." }
 */

"use strict";

// ── 保存原生引用 ─────────────────────────────────────────
const _process = process;
const _require = require;
const _vm = _require("vm");
const _fs = _require("fs");
const _path = _require("path");
const _https = _require("https");
const __dir = __dirname;

// ── Helper: eval in global scope (works around strict mode eval isolation) ──
function globalEval(codeStr) {
  _vm.runInThisContext(codeStr);
}

// ═══════════════════════════════════════════════════════════════
// 1. 加载环境补丁
// ═══════════════════════════════════════════════════════════════
_require("./env_site");

// ═══════════════════════════════════════════════════════════════
// 2. 替换 fetch 为真正的 Node.js HTTP 实现
//    （env_patch 的 stub fetch 无法发网络请求，SDK 会拦截+包装它）
// ═══════════════════════════════════════════════════════════════
function realFetch(url, init) {
  init = init || {};
  const method = init.method || "GET";
  const headers = init.headers || {};

  // Parse URL
  let fullUrl;
  if (url.startsWith("http")) {
    fullUrl = url;
  } else {
    fullUrl = url;
  }

  return new Promise((resolve, reject) => {
    const u = new URL(fullUrl);
    const options = {
      hostname: u.hostname,
      port: u.protocol === "https:" ? 443 : 80,
      path: u.pathname + u.search,
      method: method,
      headers: Object.assign({}, headers),
    };

    const req = _https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: res.headers,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data)),
          body: data,
        });
      });
    });
    req.on("error", (e) => reject(e));
    if (init.body) req.write(init.body);
    req.end();
  });
}

// Replace the stub fetch with real implementation
// (SDK already wrapped fetch by now, but the original is stubbed)
// We need to find the original fetch reference used by the SDK
const _origFetch = global.fetch;
global._realFetchOrig = realFetch;

// ═══════════════════════════════════════════════════════════════
// 3. 加载头条 SDK
// ═══════════════════════════════════════════════════════════════

// Browser load order:
//   acrawler.js → init → sdk-glue.js → _SdkGlueInit() → bdms.js → runtime_bundler.js

console.log("[sign] Loading acrawler...");
globalEval(_fs.readFileSync(_path.join(__dir, "acrawler.js"), "utf-8"));

console.log("[sign] Initializing acrawler...");
window.byted_acrawler.init({ aid: 24, dfp: true });

console.log("[sign] Loading sdk-glue...");
globalEval(_fs.readFileSync(_path.join(__dir, "sdk-glue.js"), "utf-8"));

console.log("[sign] Loading bdms...");
globalEval(_fs.readFileSync(_path.join(__dir, "bdms.js"), "utf-8"));

console.log("[sign] Initializing bdms pipeline...");
window._SdkGlueInit({
  self: { aid: 24, pageId: 6457 },
  bdms: {
    aid: 24,
    pageId: 6457,
    paths: ["/api/pc/list/feed", "/api/pc/list/user/feed"],
  },
});

console.log("[sign] Loading runtime_bundler...");
globalEval(_fs.readFileSync(_path.join(__dir, "runtime_bundler.js"), "utf-8"));

// ═══════════════════════════════════════════════════════════════
// 4. Hook: 拦截 fetch URL 构建，提取 a_bogus + msToken
// ═══════════════════════════════════════════════════════════════

// The bdms SDK modifies the URL before sending the request.
// We hook into the URL construction to capture the augmented URL.

let _capturedA_bogus = null;
let _capturedMsToken = null;
let _capturedFullUrl = null;

// Override the real fetch to intercept the URL that the SDK constructed
// The SDK will call this with the augmented URL
function _interceptFetch(url, init) {
  if (typeof url === "string") {
    const bMatch = url.match(/[?&]a_bogus=([^&]+)/);
    const mMatch = url.match(/[?&]msToken=([^&]+)/);
    if (bMatch) _capturedA_bogus = decodeURIComponent(bMatch[1]);
    if (mMatch) _capturedMsToken = decodeURIComponent(mMatch[1]);
    if (bMatch || mMatch) _capturedFullUrl = url;
  }

  // Don't actually make the HTTP request — just return the captured params
  return Promise.resolve({
    status: 200,
    ok: true,
    headers: { "content-type": "application/json" },
    text: () => Promise.resolve("{}"),
    json: () => Promise.resolve({}),
    body: "{}",
  });
}

// Replace global.fetch with our interceptor
global.fetch = _interceptFetch;

// Also patch the fetch stored in SDKRuntime
if (window.SDKRuntime) {
  window.SDKRuntime.fetch = _interceptFetch;
}

// ═══════════════════════════════════════════════════════════════
// 5. 主函数 — 触发 SDK 签名
// ═══════════════════════════════════════════════════════════════

function sign(apiPath) {
  // Reset captures
  _capturedA_bogus = null;
  _capturedMsToken = null;
  _capturedFullUrl = null;

  const baseUrl = "https://www.toutiao.com";
  const fullUrl = baseUrl + apiPath;

  // Trigger the SDK by making a fetch call to the target URL
  // The SDK hooks will intercept this and modify the URL
  try {
    // Use the ORIGINAL fetch reference that the SDK wrapped
    // (the SDK hooks into fetch before we replaced it with _interceptFetch)
    // Actually, the SDK wraps fetch when _SdkGlueInit is called.
    // So the chain is:
    //   global.fetch (our _interceptFetch)
    //     → SDK's original wrapped fetch (which calls the stubbed fetch)
    //
    // The SDK wraps fetch at _SdkGlueInit time. But we replaced fetch AFTER init.
    // Let me check if we need to re-trigger the SDK's fetch wrapping...

    // Actually, let me just trigger the API call and see what happens
    const promise = global.fetch(fullUrl, {
      method: "GET",
      headers: {},
    });

    // If it's a Promise (from our interceptor), wait for it
    if (promise && typeof promise.then === "function") {
      promise.then(() => {}).catch(() => {});
    }
  } catch (e) {
    // Ignore
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. 命令行入口
// ═══════════════════════════════════════════════════════════════

function main() {
  const apiPath =
    _process.argv[2] ||
    "/api/pc/list/feed?channel_id=3189398972&max_behot_time=0&category=pc_profile_channel&aid=24&app_name=toutiao_web";

  sign(apiPath);

  // Small delay to let async operations complete (SDK might have microtasks)
  setTimeout(() => {
    const result = {
      a_bogus: _capturedA_bogus,
      msToken: _capturedMsToken,
      captured_url: _capturedFullUrl,
    };

    _process.stdout.write(JSON.stringify(result) + "\n");

    if (!_capturedA_bogus) {
      _process.stderr.write(
        "[sign] WARNING: a_bogus not captured. SDK interception may not be working.\n",
      );
      _process.stderr.write(
        "[sign] Try: DEBUG_PROXY=true node sign.js to see what properties the SDK accesses.\n",
      );
    }

    _process.exit(0);
  }, 3000);
}

main();
