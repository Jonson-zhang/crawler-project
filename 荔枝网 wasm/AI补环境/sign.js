/**
 * gdtv.cn API 签名器 — Node.js subprocess
 * 用法: node --max-old-space-size=4096 sign.js GET "url" devId WEB_PC ""
 */
var fs = require("fs");

// 保存 Node.js API 引用 (WASM eval 的反篡改检测会尝试访问 process 和 global)
var _argv = process.argv;
var _stdout_write = process.stdout.write.bind(process.stdout);
var _stderr_write = process.stderr.write.bind(process.stderr);

// 绕过 WASM eval 中的反篡改检测
delete global;
delete process;

// 标记为 gdtv 合法环境
globalThis.gdtvh = 1;

// ====== 1. 浏览器环境 ======
function Window() {}
var _w = new Window();
globalThis.window = _w; globalThis.self = _w;
_w.self = _w; _w.window = _w;

Location = function Location() {};
Location.prototype = {
    ancestorOrigins: {}, href: "https://gdtv.cn/channels/2#246",
    origin: "https://gdtv.cn", protocol: "https:", host: "gdtv.cn",
    hostname: "gdtv.cn", port: "", pathname: "/channels/2", search: "", hash: "#246",
};
var _loc = new Location();
globalThis.location = _loc; _w.location = _loc;
var _doc = { location: _loc };
globalThis.document = _doc; _w.document = _doc;
globalThis.navigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
    language: "zh-CN", platform: "Win32",
};
globalThis.g = _w;

// ====== 2. wasm-bindgen 胶水代码 (精确复制自 vendor_w.js) ======

var M = new Array(128).fill(void 0);
M.push(void 0, null, !0, !1);
function i(A) { return M[A]; }
var o = M.length;
function G(A) { var g = i(A); return function (A) { A < 132 || (M[A] = o, o = A); }(A), g; }
function Y(A) { o === M.length && M.push(M.length + 1); var g = o; return o = M[g], M[g] = A, g; }
function U(A) { return null == A; }
function I(A) {
    return I = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
        ? function (A) { return typeof A; }
        : function (A) { return A && "function" == typeof Symbol && A.constructor === Symbol && A !== Symbol.prototype ? "symbol" : typeof A; },
        I(A);
}

var N = new TextDecoder("utf-8", { ignoreBOM: !0, fatal: !0 });
var J = null;
function k() { return null !== J && 0 !== J.byteLength || (J = new Uint8Array(w.memory.buffer)), J; }
function K(A, g) { return A >>>= 0, N.decode(k().subarray(A, A + g)); }

var h = 0, y = new TextEncoder("utf-8"),
    F = "function" == typeof y.encodeInto
        ? function (A, g) { return y.encodeInto(A, g); }
        : function (A, g) {
            var I = y.encode(A);
            return g.set(I), { read: A.length, written: I.length };
        };
function L(A, g, I) {
    if (void 0 === I) {
        var B = y.encode(A), Q = g(B.length, 1) >>> 0;
        return k().subarray(Q, Q + B.length).set(B), h = B.length, Q;
    }
    for (var C = A.length, E = g(C, 1) >>> 0, D = k(), w2 = 0; w2 < C; w2++) {
        var MM = A.charCodeAt(w2);
        if (MM > 127) break;
        D[E + w2] = MM;
    }
    if (w2 !== C) {
        0 !== w2 && (A = A.slice(w2)), E = I(E, C, C = w2 + 3 * A.length, 1) >>> 0;
        var i2 = k().subarray(E + w2, E + C);
        E = I(E, C, w2 += F(A, i2).written, 1) >>> 0;
    }
    return h = w2, E;
}

var c = null;
function s() { return null !== c && 0 !== c.byteLength || (c = new Int32Array(w.memory.buffer)), c; }
var H = 128;

function R(A, g) {
    try { return A.apply(this, g); }
    catch (A) { w.__wbindgen_export_3(Y(A)); }
}

// E/D: Reflect.construct 适配器 (精确复制)
function E(A, g, I) {
    return E = function () {
        if ("undefined" == typeof Reflect || !Reflect.construct) return !1;
        if (Reflect.construct.sham) return !1;
        if ("function" == typeof Proxy) return !0;
        try {
            return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function () { }))), !0;
        } catch (A) { return !1; }
    }()
        ? Reflect.construct.bind()
        : function (A, g, I) {
            var B = [null];
            B.push.apply(B, g);
            var Q = new (Function.bind.apply(A, B));
            return I && D(Q, I.prototype), Q;
        },
    E.apply(null, arguments);
}
function D(A, g) {
    return D = Object.setPrototypeOf
        ? Object.setPrototypeOf.bind()
        : function (A, g) { return A.__proto__ = g, A; },
    D(A, g);
}

// S: 构造函数工厂
function S() {
    for (var A = arguments.length, g = new Array(A), I = 0; I < A; I++) g[I] = arguments[I];
    var B = function () {
        try { return E(P, g); }
        catch (A) { return function () { return null; }; }
    }();
    return B.toString = function () { return ""; }, B;
}

var P = Function, x = eval;

// ====== 3. 导入对象工厂 t() ======
function t() {
    var g = { wbg: {} };
    g.wbg.__wbindgen_object_drop_ref = function (A) { G(A); };
    g.wbg.__wbg_self_1ff1d729e9aae938 = function () { return R(function () { return Y(self.self); }, arguments); };
    g.wbg.__wbg_window_5f4faef6c12b79ec = function () { return R(function () { return Y(window.window); }, arguments); };
    g.wbg.__wbg_globalThis_1d39714405582d3c = function () { return R(function () { return Y(globalThis.globalThis); }, arguments); };
    g.wbg.__wbg_global_651f05c6a0944d1c = function () { return R(function () { return Y(globalThis); }, arguments); };
    g.wbg.__wbindgen_is_undefined = function (A) { return void 0 === i(A); };
    g.wbg.__wbg_newnoargs_581967eacc0e2604 = function (A, g2) { return Y(S(K(A, g2))); };
    g.wbg.__wbg_call_cb65541d95d71282 = function () { return R(function (A, g2) { return Y(i(A).call(i(g2))); }, arguments); };
    g.wbg.__wbindgen_object_clone_ref = function (A) { return Y(i(A)); };
    g.wbg.__wbg_instanceof_Window_9029196b662bc42a = function (A) { var g2; try { g2 = i(A) instanceof Window; } catch (A) { g2 = !1; } return g2; };
    g.wbg.__wbg_document_f7ace2b956f30a4f = function (A) { var g2 = i(A).document; return U(g2) ? 0 : Y(g2); };
    g.wbg.__wbg_location_56243dba507f472d = function (A) { return Y(i(A).location); };
    g.wbg.__wbg_host_15090f3de0544fea = function () { return R(function (A, g2) { var I = L(i(g2).host, w.__wbindgen_export_0, w.__wbindgen_export_1), B = h; s()[A / 4 + 1] = B, s()[A / 4 + 0] = I; }, arguments); };
    g.wbg.__wbg_origin_50aa482fa6784a0a = function () { return R(function (A, g2) { var I = L(i(g2).origin, w.__wbindgen_export_0, w.__wbindgen_export_1), B = h; s()[A / 4 + 1] = B, s()[A / 4 + 0] = I; }, arguments); };
    g.wbg.__wbg_href_d62a28e4fc1ab948 = function () { return R(function (A, g2) { var I = L(i(g2).href, w.__wbindgen_export_0, w.__wbindgen_export_1), B = h; s()[A / 4 + 1] = B, s()[A / 4 + 0] = I; }, arguments); };
    g.wbg.__wbg_newwithargs_a0432b7780c1dfa1 = function (A, g2, I, B) { return Y(S(K(A, g2), K(I, B))); };
    g.wbg.__wbindgen_string_new = function (A, g2) { return Y(K(A, g2)); };
    g.wbg.__wbg_call_01734de55d61e11d = function () { return R(function (A, g2, I) { return Y(i(A).call(i(g2), i(I))); }, arguments); };
    g.wbg.__wbindgen_string_get = function (A, g2) { var I = i(g2), B = "string" == typeof I ? I : void 0, Q = U(B) ? 0 : L(B, w.__wbindgen_export_0, w.__wbindgen_export_1), C = h; s()[A / 4 + 1] = C, s()[A / 4 + 0] = Q; };
    g.wbg.__wbg_eval_8c72ad5eafe427f2 = function () { return R(function (A, g2) { return Y(x(K(A, g2))); }, arguments); };
    g.wbg.__wbindgen_typeof = function (A) { var I2 = i(A); return Y(typeof I2); };
    g.wbg.__wbindgen_boolean_get = function (A) { var g2 = i(A); return "boolean" == typeof g2 ? g2 ? 1 : 0 : 2; };
    g.wbg.__wbg_new_56693dbed0c32988 = function () { return Y(new Map); };
    g.wbg.__wbg_set_bedc3d02d0f05eb0 = function (A, g2, I) { return Y(i(A).set(i(g2), i(I))); };
    g.wbg.__wbindgen_number_new = function (A) { return Y(A); };
    g.wbg.__wbg_new0_c0be7df4b6bd481f = function () { return Y(new Date); };
    g.wbg.__wbg_getTime_5e2054f832d82ec9 = function (A) { return i(A).getTime(); };
    g.wbg.__wbg_new_cd59bfc8881f487b = function (A) { return Y(new Date(i(A))); };
    g.wbg.__wbg_getTimezoneOffset_8aee3445f323973e = function (A) { return i(A).getTimezoneOffset(); };
    g.wbg.__wbindgen_throw = function (A, g2) { throw new Error(K(A, g2)); };
    return g;
}

// ====== 4. B 命名空间 & initSync ======
var w;
var B = {};

B.a = function (A, g, I, B2, Q, C) {
    try {
        var E1 = L(A, w.__wbindgen_export_0, w.__wbindgen_export_1), D1 = h,
            i2 = L(g, w.__wbindgen_export_0, w.__wbindgen_export_1), o2 = h,
            Y2 = L(I, w.__wbindgen_export_0, w.__wbindgen_export_1), N2 = h,
            J2 = L(B2, w.__wbindgen_export_0, w.__wbindgen_export_1), k2 = h,
            K2 = L(Q, w.__wbindgen_export_0, w.__wbindgen_export_1), y2 = h;
        return G(w.a(E1, D1, i2, o2, Y2, N2, J2, k2, K2, y2, function (A) {
            if (1 == H) throw new Error("out of js stack");
            return M[--H] = A, H;
        }(C)));
    } finally { M[H++] = void 0; }
};

B.initSync = function (A) {
    if (void 0 !== w) return w;
    var g = t();
    return A instanceof WebAssembly.Module || (A = new WebAssembly.Module(A)),
        (w = (new WebAssembly.Instance(A, g)).exports), w;
};

// ====== 5. 主流程 ======
var _dirname = __dirname;
var args = _argv.slice(2);
var method = args[0] || "GET";
var url = args[1] || "https://gdtv-api.gdtv.cn/api/channel/v1/news?pageSize=40&channelId=246&currentPage=1";
var deviceId = args[2] || "WEB_test";
var clientType = args[3] || "WEB_PC";
var data = args[4] || "";

var wasmBuf = fs.readFileSync(_dirname + "/lizhi.wasm");
B.initSync(wasmBuf);

var resultMap = B.a(method, url, deviceId, clientType, data, undefined);
var resultObj = {};
for (var entry of resultMap.entries()) {
    resultObj[entry[0]] = entry[1];
}
_stdout_write(JSON.stringify(resultObj) + "\n");
