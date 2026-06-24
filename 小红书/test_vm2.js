#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DATA_DIR = path.join(__dirname, 'data');
const noop = () => {};

// Canvas stub
class CanvasRenderingContext2D {
  constructor() { this.canvas = null; }
  getImageData() { return { data: new Uint8Array(4), width: 1, height: 1 }; }
  putImageData() {}
  fillRect() {}
  fillText() {}
  strokeText() {}
  measureText(text) { return { width: text.length * 8 }; }
  clearRect() {}
  beginPath() {}
  closePath() {}
  stroke() {}
  fill() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  arcTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  rect() {}
  save() {}
  restore() {}
  scale() {}
  rotate() {}
  translate() {}
  transform() {}
  setTransform() {}
  drawImage() {}
  createLinearGradient() { return { addColorStop: noop }; }
  createRadialGradient() { return { addColorStop: noop }; }
  createPattern() { return null; }
  get font() { return '10px sans-serif'; }
  set font(v) { this._font = v; }
  get fillStyle() { return '#000000'; }
  set fillStyle(v) { this._fillStyle = v; }
  get strokeStyle() { return '#000000'; }
  set strokeStyle(v) { this._strokeStyle = v; }
  get lineWidth() { return 1; }
  set lineWidth(v) { this._lineWidth = v; }
  get globalAlpha() { return 1; }
  set globalAlpha(v) { this._globalAlpha = v; }
  get globalCompositeOperation() { return 'source-over'; }
  set globalCompositeOperation(v) {}
}

class HTMLCanvasElement {
  constructor() { this.width = 300; this.height = 150; }
  getContext(type) {
    if (type === '2d') return new CanvasRenderingContext2D();
    return null;
  }
  toDataURL() { return 'data:image/png;base64,'; }
  toBlob(cb) { if (cb) cb(new sandbox.Blob([])); }
}

class AudioContext {
  constructor() { this.sampleRate = 44100; this.destination = {}; this.state = 'running'; }
  createOscillator() { return { connect: noop, start: noop, stop: noop, type: 'sine', frequency: { value: 440 } }; }
  createGain() { return { connect: noop, gain: { value: 1 } }; }
  createAnalyser() { return { connect: noop, frequencyBinCount: 1024, getByteFrequencyData() {}, getByteTimeDomainData() {} }; }
  createBuffer(channels, length, sampleRate) { return { numberOfChannels: channels, length, sampleRate, getChannelData() { return new Float32Array(length); } }; }
  createBufferSource() { return { connect: noop, start: noop, stop: noop, buffer: null }; }
  close() {}
  decodeAudioData(buf, success) { if (success) success({}); }
}

function mkSandbox() {
  const s = {
    window: {}, self: {}, global: {},
    document: {
      cookie: '',
      createElement(tag) {
        if (tag === 'canvas') return new HTMLCanvasElement();
        return {};
      },
      querySelector: () => null,
      getElementsByTagName: () => [],
      addEventListener: noop,
      removeEventListener: noop,
      head: { appendChild: noop },
      body: { appendChild: noop },
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
    AudioContext,
    HTMLCanvasElement,
    CanvasRenderingContext2D,
    OffscreenCanvas: class { constructor(w, h) { this.width = w; this.height = h; } getContext(t) { return new CanvasRenderingContext2D(); } },
    Event: class { constructor(type) { this.type = type; } },
    MessageChannel: class { constructor() { this.port1 = { postMessage: noop, onmessage: null, close: noop }; this.port2 = { postMessage: noop, onmessage: null, close: noop }; } },
    MutationObserver: class { constructor(fn) {} observe() {} disconnect() {} takeRecords() { return []; } },
    IntersectionObserver: class { constructor(fn) {} observe() {} unobserve() {} disconnect() {} },
    PerformanceObserver: class { constructor(fn) {} observe() {} disconnect() {} },
    Worker: class { constructor() {} postMessage() {} terminate() {} },
    WebSocket: class { constructor() {} send() {} close() {} },
    Image: class { constructor() { this.src = ''; this.onload = null; this.onerror = null; } },
    localStorage: {
      _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }, clear() { this._data = {}; },
      get length() { return Object.keys(this._data).length; }, key(i) { return Object.keys(this._data)[i]; }
    },
    sessionStorage: {
      _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }, clear() { this._data = {}; },
      get length() { return Object.keys(this._data).length; }, key(i) { return Object.keys(this._data)[i]; }
    },
  };
  s.self = s; s.window = s; s.global = s; s.document.location = s.location;
  s.require = function(id) { if (id === '@lwjjike/xbsdom') return undefined; return require(id); };
  return s;
}

const sandbox = mkSandbox();
const ctx = vm.createContext(sandbox);

console.log('[1] Loading ds_api.js...');
vm.runInContext(fs.readFileSync(path.join(DATA_DIR, 'ds_api.js'), 'utf-8'), ctx, { filename: 'ds_api.js', timeout: 120000 });
console.log('[2] Loading ds_6545c.js...');
vm.runInContext(fs.readFileSync(path.join(DATA_DIR, 'ds_6545c.js'), 'utf-8'), ctx, { filename: 'ds_6545c.js', timeout: 120000 });

console.log('[3] Loading signer_04b29_formatted.js...');
const code = fs.readFileSync(path.join(DATA_DIR, 'signer_04b29_formatted.js'), 'utf-8');
try {
  vm.runInContext(code, ctx, { filename: 'signer_formatted', timeout: 120000 });
  console.log('[OK] signer loaded!');
  console.log('_webmsxyw:', typeof sandbox._webmsxyw);
  const saboKeys = Object.keys(sandbox).filter(k => k.includes('sabo') || k.includes('_sabo'));
  console.log('_sabo keys:', saboKeys);
  const signKeys = Object.keys(sandbox).filter(k => k.toLowerCase().includes('sign'));
  console.log('sign keys:', signKeys);
} catch (e) {
  console.log('[ERR]', e.message);
  const stack = (e.stack || '').split('\n');
  for (const line of stack.slice(1, 8)) console.log(' ', line.trim());
}
