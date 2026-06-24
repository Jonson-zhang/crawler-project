#!/usr/bin/env node
/**
 * sign.js — 小红书签名桥
 * 用 headless 浏览器加载安全 SDK，拦截 XHR 提取签名
 *
 * 用法: echo '{"url":"...","method":"POST","body":{"cursor_score":"","num":20,...}}' | node sign.js
 */
"use strict";

const { launch } = require("cloakbrowser");

let _browser = null;
let _page = null;
let _initialized = false;

// ── 初始化浏览器 + SDK ─────────────────────────────────────────
async function init() {
  if (_initialized) return;

  _browser = launch({ headless: true });
  _page = await _browser.newPage();

  await _page.goto("https://www.xiaohongshu.com/explore", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  // 等 SDK 加载
  await sleep(5000);

  // 关闭登录弹窗
  try {
    await _page.evaluate("document.querySelector('.close-button')?.click()");
  } catch (e) {}

  // 滚动让 homefeed 请求触发（确保 SDK 完全初始化）
  for (let i = 0; i < 3; i++) {
    await _page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await sleep(1500);
  }

  _initialized = true;
}

// ── 通过浏览器 XHR 获取签名 ──────────────────────────────────
async function sign(req) {
  await init();

  const url = req.url || "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed";
  const method = req.method || "POST";
  const body = req.body ? JSON.stringify(req.body) : "{}";

  // 在浏览器中发起 XHR，让 SDK 自动签名，然后截获请求头
  const result = await _page.evaluate(
    ({ url, method, body }) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const captured = {};

        // Hook setRequestHeader 在 SDK 包装之前/之后都记录
        xhr.open(method, url, true);

        // 第二次 hook: 在 SDK 的拦截器之后（SDK 会先调用 setRequestHeader）
        const origSetRH = xhr.setRequestHeader;
        xhr.setRequestHeader = function (key, value) {
          captured[key] = value;
          return origSetRH.call(this, key, value);
        };

        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            resolve({
              status: xhr.status,
              headers: captured,
              hasData: xhr.responseText.length > 0,
            });
          }
        };

        xhr.onerror = function () {
          resolve({ error: "xhr failed", headers: captured });
        };

        xhr.send(body);
      });
    },
    { url, method, body }
  );

  return result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── CLI I/O ───────────────────────────────────────────────────
async function run(req) {
  try {
    const r = await sign(req);
    process.stdout.write(JSON.stringify(r));
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: e.message }));
  }
  process.exit(0);
}

if (!process.stdin.isTTY) {
  let d = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (c) => (d += c));
  process.stdin.on("end", () => {
    try {
      run(JSON.parse(d));
    } catch (e) {
      run({});
    }
  });
  setTimeout(() => run({}), 10000);
} else {
  run({ url: process.argv[2] || "", method: process.argv[3] || "POST" });
}
