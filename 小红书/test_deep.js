#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DATA_DIR = path.join(__dirname, 'data');
const noop = () => {};

class CanvasRenderingContext2D {
  constructor() { this.canvas = null; }
  getImageData() { return { data: new Uint8Array(4), width: 1, height: 1 }; }
  putImageData() {}
  fillRect() {} fillText() {} strokeText() {}
  measureText(t) { return { width: t.length * 8 }; }
  clearRect() {} beginPath() {} closePath() {} stroke() {} fill() {}
  moveTo() {} lineTo() {} arc() {} arcTo() {} bezierCurveTo() {} quadraticCurveTo() {}
  rect() {} save() {} restore() {} scale() {} rotate() {} translate() {} transform() {}
  setTransform() {} drawImage() {}
  createLinearGradient() { return { addColorStop: noop }; }
  createRadialGradient() { return { addColorStop: noop }; }
  createPattern() { return null; }
  get font() { return '10px sans-serif'; } set font(v) { this._font = v; }
  get fillStyle() { return '#000000'; } set fillStyle(v) { this._fillStyle = v; }
  get strokeStyle() { return '#000000'; } set strokeStyle(v) { this._strokeStyle = v; }
  get lineWidth() { return 1; } set lineWidth(v) { this._lineWidth = v; }
  get globalAlpha() { return 1; } set globalAlpha(v) { this._globalAlpha = v; }
  get globalCompositeOperation() { return 'source-over'; } set globalCompositeOperation(v) {}
}

class HTMLCanvasElement {
  constructor() { this.width = 300; this.height = 150; }
  getContext(t) { return t === '2d' ? new CanvasRenderingContext2D() : null; }
  toDataURL() { return 'data:image/png;base64,'; }
  toBlob(cb) { if (cb) cb(new sandbox.Blob([])); }
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
    Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError,
    eval,
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
    // This is used by the script to detect "global" context
    globalThis: null,
  };
  s.self = s; s.window = s; s.global = s; s.globalThis = s;
  s.document.location = s.location;
  s.require = function(id) { if (id === '@lwjjike/xbsdom') return undefined; return require(id); };
  return s;
}

const sandbox = mkSandbox();
const ctx = vm.createContext(sandbox);

// Step 1: Load ds_api.js and capture the auto-call result
console.log('[1] Loading ds_api.js (watch for auto-call)...');

// Hook _BHjFmfUMEtxhI to capture its call args before it's defined
vm.runInContext(`
  var __captured_auto_call = { called: false, args: null, result: null, error: null };
  var __orig_BHj = null;
`, ctx);

// Load ds_api.js - the auto-call happens inside
const dsCode = fs.readFileSync(path.join(DATA_DIR, 'ds_api.js'), 'utf-8');
try {
  vm.runInContext(dsCode, ctx, { filename: 'ds_api.js', timeout: 120000 });
  console.log('   ds_api.js loaded OK');
} catch(e) {
  console.log('   ds_api.js error:', e.message);
}

// Check if the auto-call fired
const autoCheck = vm.runInContext(`
  (() => {
    return {
      _BHjFmfUMEtxhI_type: typeof _BHjFmfUMEtxhI,
      __$c: typeof __$c !== 'undefined' ? __$c.slice(0, 50) + '...' : undefined,
      __bc: typeof __bc !== 'undefined' ? __bc.slice(0, 50) + '...' : undefined,
    };
  })()
`, ctx);
console.log('   after ds_api:', JSON.stringify(autoCheck, null, 2));

// Step 2: Try calling __$c setup manually (simulate the auto-call)
console.log('\n[2] Simulating the auto-call...');
const simResult = vm.runInContext(`
  (() => {
    try {
      var r = _BHjFmfUMEtxhI(__$c, [,,undefined, Uint8Array, getdss]);
      return { result: r, error: null };
    } catch(e) {
      return { result: null, error: e.message };
    }
  })()
`, ctx);
console.log('   simulate result:', JSON.stringify(simResult));

// Step 3: Try hash-named functions
console.log('\n[3] Testing hash-named functions...');
const hashTests = vm.runInContext(`
  (() => {
    const results = {};
    const fns = ['_dsf', '_0c6b9e549fef9ab9b4798ad1f12ea82b', '_1619d69735e1d480a72d7e01c4a40b7f', '_5616f326aabc524df57a5dcc766497a0', '_f26d64f11eb0f2731d1d03fabcf87c5c'];
    for (const name of fns) {
      if (typeof window[name] !== 'function') {
        results[name] = 'NOT_A_FUNCTION';
        continue;
      }
      try {
        const r = window[name]();
        if (r instanceof Uint8Array) {
          results[name] = 'Uint8Array[' + r.length + ']: ' + Array.from(r.slice(0, 8)).map(b => b.toString(16).padStart(2,'0')).join('');
        } else {
          results[name] = typeof r + ': ' + String(r).slice(0, 50);
        }
      } catch(e) {
        results[name] = 'ERROR: ' + e.message.slice(0, 80);
      }
    }
    return results;
  })()
`, ctx);
console.log('   hash functions:', JSON.stringify(hashTests, null, 2));

// Step 4: Check what _AUuXfEG27Xa3x really does
console.log('\n[4] Analyzing _AUuXfEG27Xa3x...');
const auInfo = vm.runInContext(`
  (() => {
    const fn = _AUuXfEG27Xa3x;
    if (typeof fn !== 'function') return { type: typeof fn };
    const str = fn.toString();
    // Find string references in the function
    const errMatches = str.match(/'[^']*err[^']*'/g) || [];
    const urlMatches = str.match(/'[^']*api[^']*'/g) || [];
    return {
      length: fn.length,
      args: str.match(/function\(([^)]*)\)/)?.[1] || '?',
      firstLine: str.split('{')[0].slice(0, 100),
      errRefs: errMatches.slice(0, 10),
      urlRefs: urlMatches.slice(0, 5),
    };
  })()
`, ctx);
console.log('   _AUuXfEG27Xa3x:', JSON.stringify(auInfo, null, 2));

// Step 5: Try correct call signature
console.log('\n[5] Correct call: _BHjFmfUMEtxhI(__$c, env_array)');
const correctCall = vm.runInContext(`
  (() => {
    try {
      const result = _BHjFmfUMEtxhI(__$c, [,,undefined, Uint8Array, getdss]);
      return { success: true, result: result };
    } catch(e) {
      return { success: false, error: e.message.slice(0, 100) };
    }
  })()
`, ctx);
console.log('   result:', JSON.stringify(correctCall));
