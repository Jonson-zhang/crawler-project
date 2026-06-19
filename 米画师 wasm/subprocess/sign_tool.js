/**
 * 米画师 M-S 签名工具 — subprocess CLI 版
 *
 * 供 Python 通过 subprocess.run 调用：
 *   node sign_tool.js <url_path> <timestamp>
 *   签名结果直接输出到 stdout
 */
var crypto = require('node:crypto');
var fs = require('fs');
var path = require('path');

// ============================================================
// 补浏览器环境
// ============================================================

// 默认值（优先从命令行参数获取，取不到再用默认）
var DEFAULT_FAVICON = 'https://js-assets.mihuashi.com/mhs-assets/legacy/favicon.ico';
var DEFAULT_KEYWORDS = '米画师,mihuashi,约稿平台,约稿,插画外包,插画外包网站,美术外包平台,游戏美术外包,画师,绘师,美术外包,原画外包,插画师,原画师,原画外包网站';

var args = process.argv.slice(2);
// 用法: node sign_tool.js <url_path> <timestamp> [keywords] [favicon_url]
var urlPath = args[0];
var timestamp = parseInt(args[1], 10);
var FAVICON_URL = args[3] || DEFAULT_FAVICON;
var KEYWORDS = args[2] || DEFAULT_KEYWORDS;

var fakeFaviconLink = {
    href: FAVICON_URL,
    getAttribute: function (n) { return n === 'href' ? FAVICON_URL : null; },
};
var fakeMetaKeywords = {
    content: KEYWORDS,
    getAttribute: function (n) { return n === 'content' ? KEYWORDS : null; },
};
var fakeDocument = {
    querySelector: function (sel) {
        if (sel.indexOf('icon') >= 0) return fakeFaviconLink;
        if (sel.indexOf('keywords') >= 0) return fakeMetaKeywords;
        return null;
    },
};
var fakeWindow = {
    crypto: globalThis.crypto,
    document: fakeDocument,
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', webdriver: false },
};

globalThis.self = fakeWindow;
globalThis.window = fakeWindow;
if (!globalThis.crypto.randomFillSync) {
    globalThis.crypto.randomFillSync = function (buf) { return crypto.randomFillSync(buf); };
}

// ============================================================
// wasm-bindgen 值表
// ============================================================

var table = new Array(128).fill(undefined);
table.push(undefined, null, true, false);
var freeIdx = table.length;

function tblGet(t) { return table[t]; }
function tblSet(t) {
    if (freeIdx === table.length) table.push(table.length + 1);
    var e = freeIdx; freeIdx = table[e]; table[e] = t; return e;
}
function tblDrop(t) { if (t >= 132) { table[t] = freeIdx; freeIdx = t; } }

// ============================================================
// WASM 加载（同步，从文件读取）
// ============================================================

var wasmPath = path.join(__dirname, 'mhs_fe_sign_bg.wasm');
var wasmBytes = fs.readFileSync(wasmPath);
var wasmModule = new WebAssembly.Module(wasmBytes);

var wasmExports = null;
function memBytes() { return new Uint8Array(wasmExports.memory.buffer); }
var dataView = null;
function memView() {
    if (!dataView || dataView.buffer !== wasmExports.memory.buffer)
        dataView = new DataView(wasmExports.memory.buffer);
    return dataView;
}
var strLen = 0;
var td = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
var te = new TextEncoder();
function memRead(ptr, len) { return td.decode(memBytes().subarray(ptr >>> 0, (ptr >>> 0) + len)); }
function memWrite(str, malloc, realloc) {
    var enc = te.encode(str);
    var p = malloc(enc.length, 1) >>> 0;
    memBytes().subarray(p, p + enc.length).set(enc);
    strLen = enc.length;
    return p;
}

var wbg = {
    __wbindgen_memory: function () { return tblSet(wasmExports.memory); },
    __wbindgen_string_new: function (p, l) { return tblSet(memRead(p, l)); },
    __wbindgen_string_get: function (rp, vi) {
        var v = tblGet(vi), s = typeof v === 'string' ? v : undefined;
        var pp = s == null ? 0 : memWrite(s, wasmExports.__wbindgen_export_1, wasmExports.__wbindgen_export_2);
        memView().setInt32(rp + 4, strLen, true); memView().setInt32(rp + 0, pp, true);
    },
    __wbindgen_is_string: function (i) { return typeof tblGet(i) === 'string'; },
    __wbindgen_is_object: function (i) { var v = tblGet(i); return typeof v === 'object' && v !== null; },
    __wbindgen_is_function: function (i) { return typeof tblGet(i) === 'function'; },
    __wbindgen_is_undefined: function (i) { return tblGet(i) === undefined; },
    __wbindgen_number_new: function (n) { return tblSet(n); },
    __wbindgen_boolean_get: function (i) { var v = tblGet(i); return typeof v === 'boolean' ? (v ? 1 : 0) : 2; },
    __wbindgen_object_clone_ref: function (i) { return tblSet(tblGet(i)); },
    __wbindgen_object_drop_ref: function (i) { tblDrop(i); },
    __wbindgen_throw: function (p, l) { throw new Error(memRead(p, l)); },
    __wbindgen_debug_string: function (rp, vi) {
        var v = tblGet(vi), s = String(v);
        var pp = memWrite(s, wasmExports.__wbindgen_export_1, wasmExports.__wbindgen_export_2);
        memView().setInt32(rp + 4, strLen, true); memView().setInt32(rp + 0, pp, true);
    },
    __wbg_crypto_ed58b8e10a292839: function (i) { return tblSet(tblGet(i).crypto); },
    __wbg_getRandomValues_bcb4912f16000dc4: function (oi, bi) { tblGet(oi).getRandomValues(tblGet(bi)); },
    __wbg_randomFillSync_ab2cfe79ebbf2740: function (oi, bi) { tblGet(oi).randomFillSync(tblDrop(bi)); },
    __wbg_process_5c1d670bc53614b8: function () { return 0; },
    __wbg_versions_c71aa1626a93e0a1: function () { return 0; },
    __wbg_node_02999533c4ea02e3: function () { return 0; },
    __wbg_require_79b1e9274cde3c87: function () { return 0; },
    __wbg_navigator_1577371c070c8947: function (i) { var o = tblGet(i); return o && o.navigator ? tblSet(o.navigator) : 0; },
    __wbg_document_d249400bd7bd996d: function (i) { var o = tblGet(i); return o && o.document ? tblSet(o.document) : 0; },
    __wbg_msCrypto_0a36e2ec3a343d26: function () { return 0; },
    __wbg_buffer_609cc3eee51ed158: function (i) { var o = tblGet(i); return o && o.buffer ? tblSet(o.buffer) : 0; },
    __wbg_newwithlength_a381634e90c276d4: function (l) { return tblSet(new Uint8Array(l >>> 0)); },
    __wbg_new_a12002a7f91c75be: function (i) { return tblSet(new Uint8Array(tblGet(i))); },
    __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a: function (bi, o, l) { return tblSet(new Uint8Array(tblGet(bi), o >>> 0, l >>> 0)); },
    __wbg_subarray_aa9065fa9dc5df96: function (ai, s, e) { return tblSet(tblGet(ai).subarray(s >>> 0, e >>> 0)); },
    __wbg_set_65595bdd868b3009: function (ai, si, o) { tblGet(ai).set(tblGet(si), o >>> 0); },
    __wbg_newnoargs_105ed471475aaf50: function (p, l) { return tblSet(new Function(memRead(p, l))); },
    __wbg_call_672a4d21634d4a24: function (fi, ti) { return tblSet(tblGet(fi).call(tblGet(ti))); },
    __wbg_call_7cccdd69e0791ae2: function (fi, ti, ai) { return tblSet(tblGet(fi).call(tblGet(ti), tblGet(ai))); },
    __wbg_get_67b2ba62fc30de12: function (oi, ki) {
        var o = tblGet(oi), k = tblGet(ki);
        if (o && typeof o === 'object') { var v = Reflect.get(o, k); return v !== undefined ? tblSet(v) : 0; }
        return 0;
    },
    __wbg_set_bb8cecf6a62b9f46: function () { return 0; },
    __wbg_static_accessor_GLOBAL_88a902d13a557d07: function () { return 0; },
    __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0: function () { return tblSet(globalThis); },
    __wbg_static_accessor_WINDOW_5de37043a91a9c40: function () { return tblSet(window); },
    __wbg_static_accessor_SELF_37c5d418e4bf5819: function () { return tblSet(self); },
    __wbg_static_accessor_PROCESS_2c90d3b3264f2c90: function () { return 0; },
    __wbg_getAttribute_ea5166be2deba45e: function (rp, ei, np, nl) {
        var el = tblGet(ei), an = memRead(np, nl), av = el ? el.getAttribute(an) : null;
        var ap = av == null ? 0 : memWrite(av, wasmExports.__wbindgen_export_1, wasmExports.__wbindgen_export_2);
        memView().setInt32(rp + 4, strLen, true); memView().setInt32(rp + 0, ap, true);
    },
    __wbg_querySelector_c69f8b573958906b: function (ei, sp, sl) {
        var el = tblGet(ei), sel = memRead(sp, sl), r = el ? el.querySelector(sel) : null;
        return r == null ? 0 : tblSet(r);
    },
    __wbg_instanceof_Window_def73ea0955fc569: function (i) {
        var v = tblGet(i);
        if (v === fakeWindow) return true;
        try { return v instanceof Window; } catch (e) { return false; }
    },
};

// 同步实例化
var wasmInstance = new WebAssembly.Instance(wasmModule, { wbg: wbg });
wasmExports = wasmInstance.exports;

// ============================================================
// 主入口：签名并输出到 stdout
// ============================================================

if (!urlPath || isNaN(timestamp)) {
    console.error('Usage: node sign_tool.js <url_path> <timestamp> [keywords] [favicon_url]');
    process.exit(1);
}

var ptr = wasmExports.signtool_new() >>> 0;
var r0 = 0, r1 = 0;
try {
    var sp = wasmExports.__wbindgen_add_to_stack_pointer(-16);
    var up = memWrite(urlPath, wasmExports.__wbindgen_export_1, wasmExports.__wbindgen_export_2);
    wasmExports.signtool_sign(sp, ptr, up, strLen, timestamp);
    var c = memView().getInt32(sp + 0, true);
    var a = memView().getInt32(sp + 4, true);
    var b = memView().getInt32(sp + 12, true);
    if (b) { throw new Error('sign error'); }
    r0 = c; r1 = a;
    console.log(memRead(c, a));
} finally {
    wasmExports.__wbindgen_add_to_stack_pointer(16);
    wasmExports.__wbindgen_export_3(r0, r1, 1);
}
