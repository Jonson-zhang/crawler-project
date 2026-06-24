#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DATA_DIR = path.join(__dirname, 'data');
const noop = () => {};

class CanvasRenderingContext2D {
  constructor() { this.canvas = null; }
  getImageData() { return { data: new Uint8Array(4), width: 1, height: 1 }; }
  putImageData() {} fillRect() {} fillText() {} strokeText() {}
  measureText(t) { return { width: t.length * 8 }; }
  clearRect() {} beginPath() {} closePath() {} stroke() {} fill() {}
  moveTo() {} lineTo() {} arc() {} arcTo() {} bezierCurveTo() {} quadraticCurveTo() {}
  rect() {} save() {} restore() {} scale() {} rotate() {} translate() {} transform() {}
  setTransform() {} drawImage() {}
  createLinearGradient() { return { addColorStop: noop }; }
  createRadialGradient() { return { addColorStop: noop }; }
  createPattern() { return null; }
  get font() { return '10px sans-serif'; } set font(v) {}
  get fillStyle() { return '#000000'; } set fillStyle(v) {}
  get strokeStyle() { return '#000000'; } set strokeStyle(v) {}
  get lineWidth() { return 1; } set lineWidth(v) {}
  get globalAlpha() { return 1; } set globalAlpha(v) {}
  get globalCompositeOperation() { return 'source-over'; } set globalCompositeOperation(v) {}
}

class HTMLCanvasElement {
  constructor() { this.width = 300; this.height = 150; }
  getContext(t) { return t === '2d' ? new CanvasRenderingContext2D() : null; }
  toDataURL() { return 'data:image/png;base64,'; }
}

function mkSandbox() {
  const s = {
    window: {}, self: {}, global: {},
    document: {
      cookie: '',
      createElement(tag) { return tag === 'canvas' ? new HTMLCanvasElement() : {}; },
      querySelector: () => null, getElementsByTagName: () => [],
      addEventListener: noop, removeEventListener: noop,
      head: { appendChild: noop }, body: { appendChild: noop },
      documentElement: { style: {} },
    },
    location: { href: 'https://www.xiaohongshu.com/explore', host: 'www.xiaohongshu.com', hostname: 'www.xiaohongshu.com', protocol: 'https:', origin: 'https://www.xiaohongshu.com', pathname: '/explore' },
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', platform: 'Win32', webdriver: false, plugins: [], languages: ['zh-CN'], language: 'zh-CN' },
    screen: { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 },
    history: { length: 1, state: null, pushState: noop, replaceState: noop },
    console: { log: () => {}, error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
    performance: { now: () => Date.now(), timing: { navigationStart: Date.now() - 1000 } },
    setTimeout: (fn, ms, ...a) => { fn(...a); return 0; },
    setInterval: () => 0, clearTimeout: noop, clearInterval: noop,
    TextEncoder, TextDecoder, URL, URLSearchParams,
    atob: x => Buffer.from(x, 'base64').toString('binary'),
    btoa: x => Buffer.from(x, 'binary').toString('base64'),
    encodeURIComponent, decodeURIComponent,
    Blob: class { constructor(p) {} },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    Headers: class { constructor(h) { this._h = h || {}; } set(k, v) { this._h[k] = v; } get(k) { return this._h[k]; } },
    XMLHttpRequest: (() => {
      function XHR() { this.readyState = 0; this.status = 0; this.responseText = ''; }
      XHR.prototype.open = function(m, u) { this._method = m; this._url = u; this.readyState = 1; };
      XHR.prototype.setRequestHeader = function() {};
      XHR.prototype.send = function() { this.readyState = 4; this.status = 200; this.responseText = '{}'; if (this.onreadystatechange) this.onreadystatechange(); };
      return XHR;
    })(),
    crypto: require('crypto').webcrypto,
    Function, Math, Date, Object, Array, String, Number, Boolean,
    RegExp, Map, Set, WeakMap, WeakSet,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView,
    Promise, Proxy, Reflect, Symbol,
    parseInt, parseFloat, isNaN, isFinite, JSON,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError, eval,
    AudioContext: class { constructor() { this.sampleRate = 44100; this.destination = {}; this.state = 'running'; } createOscillator() { return { connect: noop, start: noop, stop: noop, type: 'sine', frequency: { value: 440 } }; } close() {} },
    HTMLCanvasElement, CanvasRenderingContext2D,
    OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; } getContext(t) { return new CanvasRenderingContext2D(); } },
    Event: class { constructor(type) { this.type = type; } },
    MessageChannel: class { constructor() { this.port1 = { postMessage: noop, onmessage: null, close: noop }; this.port2 = { postMessage: noop, onmessage: null, close: noop }; } },
    MutationObserver: class { constructor(fn) {} observe() {} disconnect() {} takeRecords() { return []; } },
    IntersectionObserver: class { constructor(fn) {} observe() {} unobserve() {} disconnect() {} },
    PerformanceObserver: class { constructor(fn) {} observe() {} disconnect() {} },
    Worker: class { constructor() {} postMessage() {} terminate() {} },
    WebSocket: class { constructor() {} send() {} close() {} },
    Image: class { constructor() { this.src = ''; this.onload = null; this.onerror = null; } },
    localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); }, removeItem(k) { delete this._data[k]; }, clear() { this._data = {}; }, get length() { return Object.keys(this._data).length; }, key(i) { return Object.keys(this._data)[i]; } },
    sessionStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); }, removeItem(k) { delete this._data[k]; }, clear() { this._data = {}; }, get length() { return Object.keys(this._data).length; }, key(i) { return Object.keys(this._data)[i]; } },
  };
  s.self = s; s.window = s; s.global = s; s.document.location = s.location;
  s.require = function(id) { if (id === '@lwjjike/xbsdom') return undefined; return require(id); };
  return s;
}

const sandbox = mkSandbox();
const ctx = vm.createContext(sandbox);

console.log('[1/3] Loading ds_api.js...');
vm.runInContext(fs.readFileSync(path.join(DATA_DIR, 'ds_api.js'), 'utf-8'), ctx, { filename: 'ds_api.js', timeout: 120000 });

console.log('[2/3] Loading ds_6545c.js...');
vm.runInContext(fs.readFileSync(path.join(DATA_DIR, 'ds_6545c.js'), 'utf-8'), ctx, { filename: 'ds_6545c.js', timeout: 120000 });

console.log('[3/3] Loading signer_04b29_formatted.js...');
vm.runInContext(fs.readFileSync(path.join(DATA_DIR, 'signer_04b29_formatted.js'), 'utf-8'), ctx, { filename: 'signer_formatted', timeout: 120000 });

// Check what's available now
const fnsAfter = vm.runInContext(`
  (() => {
    const r = {};
    // Check if the key hash functions exist
    ['_dsf', '_AUuXfEG27Xa3x', 'getdss', '__$c', '__bc'].forEach(k => {
      r[k] = typeof window[k];
    });
    // Check all _0* hash functions
    const hashKeys = Object.keys(window).filter(k => k.startsWith('_0') && k.length > 10);
    r._hashFnCount = hashKeys.length;
    hashKeys.forEach(k => { r[k] = typeof window[k]; });
    return r;
  })()
`, ctx);
console.log('\nFunctions after all scripts:');
console.log(JSON.stringify(fnsAfter, null, 2));

// Try calling _AUuXfEG27Xa3x with the CORRECT signature
console.log('\n[Test] _AUuXfEG27Xa3x signature...');
const testResult = vm.runInContext(`
  (() => {
    const result = {};

    // Test 1: call _AUuXfEG27Xa3x as in ds_6545c.js
    if (typeof _AUuXfEG27Xa3x !== 'function') {
      result.fn_missing = true;
      return result;
    }

    // In the browser, it's called as:
    // _AUuXfEG27Xa3x(url_string, body_json)
    const url = '/api/sns/web/v1/homefeed';
    const body = JSON.stringify({
      cursor_score: '',
      num: 20,
      refresh_type: 1,
      note_index: 0,
      unread_begin_note_id: '',
      unread_end_note_id: '',
      unread_note_count: 0,
      category: 'homefeed_recommend',
    });

    try {
      // 2-arg call
      const r2 = _AUuXfEG27Xa3x(url, body);
      result.call2 = { type: typeof r2, value: String(r2).slice(0, 200) };
    } catch(e) {
      result.call2_error = e.message.slice(0, 100);
    }

    // Check if it needs a full URL
    try {
      const fullUrl = 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed';
      const r2full = _AUuXfEG27Xa3x(fullUrl, body);
      result.call2_full = { type: typeof r2full, value: String(r2full).slice(0, 200) };
    } catch(e) {
      result.call2_full_error = e.message.slice(0, 100);
    }

    // 3-arg call (maybe needs XHR object or headers?)
    try {
      const r3 = _AUuXfEG27Xa3x(url, body, null);
      result.call3 = { type: typeof r3, value: String(r3).slice(0, 200) };
    } catch(e) {
      result.call3_error = e.message.slice(0, 100);
    }

    // Check the function toString for clues
    result.fnStr = _AUuXfEG27Xa3x.toString().slice(0, 400);

    return result;
  })()
`, ctx);

console.log(JSON.stringify(testResult, null, 2));

// Also check if _BHjFmfUMEtxhI auto-call worked
console.log('\n[Check] Was auto-call successful?');
const autoResult = vm.runInContext(`
  (() => {
    // Check if any function references the __$c or __bc
    const allKeys = Object.keys(window);
    // The signer_04b29 functions should now be available
    const saboKeys = allKeys.filter(k => k.includes('sabo') || k.includes('_sabo'));
    const erKeys = allKeys.filter(k => k.includes('err') || k.includes('_err'));
    return {
      saboKeys_count: saboKeys.length,
      _webmsxyw_type: typeof _webmsxyw,
      // The env array values
      dsf_value: typeof _dsf !== 'function' ? 'not_fn' : 'fn',
    };
  })()
`, ctx);
console.log(JSON.stringify(autoResult, null, 2));
