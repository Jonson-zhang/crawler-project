/**
 * sign.js — mns0301 离线签名（常驻进程模式）
 *
 * 命令行模式: node sign.js <api_path> '<json_body>'
 *   输出一行 JSON → 退出（兼容旧用法）
 *
 * 常驻模式: node sign.js --daemon
 *   每行 stdin 读入 JSON {"path":"...", "body":{...}}
 *   每行 stdout 输出 JSON {"X-s":"...", "X-t":"...", "X-s-common":"..."}
 *   stdin EOF 时退出
 */

"use strict";
// 保存原生引用（env_patch 会隐藏 process/require/module/__dirname）
const _process = process, _require = require, __dir = __dirname;
const fs = _require("fs"), path = _require("path"), CryptoJS = _require("crypto-js");

// 静默加载
const _s = _process.stdout.write.bind(_process.stdout);
_process.stdout.write = () => true;

_require("./env_site");   // env_patch 底座 + watch(window)
_require("./ds_script");
global.MutationObserver = function () { this.observe = function () {}; this.disconnect = function () {}; };

eval(fs.readFileSync(path.join(__dir, "data", "ds_api.js"), "utf8"));

// 动态发现 VMP 解释器 → 设 setter 拦截 → 加载 ds_v2 升级 mns0201 → mns0301
//
// 策略：不硬编码 _AUuXfEG27Xa3x（混淆器每次可能生成不同变量名）。
// ds_script.js 加载后，扫描 global 上 toString().length > 100K 的函数 —
// VMP 解释器内嵌大量字节码，函数体远超普通混淆函数，此特征精准唯一。
// 拦截所有候选者的 setter，等 ds_v2.js 覆盖时自动包装 env slot 预填充。
(function () {
  var _vmpFound = 0;
  Object.getOwnPropertyNames(global).forEach(function (name) {
    try {
      var val = global[name];
      if (typeof val !== "function" || val.toString().length <= 100000) return;

      _vmpFound++;
      var _ra, _oa = val;
      Object.defineProperty(global, name, {
        get: function () { return _ra || _oa; },
        set: function (fn) {
          // ds_v2.js 覆盖时触发：识别升级函数（同样是 >100K 的巨型函数）
          if (typeof fn === "function" && fn.toString().length > 100000) {
            _ra = function (bc, env) {
              // 预填充 env 数组所有空 slot 为可构造的空函数
              for (var i = 0; i < 200; i++) {
                if (env[i] === undefined) {
                  var s = function () {};
                  s.prototype = {};
                  env[i] = s;
                }
              }
              return fn.call(window, bc, env);
            };
          } else {
            // 非 VMP 函数赋值 → 透传原始值（兼容 ds_script 内部的重赋值）
            _oa = fn;
          }
        },
        configurable: true, enumerable: true,
      });
    } catch (e) {}
  });

  if (_vmpFound === 0) {
    console.error("⚠ 未发现 VMP 解释器候选 (toString().length > 100K)，setter 拦截未生效");
  }
})();

eval(fs.readFileSync(path.join(__dir, "data", "ds_v2.js"), "utf8"));

_process.stdout.write = _s;

if (typeof window.mnsv2 !== "function") { console.error("mnsv2 不存在"); _process.exit(1); }

// 编码函数
const U = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5".split("");
function b64Encode(e) {
  const n = e.length, m = n % 3, r = [];
  for (var i = 0, P = n - m; i < P; i += 16383) { var end = Math.min(i + 16383, P); for (var j = i; j < end; j += 3) { var t = (e[j] << 16) + (e[j + 1] << 8) + e[j + 2]; r.push(U[(t >> 18) & 63] + U[(t >> 12) & 63] + U[(t >> 6) & 63] + U[t & 63]); } }
  if (m === 1) { var b = e[n - 1]; r.push(U[b >> 2] + U[(b << 4) & 63] + "=="); } else if (m === 2) { var p = (e[n - 2] << 8) + e[n - 1]; r.push(U[p >> 10] + U[(p >> 4) & 63] + U[(p << 2) & 63] + "="); }
  return r.join("");
}
function encodeUtf8(s) {
  var e = encodeURIComponent(s), b = [];
  for (var i = 0; i < e.length; i++) { if (e[i] === "%") { b.push(parseInt(e[i + 1] + e[i + 2], 16)); i += 2; } else { b.push(e.charCodeAt(i)); } }
  return b;
}

// 核心签名
function seccore_signv2(url, body) {
  var c = url + JSON.stringify(body);
  var h = window.mnsv2(c, CryptoJS.MD5(c).toString(), CryptoJS.MD5(url).toString());
  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({ x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows", x3: h, x4: body ? "object" : "" })));
}

// ===== 常驻模式 =====
function daemonLoop() {
  var buf = "";
  _process.stdin.setEncoding("utf8");
  _process.stdin.on("data", function (chunk) {
    buf += chunk;
    var lines = buf.split("\n");
    buf = lines.pop(); // 最后一段可能不完整
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        var req = JSON.parse(line);
        var api = req.path || "/api/sns/web/v1/homefeed";
        var body = req.body || null;
        var xs = seccore_signv2(api, body);
        var xt = String(Date.now());
        var xsc = b64Encode(encodeUtf8(JSON.stringify({ a1: "", x1: "4.3.5", x2: api, x3: "xhs-pc-web", x4: CryptoJS.MD5(api).toString() })));
        _process.stdout.write(JSON.stringify({ "X-s": xs, "X-t": xt, "X-s-common": xsc }) + "\n");
      } catch (e) {
        _process.stdout.write(JSON.stringify({ error: e.message }) + "\n");
      }
    }
  });
  _process.stdin.on("end", function () { _process.exit(0); });
  _process.stdin.resume();
}

// ===== 入口 =====
if (_process.argv[2] === "--daemon") {
  daemonLoop();
} else {
  // 单次调用模式（兼容旧用法）
  var API = _process.argv[2] || "/api/sns/web/v1/homefeed";
  var arg = _process.argv[3];
  if (!arg) { console.error("用法: node sign.js <api_path> '<json_body>'"); _process.exit(1); }
  var bodyObj;
  try { bodyObj = JSON.parse(arg); } catch (e) { console.error("body 不是有效 JSON"); _process.exit(1); }
  var xs = seccore_signv2(API, bodyObj), xt = String(Date.now());
  var xsc = b64Encode(encodeUtf8(JSON.stringify({ a1: "", x1: "4.3.5", x2: API, x3: "xhs-pc-web", x4: CryptoJS.MD5(API).toString() })));
  _process.stdout.write(JSON.stringify({ "X-s": xs, "X-t": xt, "X-s-common": xsc }) + "\n");
}
