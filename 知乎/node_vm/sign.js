#!/usr/bin/env node
"use strict";

// ═══════════════════════════════════════════════════════════════
//  sign.js — 知乎 x-zse-96 / x-zst-81 签名
//  由 main.py 通过 subprocess 调用
//  用法: echo '{"url":"...","d_c0":"..."}' | node sign.js
// ═══════════════════════════════════════════════════════════════

const _process = process;
const crypto = require("crypto");

// ── 引入补环境（env_site.js 负责 env_patch + 加载 webpack chunk）───
const { wp } = require("./env_site");

if (!wp) {
  _process.stdout.write(JSON.stringify({ error: "init" }));
  _process.exit(1);
}

// ── 签名函数 ────────────────────────────────────────────────────
const nT = wp(93823).nT;   // factory: source → { encrypt, version }
const mR = wp(18543).mR;   // URL encoder
const zse93 = "101_3_3.0";

function sign(url, dc0) {
  // 1. URL 编码
  let encUrl;
  try {
    encUrl = mR(url);
  } catch (e) {
    encUrl = encodeURIComponent(url).replace(/%2F/g, "/");
  }

  // 2. 拼接源字符串
  const src = [zse93, encUrl, dc0 || ""].filter(Boolean).join("+");

  // 3. 加密
  const { encrypt } = nT(src);
  let sig;
  try {
    sig = encrypt(src);
  } catch (e) {}

  // 4. 兜底 MD5
  if (!sig) {
    sig = crypto.createHash("md5").update(src).digest("hex");
  }

  return {
    "x-zse-96": "2.0_" + sig,
    "x-zst-81": "3_2.0aR_sn77yn6O92wOB8hPZnQr0EMYxc4f18wNBUgpTQ6nxERFZf_" + sig,
  };
}

// ── CLI I/O ─────────────────────────────────────────────────────
function run(req) {
  const r = sign(
    req.url || req.path || "/api/v3/feed/topstory/recommend?action=down&page_number=1",
    req.d_c0 || req.dc0 || "",
  );
  _process.stdout.write(JSON.stringify(r));
  _process.exit(0);
}

if (!_process.stdin.isTTY) {
  let d = "";
  _process.stdin.setEncoding("utf-8");
  _process.stdin.on("data", c => d += c);
  _process.stdin.on("end", () => {
    try { run(JSON.parse(d)); } catch (e) { run({}); }
  });
  setTimeout(() => run({}), 5000);
} else {
  run({ url: _process.argv[2] || "", d_c0: _process.argv[3] || "" });
}
