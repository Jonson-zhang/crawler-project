/**
 * 荔枝网 (GDTV) WASM 签名 — 按 web-reverse-algorithm + web-reverse-env Skill 流程
 *
 * === 题型 === (web-reverse-algorithm → 01-decision-tree)
 * Wasm/Header签名联动题
 * writer: chunk-libs.js S() → headers
 * builder: chunk-libs.js m() → WASM a()
 * entry:   WASM export func[32] "a"  (Type[13] → 11×i32→i32)
 * source:  vendor_w.js + lizhi.wasm
 *
 * === 环境 === (web-reverse-env → P0+P1)
 * P0: window/self/document/location → 让代码进入 builder
 * P1: Date/Map/TextEncoder → 对齐 builder 输入
 * 无需: canvas/webgl/audio/plugins/Worker
 *
 * === wbg stub === (wasm-objdump -x lizhi.wasm → 30 导入函数)
 * 参数数量来自 Type section，语义来自 vendor_w.js trace
 */

const fs = require("fs");
const path = require("path");

// ============================================================
// P0: 最小可运行环境 (web-reverse-env → P0优先级)
// 从 vendor_w.js + 原始可工作 code.js 精确移植
// ============================================================

delete global;
delete process;

function Window() {}
window = new Window();
self = window;
self.self = window;
window.window = window;

Location = function Location() {};
Location.prototype = {
    "ancestorOrigins": {},
    "href": "https://gdtv.cn/channels/2#246",
    "origin": "https://gdtv.cn",
    "protocol": "https:",
    "host": "gdtv.cn",
    "hostname": "gdtv.cn",
    "port": "",
    "pathname": "/channels/2",
    "search": "",
    "hash": "#246"
};
location = new Location();
window.location = location;

document = { location: location };
window.document = document;

// P1: 运行时工具
const encoder = new TextEncoder("utf-8");
const decoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });

// ============================================================
// wasm-bindgen 引用表 (来自 vendor_w.js initSync)
// 128 槽位 + 自由链表分配，4 个预留值
// ============================================================
const M = new Array(128).fill(void 0);
let stackPtr = 128;                  // H: 栈指针向下借位
let freeHead = M.length;             // o: 空闲链表头 (=128)

function getRef(r)  { return M[r]; }
function isNull(v)  { return null == v; }

function addRef(v) {
    if (freeHead === M.length) M.push(M.length + 1);
    const idx = freeHead;
    freeHead = M[idx];
    M[idx] = v;
    return idx;
}

function dropAndGet(r) {
    const v = getRef(r);
    if (r >= 132) { M[r] = freeHead; freeHead = r; }
    return v;
}

// ============================================================
// WASM 内存懒加载
// ============================================================
let wasm = null;  // exports, 实例化后赋值
let mem8 = null;
let mem32 = null;

function u8()  { return (mem8 && mem8.byteLength) || (mem8 = new Uint8Array(wasm.memory.buffer)), mem8; }
function i32() { return (mem32 && mem32.byteLength) || (mem32 = new Int32Array(wasm.memory.buffer)), mem32; }

// ============================================================
// 字符串 ABI (来自 vendor_w.js L/K 函数)
// ============================================================
let _strLen = 0;  // 全局 h，L 的返回值长度

// 编码字符串到 WASM 内存，返回 ptr
function encodeStr(str, alloc, realloc) {
    if (void 0 === realloc) {
        const bytes = encoder.encode(str);
        const ptr = alloc(bytes.length, 1) >>> 0;
        u8().subarray(ptr, ptr + bytes.length).set(bytes);
        return _strLen = bytes.length, ptr;
    }
    // 多字节字符路径
    let i = 0;
    const len = str.length;
    let ptr = alloc(len, 1) >>> 0;
    const buf = u8();
    for (; i < len; i++) {
        if (str.charCodeAt(i) > 127) break;
        buf[ptr + i] = str.charCodeAt(i);
    }
    if (i !== len) {
        if (i !== 0) str = str.slice(i);
        const newLen = i + 3 * str.length;
        ptr = realloc(ptr, len, newLen, 1) >>> 0;
        const sub = u8().subarray(ptr + i, ptr + newLen);
        if ("function" == typeof encoder.encodeInto) {
            ptr = realloc(ptr, newLen, i += encoder.encodeInto(str, sub).written, 1) >>> 0;
        } else {
            const encoded = encoder.encode(str);
            sub.set(encoded);
            ptr = realloc(ptr, newLen, i += encoded.length, 1) >>> 0;
        }
    }
    return _strLen = i, ptr;
}

// 从 WASM 内存解码字符串
function decodeStr(ptr, len) {
    return decoder.decode(u8().subarray(ptr >>>= 0, ptr + len));
}

// ============================================================
// 构造器工厂 S/E (来自 vendor_w.js，必须完全一致)
// ============================================================
const _ReflectConstruct = (function () {
    if ("undefined" == typeof Reflect || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if ("function" == typeof Proxy) return true;
    try {
        Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
        return true;
    } catch (e) { return false; }
})()
    ? Reflect.construct.bind()
    : function (BaseFn, argsArr, Target) {
        const preArgs = [null];
        preArgs.push.apply(preArgs, argsArr);
        const Ctor = new (Function.bind.apply(BaseFn, preArgs))();
        if (Target) {
            const setP = Object.setPrototypeOf || function (c, p) { c.__proto__ = p; };
            setP(Ctor, Target.prototype);
        }
        return Ctor;
    };

function makeCtor() {
    const args = new Array(arguments.length);
    for (let i = 0; i < arguments.length; i++) args[i] = arguments[i];
    const Ctor = function () {
        try { return _ReflectConstruct(Function, args); }
        catch (e) { return function () { return null; }; }
    }();
    Ctor.toString = function () { return ""; };
    return Ctor;
}

// 安全调用包装：捕获异常并回传给 WASM
function safeCall(fn) {
    try { return fn(); }
    catch (e) { wasm.__wbindgen_export_3(addRef(e)); }
}

// ============================================================
// wbg stub 实现 (30 个导入函数，签名来自 wasm-objdump Type section)
// ============================================================

const wbg = {};

// -- 引用表管理 --
wbg.__wbindgen_object_drop_ref  = r => dropAndGet(r);                                   // sig=4: (i32)→void
wbg.__wbindgen_object_clone_ref = r => addRef(getRef(r));                               // sig=6: (i32)→i32
wbg.__wbindgen_is_undefined     = r => isNull(getRef(r)) ? 1 : 0;                       // sig=6: (i32)→i32

// -- self → window 链 (sig=10: ()→i32) --
wbg.__wbg_self_1ff1d729e9aae938       = () => safeCall(() => addRef(self.self));
wbg.__wbg_window_5f4faef6c12b79ec     = () => safeCall(() => addRef(window.window));
wbg.__wbg_globalThis_1d39714405582d3c = () => safeCall(() => addRef(globalThis.globalThis));
wbg.__wbg_global_651f05c6a0944d1c     = () => safeCall(() => addRef(globalThis.global));

// -- 类型判断 --
wbg.__wbindgen_typeof     = r => addRef(typeof getRef(r));                               // sig=6: (i32)→i32
wbg.__wbindgen_boolean_get = r => { const v = getRef(r); return "boolean" == typeof v ? v ? 1 : 0 : 2; };  // sig=6: (i32)→i32
wbg.__wbg_instanceof_Window_9029196b662bc42a = r => {
    try { return getRef(r) instanceof Window ? 1 : 0; } catch (e) { return 0; }
};

// -- DOM --
wbg.__wbg_document_f7ace2b956f30a4f  = r => { const d = getRef(r).document; return isNull(d) ? 0 : addRef(d); };
wbg.__wbg_location_56243dba507f472d = r => addRef(getRef(r).location);

// -- Location 属性写入 outPtr (sig=0: (i32,i32)→void) --
function makeLocFn(prop) {
    return function () {
        const args = arguments;
        return safeCall(() => {
            const ptr = encodeStr(getRef(args[1])[prop], wasm.__wbindgen_export_0, wasm.__wbindgen_export_1);
            const len = _strLen;
            i32()[args[0] / 4 + 1] = len;
            i32()[args[0] / 4 + 0] = ptr;
        });
    };
}
wbg.__wbg_host_15090f3de0544fea   = makeLocFn("host");
wbg.__wbg_origin_50aa482fa6784a0a = makeLocFn("origin");
wbg.__wbg_href_d62a28e4fc1ab948   = makeLocFn("href");

// -- 函数调用 --
wbg.__wbg_call_cb65541d95d71282 = function() {
    const args = arguments;
    return safeCall(() => addRef(getRef(args[0]).call(getRef(args[1]))));
};
wbg.__wbg_call_01734de55d61e11d = function() {
    const args = arguments;
    return safeCall(() => addRef(getRef(args[0]).call(getRef(args[1]), getRef(args[2]))));
};

// -- 构造函数 (sig=1: (i32,i32)→i32, sig=9: (i32,i32,i32,i32)→i32) --
wbg.__wbg_newnoargs_581967eacc0e2604  = (p, l) => addRef(makeCtor(decodeStr(p, l)));
wbg.__wbg_newwithargs_a0432b7780c1dfa1 = (p1, l1, p2, l2) => addRef(makeCtor(decodeStr(p1, l1), decodeStr(p2, l2)));

// -- 字符串 ABI --
wbg.__wbindgen_string_new = (p, l) => addRef(decodeStr(p, l));                           // sig=1: (i32,i32)→i32
wbg.__wbindgen_string_get = function(outPtr, r) {                                         // sig=0: (i32,i32)→void
    const val = getRef(r);
    const str = "string" == typeof val ? val : void 0;
    if (isNull(str)) {
        i32()[outPtr / 4 + 1] = 0;
        i32()[outPtr / 4 + 0] = 0;
    } else {
        const ptr = encodeStr(str, wasm.__wbindgen_export_0, wasm.__wbindgen_export_1);
        const len = _strLen;
        i32()[outPtr / 4 + 1] = len;
        i32()[outPtr / 4 + 0] = ptr;
    }
};

// -- eval (sig=1: (i32,i32)→i32) —
wbg.__wbg_eval_8c72ad5eafe427f2 = function () {
    const args = arguments;
    return safeCall(() => addRef(eval(decodeStr(args[0], args[1]))));
};

// -- Map --
wbg.__wbg_new_56693dbed0c32988  = () => addRef(new Map());                                         // sig=10: ()→i32
wbg.__wbg_set_bedc3d02d0f05eb0 = (m, k, v) => { getRef(m).set(getRef(k), getRef(v)); return 0; };  // sig=2: (i32,i32,i32)→i32

// -- Number --
wbg.__wbindgen_number_new = n => addRef(n);                                                  // sig=16: (f64)→i32

// -- Date --
wbg.__wbg_new0_c0be7df4b6bd481f               = () => addRef(new Date());                  // sig=10: ()→i32
wbg.__wbg_new_cd59bfc8881f487b                = r => addRef(new Date(getRef(r)));          // sig=6: (i32)→i32
wbg.__wbg_getTime_5e2054f832d82ec9            = r => getRef(r).getTime();                  // sig=12: (i32)→f64
wbg.__wbg_getTimezoneOffset_8aee3445f323973e  = r => getRef(r).getTimezoneOffset();        // sig=12: (i32)→f64

// -- throw --
wbg.__wbindgen_throw = (p, l) => { throw new Error(decodeStr(p, l)); };                    // sig=0: (i32,i32)→void

// ============================================================
// builder: 签名入口 — 对应 WASM export "a" (Type[13]: 11×i32→i32)
// ============================================================
function sign(method, url, deviceId, client, extra, scope) {
    try {
        const alloc   = wasm.__wbindgen_export_0;   // malloc-like
        const realloc = wasm.__wbindgen_export_1;   // realloc-like

        const mPtr = encodeStr(method, alloc, realloc);   const mLen = _strLen;
        const uPtr = encodeStr(url,    alloc, realloc);   const uLen = _strLen;
        const dPtr = encodeStr(deviceId, alloc, realloc); const dLen = _strLen;
        const cPtr = encodeStr(client,  alloc, realloc);   const cLen = _strLen;
        const ePtr = encodeStr(extra,   alloc, realloc);   const eLen = _strLen;

        // 借栈槽位传 scope ref (wasm-bindgen 闭包模式)
        if (1 === stackPtr) throw new Error("out of js stack");
        M[--stackPtr] = scope;
        const cbRef = stackPtr;

        const resultRef = wasm.a(mPtr, mLen, uPtr, uLen, dPtr, dLen,
                                  cPtr, cLen, ePtr, eLen, cbRef);
        return dropAndGet(resultRef); // 返回 Map 对象
    } finally {
        M[stackPtr++] = void 0;
    }
}

// ============================================================
// 实例化并执行
// ============================================================
const wasmBinary = fs.readFileSync(path.join(__dirname, "lizhi.wasm"));

WebAssembly.instantiate(wasmBinary, { wbg }).then(function (ret) {
    wasm = ret.instance.exports;

    // 调用参数 — 对齐 chunk-libs.js m() 的调用
    const result = sign(
        "GET",                                                                      // method
        "https://gdtv-api.gdtv.cn/api/channel/v1/news?beginScore=0&channelId=246&pageSize=30",  // url
        "WEB_35493ea0-f2f4-11f0-aaaa-252666417e3c",                                // deviceId
        "WEB_PC",                                                                   // client
        "",                                                                         // extra
        undefined                                                                   // scope
    );

    // Map → JSON（Python subprocess 读取 stdout）
    const out = {};
    for (const [k, v] of result.entries()) out[k] = v;
    console.log(JSON.stringify(out));
});
