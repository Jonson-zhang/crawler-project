#!/usr/bin/env node
/**
 * 测试 VM 环境——加载 env.js 后检查可用对象并尝试签名
 */
"use strict";

const path = require("path");
process.chdir(path.join(__dirname, "data"));

console.log("[*] 加载 env.js ...");
const t0 = Date.now();

const { ctx, sandbox } = require("./env");

console.log(`[+] env.js 加载完成 (${Date.now() - t0}ms)\n`);

// ── 检查沙箱中的关键对象 ──────────────────────────────
const checks = [
  "_BHjFmfUMEtxhI",
  "xsecappid",
  "xsecappvers",
  "xsecplatform",
  "anti_hp_sign_config",
  "webpackChunkxhs_pc_web",
  "__webpack_require__",
];

console.log("── 沙箱关键对象 ──");
for (const key of checks) {
  const val = sandbox[key];
  const t = typeof val;
  if (t === "undefined") {
    console.log(`  ${key}: undefined`);
  } else if (t === "function") {
    console.log(`  ${key}: function`);
  } else if (t === "object") {
    if (Array.isArray(val)) {
      console.log(`  ${key}: array[${val.length}]`);
    } else if (val === null) {
      console.log(`  ${key}: null`);
    } else {
      const keys = Object.keys(val).slice(0, 10);
      console.log(`  ${key}: object {${keys.join(", ")}${keys.length >= 10 ? ", ..." : ""}}`);
    }
  } else {
    console.log(`  ${key}: ${t} = ${String(val).slice(0, 80)}`);
  }
}

// ── 搜索签名相关属性 ────────────────────────────────────
console.log("\n── 搜索签名相关 ──");
const signKeys = Object.keys(sandbox).filter(
  (k) =>
    k.toLowerCase().includes("sign") ||
    k.toLowerCase().includes("sec") ||
    k.toLowerCase().includes("sabo") ||
    k.toLowerCase().includes("encrypt")
);
console.log(`  匹配键: [${signKeys.join(", ")}]`);

// ── 搜索全局函数（长度 1-5 的可能是签名入口） ──────────
console.log("\n── 可能的签名入口函数 ──");
const funcKeys = [];
for (const key of Object.getOwnPropertyNames(sandbox)) {
  try {
    const val = sandbox[key];
    if (typeof val === "function" && val.length >= 1 && val.length <= 5) {
      const str = val.toString();
      if (str.includes("sign") || str.includes("encrypt") || str.includes("x-s") || str.length < 200) {
        funcKeys.push({ key, length: val.length, preview: str.slice(0, 150) });
      }
    }
  } catch (e) {
    // skip
  }
}
if (funcKeys.length === 0) {
  console.log("  (无匹配)");
} else {
  for (const f of funcKeys.slice(0, 10)) {
    console.log(`  ${f.key}(${f.length}): ${f.preview}`);
  }
}

// ── 尝试调用签名 ────────────────────────────────────────
console.log("\n── 尝试签名 ──");

const testInput = {
  url: "/api/sns/web/v1/homefeed",
  method: "POST",
  body: JSON.stringify({
    cursor_score: "",
    num: 20,
    refresh_type: 1,
    note_index: 0,
    unread_begin_note_id: "",
    unread_end_note_id: "",
    unread_note_count: 0,
    category: "homefeed_recommend",
  }),
};

// 方式1: 检查 vm 上下文中是否有全局 sign 函数
const signCandidates = signKeys.filter((k) => typeof sandbox[k] === "function");
console.log(`  候选签名函数: [${signCandidates.join(", ")}]`);

// 方式2: 通过 anti_hp_sign_config 看签名配置
const config = sandbox.anti_hp_sign_config;
if (config && typeof config === "object") {
  console.log(`\n  anti_hp_sign_config 结构:`);
  const topKeys = Object.keys(config).slice(0, 15);
  for (const k of topKeys) {
    const v = config[k];
    console.log(`    ${k}: ${typeof v === "object" ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120)}`);
  }
}

// 方式3: 检查是否有 seccore_signv2
if (typeof sandbox.seccore_signv2 === "function") {
  console.log("\n  [!] 发现 seccore_signv2！");
  try {
    const result = sandbox.seccore_signv2(testInput.url, testInput.body);
    console.log(`  结果: ${JSON.stringify(result).slice(0, 200)}`);
  } catch (e) {
    console.log(`  错误: ${e.message}`);
  }
}

// 方式4: 检查 window 下的 xsec 相关
console.log("\n  xsec 系列:");
console.log(`    xsecappid = ${sandbox.xsecappid}`);
console.log(`    xsecappvers = ${sandbox.xsecappvers}`);
console.log(`    xsecplatform = ${sandbox.xsecplatform}`);

// ── 列出 anti_hp_sign_config 中的 URL 规则 ─────────────
if (config && config.signIncludesUrl) {
  console.log(`\n  signIncludesUrl (${config.signIncludesUrl.length} 条规则):`);
  for (const rule of config.signIncludesUrl.slice(0, 5)) {
    console.log(`    ${JSON.stringify(rule)}`);
  }
}

console.log("\n[OK] 测试完成");
