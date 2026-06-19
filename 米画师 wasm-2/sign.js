// mihuashi.com WASM signer — Node.js protocol implementation
// WASM: mhs_fe_sign_bg.wasm (wasm-bindgen, 42 imports, 9 exports)
// Sign: sign(url_string, timestamp_sec) → signature_string

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

// ========== Debug ==========
const DEBUG = process.env.DEBUG === '1';
function debug(...args) { if (DEBUG) console.error('[wbg]', ...args); }

// ========== Ref table (matches JS glue http.NcR9CHD7.js) ==========
const refs = new Array(128).fill(void 0);
refs.push(void 0, null, !0, !1); // slots 128-131

function getRef(idx) {
  if (idx === 0) return void 0;
  return refs[idx];
}

let nextSlot = refs.length;
function add(val) {
  if (nextSlot === refs.length) refs.push(refs.length + 1);
  const slot = nextSlot;
  nextSlot = refs[slot];
  refs[slot] = val;
  return slot;
}

function dropRef(idx) {
  if (idx < 132) return;
  refs[idx] = nextSlot;
  nextSlot = idx;
}

function takeRef(idx) {
  const val = getRef(idx);
  dropRef(idx);
  return val;
}

// ========== WASM memory helpers ==========
let wasmExports = null;
let wasmMemory = null;
let wasmU8 = null;

function getMemory() {
  if (!wasmU8 || wasmU8.buffer !== wasmMemory.buffer) {
    wasmU8 = new Uint8Array(wasmMemory.buffer);
  }
  return wasmU8;
}

function getDataView() {
  return new DataView(wasmMemory.buffer);
}

function readStr(ptr, len) {
  const u8 = getMemory();
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
  return decoder.decode(u8.subarray(ptr, ptr + len));
}

function writeStr(str) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  const ptr = wasmExports.__wbindgen_export_1(encoded.length, 1) >>> 0;
  const u8 = getMemory();
  u8.set(encoded, ptr);
  return { ptr, len: encoded.length };
}

// ========== Fake browser environment ==========
const FAKE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';

// Fake DOM element
function fakeEl(tagName, attrs) {
  const el = { tagName, nodeType: 1, attributes: {} };
  for (const [k, v] of Object.entries(attrs)) { el.attributes[k] = v; }
  el.getAttribute = function(name) { return this.attributes[name] || null; };
  el.querySelector = function() { return null; };
  el.querySelectorAll = function() { return []; };
  return el;
}

const faviconEl = fakeEl('link', {
  rel: 'shortcut icon', type: 'image/png',
  href: 'https://image-assets.mihuashi.com/misc/header-bar-logo.png'
});

const fakeDocument = {
  title: '米画师',
  characterSet: 'UTF-8',
  readyState: 'complete',
  cookie: '',
  hasFocus() { return true; },
  querySelector(sel) {
    if (sel.includes('icon')) return faviconEl;
    return null;
  },
  querySelectorAll(sel) {
    if (sel.includes('icon')) return [faviconEl];
    return [];
  },
  getElementById() { return null; },
  getElementsByTagName(tag) {
    if (tag === 'meta') return [
      fakeEl('meta', { name: 'keywords', content: '插画,约稿,美术,外包' }),
      fakeEl('meta', { name: 'description', content: '米画师 - 专业美术外包平台' }),
    ];
    if (tag === 'link') return [faviconEl];
    return [];
  },
  createElement() { return fakeEl('div', {}); },
  documentElement: fakeEl('html', {}),
  head: fakeEl('head', {}),
  body: fakeEl('body', {}),
};

const fakeNavigator = {
  userAgent: FAKE_UA,
  platform: 'Win32',
  language: 'zh-CN',
  languages: ['zh-CN', 'zh'],
  hardwareConcurrency: 16,
  maxTouchPoints: 0,
  cookieEnabled: true,
  onLine: true,
  doNotTrack: '1',
  appVersion: '5.0 (Windows)',
  appName: 'Netscape',
  vendor: '',
  product: 'Gecko',
  productSub: '20100101',
};

// Node.js crypto: need bound methods to pass Crypto type checks
const _nativeCrypto = globalThis.crypto;
const fakeCrypto = {
  // These must be bound to _nativeCrypto or they fail the instanceof check
  getRandomValues: _nativeCrypto.getRandomValues.bind(_nativeCrypto),
  subtle: _nativeCrypto.subtle,
  // randomFillSync: fill with Node crypto (this is a Node API, not Web Crypto)
  randomFillSync(buf) {
    const bytes = nodeCrypto.randomBytes(buf.length);
    buf.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    return buf;
  },
};

const fakeWindow = {
  navigator: fakeNavigator,
  document: fakeDocument,
  crypto: fakeCrypto,
  location: {
    href: 'https://www.mihuashi.com/',
    hostname: 'www.mihuashi.com',
    pathname: '/',
    protocol: 'https:',
    toString() { return 'https://www.mihuashi.com/'; },
  },
  innerWidth: 1920,
  innerHeight: 1080,
  screen: { width: 3072, height: 1728, colorDepth: 24 },
  performance: { now() { return Date.now() - startTime; } },
};

const startTime = Date.now();

// self/window chain
globalThis.self = fakeWindow;
globalThis.window = fakeWindow;

// ========== wbg imports — matching JS glue semantics ==========
const wbg = {

  __wbindgen_string_new(a, b) {
    const s = readStr(a, b);
    debug('string_new', s.substring(0, 60));
    return add(s);
  },

  __wbg_get_67b2ba62fc30de12(a, b) {
    const obj = getRef(a);
    const key = getRef(b);
    const result = Reflect.get(obj, key);
    debug('get', typeof obj, key, typeof result);
    return add(result);
  },

  __wbindgen_is_function(a) {
    return typeof getRef(a) === 'function';
  },

  __wbindgen_object_drop_ref(a) {
    dropRef(a);
  },

  __wbindgen_number_new(a) {
    return add(a);
  },

  __wbg_crypto_ed58b8e10a292839(a) {
    const obj = getRef(a);
    debug('crypto', obj === fakeWindow ? 'window' : typeof obj);
    const c = (obj && obj.crypto) ? obj.crypto : null;
    return c ? add(c) : 0;
  },

  __wbindgen_is_object(a) {
    const v = getRef(a);
    return typeof v === 'object' && v !== null;
  },

  __wbg_process_5c1d670bc53614b8(a) {
    // Return 0 — WASM thinks we're NOT in Node.js
    return 0;
  },

  __wbg_versions_c71aa1626a93e0a1(a) {
    return 0;
  },

  __wbg_node_02999533c4ea02e3(a) {
    return 0;
  },

  __wbindgen_is_string(a) {
    return typeof getRef(a) === 'string';
  },

  __wbg_require_79b1e9274cde3c87() {
    return 0;
  },

  __wbg_msCrypto_0a36e2ec3a343d26(a) {
    const obj = getRef(a);
    return (obj && obj.msCrypto) ? add(obj.msCrypto) : 0;
  },

  __wbg_newwithlength_a381634e90c276d4(a) {
    const arr = new Uint8Array(a >>> 0);
    debug('newwithlength', a);
    return add(arr);
  },

  __wbindgen_memory() {
    return add(wasmMemory);
  },

  __wbg_buffer_609cc3eee51ed158(a) {
    const obj = getRef(a);
    return add(obj.buffer);
  },

  __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a(a, b, c) {
    const buf = getRef(a);
    return add(new Uint8Array(buf, b >>> 0, c >>> 0));
  },

  __wbg_randomFillSync_ab2cfe79ebbf2740(a, b) {
    // a=selfRef, b=bufRef → take value from ref table
    const self = getRef(a);
    const buf = takeRef(b);
    debug('randomFillSync', self === fakeCrypto ? 'crypto' : typeof self, buf ? buf.length : 0);
    if (self && typeof self.randomFillSync === 'function') {
      self.randomFillSync(buf);
    }
  },

  __wbg_subarray_aa9065fa9dc5df96(a, b, c) {
    const arr = getRef(a);
    return add(arr.subarray(b >>> 0, c >>> 0));
  },

  __wbg_getRandomValues_bcb4912f16000dc4(a, b) {
    // a=cryptoRef, b=bufRef — do NOT take/drop, getRandomValues fills in-place
    const cryptoObj = getRef(a);
    const buf = getRef(b);
    debug('getRandomValues', buf ? buf.length : 0);
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      cryptoObj.getRandomValues(buf);
    }
  },

  __wbg_new_a12002a7f91c75be(a) {
    const buf = getRef(a);
    return add(new Uint8Array(buf));
  },

  __wbg_set_65595bdd868b3009(a, b, c) {
    const target = getRef(a);
    const src = getRef(b);
    target.set(src, c >>> 0);
  },

  __wbindgen_object_clone_ref(a) {
    return add(getRef(a));
  },

  __wbindgen_is_undefined(a) {
    return getRef(a) === void 0;
  },

  __wbg_newnoargs_105ed471475aaf50(a, b) {
    const code = readStr(a, b);
    debug('newnoargs code', code.substring(0, 80));
    try {
      const fn = new Function(code);
      return add(fn);
    } catch (e) {
      debug('newnoargs FAILED', e.message);
      return 0;
    }
  },

  __wbg_call_672a4d21634d4a24(a, b) {
    const fn = getRef(a);
    const thisArg = getRef(b);
    debug('call_1', typeof fn);
    const result = fn.call(thisArg);
    return add(result);
  },

  __wbg_static_accessor_GLOBAL_88a902d13a557d07() {
    // Return 0 — make WASM think global is undefined (browser mode)
    return 0;
  },

  __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0() {
    return add(globalThis);
  },

  __wbg_static_accessor_WINDOW_5de37043a91a9c40() {
    return add(fakeWindow);
  },

  __wbg_static_accessor_SELF_37c5d418e4bf5819() {
    return add(fakeWindow);
  },

  __wbg_call_7cccdd69e0791ae2(a, b, c) {
    const fn = getRef(a);
    const thisArg = getRef(b);
    const arg1 = getRef(c);
    debug('call_2', typeof fn);
    const result = fn.call(thisArg, arg1);
    return add(result);
  },

  __wbg_static_accessor_PROCESS_2c90d3b3264f2c90() {
    return 0;
  },

  __wbg_navigator_1577371c070c8947(a) {
    const obj = getRef(a);
    return (obj && obj.navigator) ? add(obj.navigator) : 0;
  },

  __wbg_set_bb8cecf6a62b9f46(a, b, c) {
    const result = Reflect.set(getRef(a), getRef(b), getRef(c));
    return result;
  },

  __wbindgen_boolean_get(a) {
    const v = getRef(a);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return 2;
  },

  __wbg_document_d249400bd7bd996d(a) {
    const obj = getRef(a);
    return (obj && obj.document) ? add(obj.document) : 0;
  },

  __wbg_getAttribute_ea5166be2deba45e(a, b, c, d) {
    const el = getRef(b);
    const attrName = readStr(c, d);
    const dv = getDataView();
    if (el && typeof el.getAttribute === 'function') {
      const result = el.getAttribute(attrName);
      if (result === null || result === void 0) {
        dv.setInt32(a + 4, 0, true);
        dv.setInt32(a + 0, 0, true);
      } else {
        const { ptr, len } = writeStr(String(result));
        dv.setInt32(a + 4, len, true);
        dv.setInt32(a + 0, ptr, true);
      }
    } else {
      dv.setInt32(a + 4, 0, true);
      dv.setInt32(a + 0, 0, true);
    }
  },

  __wbindgen_string_get(a, b) {
    const val = getRef(b);
    const s = typeof val === 'string' ? val : '';
    const dv = getDataView();
    if (s) {
      const { ptr, len } = writeStr(s);
      dv.setInt32(a + 4, len, true);
      dv.setInt32(a + 0, ptr, true);
    } else {
      dv.setInt32(a + 4, 0, true);
      dv.setInt32(a + 0, 0, true);
    }
  },

  __wbindgen_throw(a, b) {
    const msg = readStr(a, b);
    throw new Error('WASM: ' + msg);
  },

  __wbindgen_debug_string(a, b) {
    const val = getRef(b);
    const s = String(val);
    const dv = getDataView();
    const { ptr, len } = writeStr(s);
    dv.setInt32(a + 4, len, true);
    dv.setInt32(a + 0, ptr, true);
  },

  __wbg_querySelector_c69f8b573958906b(a, b, c) {
    const el = getRef(a);
    const sel = readStr(b, c);
    debug('querySelector', sel);
    if (el && typeof el.querySelector === 'function') {
      const result = el.querySelector(sel);
      return result ? add(result) : 0;
    }
    return 0;
  },

  __wbg_instanceof_Window_def73ea0955fc569(a) {
    const val = getRef(a);
    return val === fakeWindow ? 1 : 0;
  },
};

// ========== WASM instantiation ==========
async function initWasm() {
  if (wasmExports) return wasmExports;

  const wasmPath = path.join(__dirname, 'mhs_fe_sign_bg.wasm');
  const wasmBuffer = fs.readFileSync(wasmPath);
  const imports = { wbg };

  const result = await WebAssembly.instantiate(wasmBuffer, imports);
  wasmExports = result.instance.exports;
  wasmMemory = wasmExports.memory;

  return wasmExports;
}

// ========== Signtool (matches `pe` class in glue) ==========
class Signtool {
  constructor(wasm) {
    this._wasm = wasm;
    this.__wbg_ptr = wasm.signtool_new() >>> 0;
  }

  sign(url, timestamp) {
    const wasm = this._wasm;
    const stackPtr = wasm.__wbindgen_add_to_stack_pointer(-16);
    let r = 0, s = 0;

    try {
      const { ptr: urlPtr, len: urlLen } = writeStr(url);
      wasm.signtool_sign(stackPtr, this.__wbg_ptr, urlPtr, urlLen, timestamp);

      const dv = getDataView();
      r = dv.getInt32(stackPtr + 0, true);
      s = dv.getInt32(stackPtr + 4, true);
      const maybeErrorRef = dv.getInt32(stackPtr + 8, true);
      const hasError = dv.getInt32(stackPtr + 12, true);

      if (hasError) {
        const errVal = getRef(maybeErrorRef);
        throw new Error('WASM sign error: ' + String(errVal));
      }

      return readStr(r, s);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      if (r && s) wasm.__wbindgen_export_3(r, s, 1);
    }
  }

  destroy() {
    if (this.__wbg_ptr) {
      this._wasm.__wbg_signtool_free(this.__wbg_ptr, 0);
      this.__wbg_ptr = 0;
    }
  }
}

// ========== Public API ==========
let signer = null;

async function getSigner() {
  if (!signer) {
    const wasm = await initWasm();
    signer = new Signtool(wasm);
  }
  return signer;
}

async function sign(url, timestamp) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const s = await getSigner();
      return s.sign(url, timestamp);
    } catch (e) {
      if (e.message && e.message.includes('unreachable')) {
        signer = null;
        if (attempt >= 9) throw e;
        continue;
      }
      throw e;
    }
  }
}

// ========== CLI test ==========
if (require.main === module) {
  (async () => {
    try {
      const url = process.argv[2] || 'https://www.mihuashi.com/api/v1/configure/vacation';
      const ts = Number(process.argv[3]) || Math.floor(Date.now() / 1000);
      console.error('URL:', url);
      console.error('TS:', ts);
      const result = await sign(url, ts);
      console.log(result);
    } catch (e) {
      console.error('Error:', e.message);
      process.exit(1);
    }
  })();
}

module.exports = { sign, getSigner, initWasm };
