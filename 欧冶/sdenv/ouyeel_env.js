/**
 * ouyeel_env.js — 欧冶钢材网 RuiShu 补环境模块
 *
 * 纯 JS 实现，无需 C++ 原生扩展。
 * 在 sdenv-jsdom 之上注入完整的浏览器环境。
 * 专为瑞数 6 代设计。
 *
 * 设计原则：
 *   1. 满足环境检测的"必须项"（否则 RS VM 死循环）
 *   2. 对应项尽量接近真实 Chrome 浏览器
 *   3. 所有 Function.prototype.toString 保护
 *   4. Proxy 监控调试模式（可选）
 */

'use strict';

// ══════════════════════════════════════════════════════════════
//  工具函数
// ══════════════════════════════════════════════════════════════

/** 标记函数为"原生"：保护 toString */
function setNative(func, name = '') {
  if (typeof func !== 'function') return func;
  const nativeCode = `function ${name || func.name || ''}() { [native code] }`;
  Object.defineProperty(func, 'toString', {
    value: () => nativeCode,
    writable: false,
    enumerable: false,
    configurable: true,
  });
  return func;
}

/** 创建常量属性（不可写、不可配置） */
function defConst(obj, prop, value) {
  Object.defineProperty(obj, prop, {
    value,
    writable: false,
    enumerable: true,
    configurable: false,
  });
}

/** 创建 getter 属性 */
function defGetter(obj, prop, getter) {
  Object.defineProperty(obj, prop, {
    get: getter,
    set: () => {},
    enumerable: true,
    configurable: true,
  });
}

/** 创建 getter/setter 属性 */
function defAccessor(obj, prop, getter, setter) {
  Object.defineProperty(obj, prop, {
    get: getter,
    set: setter || (() => {}),
    enumerable: true,
    configurable: true,
  });
}

/** 创建日志代理（调试用）*/
function createLogProxy(obj, name) {
  if (!obj || typeof obj !== 'object') return obj;
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && !prop.startsWith('_') && prop !== 'constructor') {
        if (val === undefined) {
          console.error(`[ENV] ⚠️ ${name}.${prop} → undefined`);
        }
      }
      if (typeof val === 'function') return val.bind(target);
      return val;
    },
    set(target, prop, val) {
      console.error(`[ENV] ${name}.${prop} =`, typeof val === 'string' ? val.substring(0, 80) : typeof val);
      return Reflect.set(target, prop, val);
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  HTMLAllCollection polyfill（最关键的补丁）
// ══════════════════════════════════════════════════════════════

function createHTMLAllCollection(length = 3) {
  const elements = [];
  for (let i = 0; i < length; i++) {
    const el = {
      tagName: 'HTML',
      nodeType: 1,
      nodeName: 'HTML',
      localName: 'html',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      id: '',
      className: '',
      parentNode: null,
      parentElement: null,
      ownerDocument: null,
      getAttribute: () => null,
      hasAttribute: () => false,
      closest: () => null,
      remove: () => {},
      appendChild: () => {},
      toString: () => '[object HTMLHtmlElement]',
    };
    elements.push(el);
  }

  const collection = function all(nameOrIndex) {
    if (typeof nameOrIndex === 'number') return elements[nameOrIndex] || null;
    if (typeof nameOrIndex === 'string') {
      // document.all('tagname') returns HTMLCollection
      // RuiShu typically checks document.all('DIV') etc.
      return [];
    }
    return null;
  };

  // Properties (use defineProperty because function's .length is non-writable)
  Object.defineProperty(collection, 'length', {
    value: elements.length,
    writable: false,
    enumerable: true,
    configurable: true,
  });
  collection.item = (idx) => elements[idx] || null;
  collection.namedItem = () => null;

  // Indexed access
  for (let i = 0; i < elements.length; i++) {
    Object.defineProperty(collection, String(i), {
      get: () => elements[i],
      configurable: true,
      enumerable: true,
    });
  }

  // Iterator (for...of)
  collection[Symbol.iterator] = function* () {
    for (let i = 0; i < elements.length; i++) yield elements[i];
  };

  // toString
  collection.toString = () => '[object HTMLAllCollection]';

  // Make [[IsHTMLDDA]] - callable object (critical for RS)
  // In browsers, document.all is callable but returns undefined
  // This is a special [[IsHTMLDDA]] internal slot behavior

  return collection;
}

// ══════════════════════════════════════════════════════════════
//  主函数：注入浏览器环境
// ══════════════════════════════════════════════════════════════

function injectEnv(window, options = {}) {
  const {
    url = 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50',
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    lang = 'zh-CN,zh;q=0.9',
    debug = false,
  } = options;

  const doc = window.document;
  const nav = window.navigator;
  const scr = window.screen;
  const loc = window.location;
  const perf = window.performance;
  const consoleFn = window.console;

  // ── 1. document.all ──
  try {
    const all = createHTMLAllCollection(7);
    Object.defineProperty(doc, 'all', {
      get: () => all,
      configurable: true,
    });
    console.error('[ENV] document.all: OK');
  } catch (e) {
    console.error('[ENV] document.all FAIL:', e.message);
  }

  // ── 2. navigator 属性 ──
  const navPatches = {
    userAgent: userAgent,
    appVersion: userAgent.replace('Mozilla/', '').split(' ').slice(0, 3).join(' '),
    platform: 'Win32',
    vendor: 'Google Inc.',
    vendorSub: '',
    product: 'Gecko',
    productSub: '20100101',
    appName: 'Netscape',
    appCodeName: 'Mozilla',
    language: 'zh-CN',
    languages: ['zh-CN', 'zh', 'en'],
    cookieEnabled: true,
    doNotTrack: '1',
    onLine: true,
    hardwareConcurrency: 8,
    maxTouchPoints: 0,
    webdriver: false,
    pdfViewerEnabled: true,
    deviceMemory: 8,
    oscpu: 'Windows NT 10.0; Win64; x64',
    buildID: '20250101000000',
  };

  for (const [key, val] of Object.entries(navPatches)) {
    try {
      defGetter(nav, key, () => val);
    } catch (e) {
      try { nav[key] = val; } catch (e2) {}
    }
  }

  // navigator methods
  const navMethods = {
    sendBeacon: () => true,
    javaEnabled: () => false,
    getBattery: () => Promise.resolve({ level: 0.85, charging: false, chargingTime: Infinity, dischargingTime: Infinity }),
    registerProtocolHandler: () => {},
    unregisterProtocolHandler: () => {},
    getGamepads: () => [null, null, null, null],
    requestMediaKeySystemAccess: () => Promise.reject(new DOMException('')),
    vibrate: () => true,
    getUserMedia: () => Promise.reject(new DOMException('')),
    webkitGetUserMedia: () => {},
    canShare: () => false,
    share: () => Promise.reject(new DOMException('')),
    getDisplayMedia: () => Promise.reject(new DOMException('')),
    setAppBadge: () => Promise.resolve(),
    clearAppBadge: () => Promise.resolve(),
    getInstalledRelatedApps: () => Promise.resolve([]),
  };

  for (const [name, fn] of Object.entries(navMethods)) {
    try {
      nav[name] = setNative(fn, name);
    } catch (e) {}
  }

  // Connection
  try {
    defGetter(nav, 'connection', () => ({
      effectiveType: '4g', rtt: 50, downlink: 10, saveData: false,
      onchange: null, addEventListener: () => {}, removeEventListener: () => {},
    }));
  } catch (e) {}

  // Plugins & mimeTypes
  try {
    defGetter(nav, 'plugins', () => {
      const p = { length: 5, item: () => null, namedItem: () => null };
      p[Symbol.iterator] = function* () {};
      ['0','1','2','3','4'].forEach(i => { p[i] = null; });
      return p;
    });
    defGetter(nav, 'mimeTypes', () => {
      const m = { length: 4, item: () => null, namedItem: () => null };
      m[Symbol.iterator] = function* () {};
      ['0','1','2','3'].forEach(i => { m[i] = null; });
      return m;
    });
  } catch (e) {}

  // ── 3. screen ──
  const screenPatches = {
    width: 1920, height: 1080,
    availWidth: 1920, availHeight: 1040,
    colorDepth: 24, pixelDepth: 24,
    availLeft: 0, availTop: 0,
    orientation: { type: 'landscape-primary', angle: 0, onchange: null },
    isExtended: false,
    onchange: null,
  };
  for (const [key, val] of Object.entries(screenPatches)) {
    try {
      const existing = Object.getOwnPropertyDescriptor(scr, key);
      if (existing && existing.get) {
        Object.defineProperty(scr, key, { get: () => val, configurable: true });
      } else {
        defConst(scr, key, val);
      }
    } catch (e) {}
  }

  // ── 4. location ──
  try {
    defGetter(loc, 'href', () => url);
    defGetter(loc, 'origin', () => 'https://www.ouyeel.com');
    defGetter(loc, 'protocol', () => 'https:');
    defGetter(loc, 'host', () => 'www.ouyeel.com');
    defGetter(loc, 'hostname', () => 'www.ouyeel.com');
    defGetter(loc, 'port', () => '');
    defGetter(loc, 'pathname', () => '/steel/search');
    defGetter(loc, 'search', () => '?channel=RJ&pageIndex=1&pageSize=50');
    defGetter(loc, 'hash', () => '');
    defGetter(loc, 'ancestorOrigins', () => []);
    loc.reload = setNative(() => {}, 'reload');
    loc.replace = setNative((h) => {
      console.error(`[ENV] location.replace → ${h?.substring(0, 100) || 'undefined'}`);
    }, 'replace');
    loc.assign = setNative((h) => {
      console.error(`[ENV] location.assign → ${h?.substring(0, 100) || 'undefined'}`);
    }, 'assign');
  } catch (e) {}

  // ── 5. document ──
  try {
    defGetter(doc, 'title', () => '欧冶钢材 - 钢铁现货交易平台');
    defGetter(doc, 'domain', () => 'www.ouyeel.com');
    defGetter(doc, 'referrer', () => '');
    defGetter(doc, 'readyState', () => 'complete');
    defGetter(doc, 'characterSet', () => 'UTF-8');
    defGetter(doc, 'charset', () => 'UTF-8');
    defGetter(doc, 'compatMode', () => 'CSS1Compat');
    defGetter(doc, 'hidden', () => false);
    defGetter(doc, 'visibilityState', () => 'visible');
    defGetter(doc, 'URL', () => url);
    defGetter(doc, 'documentURI', () => url);
    defGetter(doc, 'baseURI', () => url);
    defGetter(doc, 'scrollingElement', () => doc.body || doc.documentElement);
    defGetter(doc, 'activeElement', () => doc.body || doc.documentElement);
    defGetter(doc, 'currentScript', () => {
      // RuiShu checks currentScript's src attribute
      const s = { src: '', type: 'text/javascript', text: '', getAttribute: () => null, remove: () => {} };
      return s;
    });
    defGetter(doc, 'doctype', () => ({
      name: 'html', publicId: '', systemId: '', nodeType: 10,
      toString: () => '<!DOCTYPE html>',
    }));
    defGetter(doc, 'cookie', () => {
      return window.__cookieStorage || '';
    });
    doc.__defineSetter__('cookie', (v) => {
      // Setter is handled below
    });
  } catch (e) {}

  // ── 6. document methods ──
  const noop = setNative(() => {});
  const makeEl = (tag) => ({
    tagName: (tag || 'div').toUpperCase(),
    nodeType: 1,
    nodeName: (tag || 'div').toUpperCase(),
    localName: (tag || 'div').toLowerCase(),
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    prefix: null,
    parentNode: null,
    parentElement: null,
    ownerDocument: doc,
    childNodes: [],
    children: [],
    firstChild: null,
    lastChild: null,
    nextSibling: null,
    previousSibling: null,
    nodeValue: null,
    textContent: '',
    innerHTML: '',
    outerHTML: '',
    id: '',
    className: '',
    classList: { add: noop, remove: noop, contains: () => false, toggle: () => false },
    style: {},
    attributes: {},
    dataset: {},
    offsetWidth: 1920, offsetHeight: 1080,
    clientWidth: 1920, clientHeight: 1080,
    scrollWidth: 1920, scrollHeight: 1080,
    scrollLeft: 0, scrollTop: 0,
    getAttribute: (name) => {
      if (name === 'r' || name === 'm') return 'm';
      return null;
    },
    hasAttribute: () => false,
    setAttribute: noop,
    removeAttribute: noop,
    closest: () => null,
    contains: () => false,
    matches: () => false,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementsByTagName: (tag) => {
      if (tag?.toLowerCase() === 'script') return [];
      if (tag?.toLowerCase() === 'meta') return [];
      return [];
    },
    getElementsByClassName: () => [],
    getElementsByName: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    appendChild: (child) => child,
    removeChild: (child) => child,
    replaceChild: (newChild, old) => old,
    insertBefore: (newChild, ref) => newChild,
    cloneNode: function() { return makeEl(this?.tagName); },
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 1920, height: 1080, top: 0, left: 0, right: 1920, bottom: 1080 }),
    toString: () => `[object HTML${(tag || 'Div').toUpperCase()}Element]`,
  });

  doc.createElement = setNative(function(tag) {
    const el = makeEl(tag);
    console.error(`[ENV] document.createElement("${tag}")`);
    return el;
  }, 'createElement');

  doc.createTextNode = setNative(function(text) {
    return {
      nodeType: 3, nodeName: '#text', nodeValue: text, textContent: text,
      data: text, length: text ? text.length : 0,
      ownerDocument: doc, parentNode: null,
      splitText: () => {},
      toString: () => '[object Text]',
    };
  }, 'createTextNode');

  doc.createDocumentFragment = setNative(function() {
    return {
      nodeType: 11, nodeName: '#document-fragment',
      childNodes: [], children: [], appendChild: noop, removeChild: noop,
      querySelector: () => null, querySelectorAll: () => [],
      toString: () => '[object DocumentFragment]',
    };
  }, 'createDocumentFragment');

  doc.createComment = setNative(function(text) {
    return { nodeType: 8, nodeName: '#comment', nodeValue: text, data: text, textContent: text };
  }, 'createComment');

  doc.getElementById = setNative(function() { return null; }, 'getElementById');
  doc.getElementsByTagName = setNative(function(tag) {
    if (tag?.toLowerCase() === 'script') {
      // Returns HTMLCollection-like - RuiShu might iterate
      const c = { length: 0, item: () => null };
      c[Symbol.iterator] = function* () {};
      return c;
    }
    if (tag?.toLowerCase() === 'meta') {
      const c = { length: 0, item: () => null };
      c[Symbol.iterator] = function* () {};
      return c;
    }
    const c = { length: 0, item: () => null };
    c[Symbol.iterator] = function* () {};
    return c;
  }, 'getElementsByTagName');

  doc.getElementsByClassName = setNative(function() {
    const c = { length: 0, item: () => null };
    c[Symbol.iterator] = function* () {};
    return c;
  }, 'getElementsByClassName');

  doc.getElementsByName = setNative(function() {
    return [];
  }, 'getElementsByName');

  doc.querySelector = setNative(function() { return null; }, 'querySelector');
  doc.querySelectorAll = setNative(function() { return []; }, 'querySelectorAll');

  doc.hasFocus = setNative(() => true, 'hasFocus');
  doc.write = setNative(() => {}, 'write');
  doc.open = setNative(() => {}, 'open');
  doc.close = setNative(() => {}, 'close');
  doc.addEventListener = setNative(doc.addEventListener || (() => {}), 'addEventListener');
  doc.removeEventListener = setNative(() => {}, 'removeEventListener');
  doc.dispatchEvent = setNative(() => true, 'dispatchEvent');
  doc.hasStorageAccess = setNative(() => Promise.resolve(false), 'hasStorageAccess');
  doc.requestStorageAccess = setNative(() => Promise.resolve(), 'requestStorageAccess');

  // document.implementation
  try {
    defGetter(doc, 'implementation', () => ({
      createHTMLDocument: () => doc,
      hasFeature: () => true,
      createDocumentType: () => doc.doctype,
      createDocument: () => doc,
    }));
  } catch (e) {}

  // document.head
  try {
    defGetter(doc, 'head', () => makeEl('head'));
  } catch (e) {}

  // document.body — return jsdom's body if available
  try {
    if (!doc.body) {
      defGetter(doc, 'body', () => makeEl('body'));
    }
  } catch (e) {}

  // document.documentElement
  try {
    if (!doc.documentElement) {
      defGetter(doc, 'documentElement', () => makeEl('html'));
    }
  } catch (e) {}

  // ── 7. window ──
  try {
    defConst(window, 'closed', false);
    defGetter(window, 'opener', () => null);
    defGetter(window, 'parent', () => window);
    defGetter(window, 'top', () => window);
    defGetter(window, 'self', () => window);
    defGetter(window, 'frames', () => window);
    defGetter(window, 'window', () => window);
    defGetter(window, 'frameElement', () => null);
    defGetter(window, 'length', () => 0);
    defGetter(window, 'name', () => '');
    defGetter(window, 'innerWidth', () => 1920);
    defGetter(window, 'innerHeight', () => 937);
    defGetter(window, 'outerWidth', () => 1920);
    defGetter(window, 'outerHeight', () => 1080);
    defGetter(window, 'devicePixelRatio', () => 1);
    defGetter(window, 'screenX', () => 0);
    defGetter(window, 'screenY', () => 0);
    defGetter(window, 'screenLeft', () => 0);
    defGetter(window, 'screenTop', () => 0);
    defGetter(window, 'scrollX', () => 0);
    defGetter(window, 'scrollY', () => 0);
    defGetter(window, 'pageXOffset', () => 0);
    defGetter(window, 'pageYOffset', () => 0);
    defGetter(window, 'isSecureContext', () => true);
    defGetter(window, 'origin', () => 'https://www.ouyeel.com');
    defGetter(window, 'locationbar', () => ({ visible: true }));
    defGetter(window, 'menubar', () => ({ visible: true }));
    defGetter(window, 'personalbar', () => ({ visible: true }));
    defGetter(window, 'scrollbars', () => ({ visible: true }));
    defGetter(window, 'statusbar', () => ({ visible: true }));
    defGetter(window, 'toolbar', () => ({ visible: true }));
    defGetter(window, 'fullScreen', () => false);
  } catch (e) {}

  // ── 8. Window Functions ──
  const winFuncs = {
    close: () => {},
    stop: () => {},
    focus: () => {},
    blur: () => {},
    print: () => {},
    scroll: () => {},
    scrollBy: () => {},
    scrollTo: () => {},
    moveBy: () => {},
    moveTo: () => {},
    resizeBy: () => {},
    resizeTo: () => {},
    open: (url) => { console.error(`[ENV] window.open → ${url}`); return null; },
    alert: (msg) => { console.error(`[ENV] alert: ${msg}`); },
    confirm: () => true,
    prompt: () => null,
    getComputedStyle: (el) => ({
      getPropertyValue: () => '',
      length: 0,
      cssText: '',
      toString: () => '',
    }),
    matchMedia: (q) => ({
      matches: q === '(pointer:fine)' || q === '(hover:hover)' || q === 'screen' || q === 'all',
      media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
    requestAnimationFrame: (cb) => {
      if (typeof cb === 'function') setTimeout(() => cb(Date.now()), 16);
      return 1;
    },
    cancelAnimationFrame: () => {},
    requestIdleCallback: (cb) => {
      if (typeof cb === 'function') setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
      return 1;
    },
    cancelIdleCallback: () => {},
    queueMicrotask: (fn) => { if (typeof fn === 'function') Promise.resolve().then(fn); },
    createImageBitmap: () => Promise.resolve({}),
    postMessage: () => {},
    getSelection: () => ({
      rangeCount: 0, isCollapsed: true, anchorNode: null, focusNode: null,
      toString: () => '', removeAllRanges: () => {}, addRange: () => {},
    }),
    captureEvents: () => {},
    releaseEvents: () => {},
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    structuredClone: (obj) => JSON.parse(JSON.stringify(obj)),
    reportError: () => {},
  };

  for (const [name, fn] of Object.entries(winFuncs)) {
    try {
      window[name] = setNative(fn, name);
    } catch (e) {}
  }

  // ── 9. Performance ──
  const startTime = Date.now() - 5000;
  try {
    defGetter(perf, 'timeOrigin', () => startTime);
    defGetter(perf, 'timing', () => ({
      navigationStart: startTime, unloadEventStart: 0, unloadEventEnd: 0,
      redirectStart: 0, redirectEnd: 0, fetchStart: startTime + 10,
      domainLookupStart: startTime + 15, domainLookupEnd: startTime + 25,
      connectStart: startTime + 25, connectEnd: startTime + 50,
      secureConnectionStart: startTime + 30, requestStart: startTime + 55,
      responseStart: startTime + 200, responseEnd: startTime + 400,
      domLoading: startTime + 500, domInteractive: startTime + 1000,
      domContentLoadedEventStart: startTime + 1100, domContentLoadedEventEnd: startTime + 1150,
      domComplete: startTime + 3000, loadEventStart: startTime + 3200, loadEventEnd: startTime + 3300,
    }));
    defGetter(perf, 'navigation', () => ({
      type: 0, redirectCount: 0,
      toJSON: () => ({ type: 0, redirectCount: 0 }),
    }));
    defGetter(perf, 'memory', () => ({
      jsHeapSizeLimit: 2172649472, totalJSHeapSize: 10000000, usedJSHeapSize: 8000000,
    }));
    perf.now = setNative(() => Date.now() - startTime, 'now');
    perf.getEntries = setNative(() => [], 'getEntries');
    perf.getEntriesByType = setNative(() => [], 'getEntriesByType');
    perf.getEntriesByName = setNative(() => [], 'getEntriesByName');
    perf.mark = setNative(() => {}, 'mark');
    perf.measure = setNative(() => {}, 'measure');
    perf.clearMarks = setNative(() => {}, 'clearMarks');
    perf.clearMeasures = setNative(() => {}, 'clearMeasures');
    perf.clearResourceTimings = setNative(() => {}, 'clearResourceTimings');
    perf.setResourceTimingBufferSize = setNative(() => {}, 'setResourceTimingBufferSize');
  } catch (e) {}

  // ── 10. Canvas 2D (minimal) ──
  try {
    const ctxProto = {
      canvas: null,
      fillStyle: '#000000', strokeStyle: '#000000',
      globalAlpha: 1.0, globalCompositeOperation: 'source-over',
      lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
      font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
      direction: 'ltr',
      shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0,
      _imageData: null,
    };
    const ctxMethods = [
      'fillRect', 'clearRect', 'strokeRect', 'fillText', 'strokeText',
      'beginPath', 'closePath', 'moveTo', 'lineTo', 'quadraticCurveTo',
      'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect',
      'fill', 'stroke', 'clip', 'save', 'restore',
      'scale', 'rotate', 'translate', 'transform', 'setTransform',
      'createLinearGradient', 'createRadialGradient', 'createPattern',
      'drawImage', 'putImageData',
      'addHitRegion', 'removeHitRegion', 'clearHitRegions',
    ];
    const methods = {};
    for (const m of ctxMethods) {
      methods[m] = setNative(() => {}, m);
    }
    methods.measureText = setNative((text) => ({
      width: text ? text.length * 6 : 0,
      actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
    }), 'measureText');

    methods.getImageData = setNative(function() {
      return { width: 300, height: 150, data: { buffer: new ArrayBuffer(180000), length: 180000, '0': 0, '1': 0 } };
    }, 'getImageData');

    methods.createImageData = setNative(function(w, h) {
      return { width: w || 300, height: h || 150, data: [] };
    }, 'createImageData');

    methods.isPointInPath = setNative(() => false, 'isPointInPath');
    methods.isPointInStroke = setNative(() => false, 'isPointInStroke');

    Object.setPrototypeOf(methods, ctxProto);
    defGetter(methods, 'canvas', () => null);

    if (window.HTMLCanvasElement && window.HTMLCanvasElement.prototype) {
      window.HTMLCanvasElement.prototype.getContext = setNative(function(type) {
        if (type === '2d') return methods;
        return null;
      }, 'getContext');
      window.HTMLCanvasElement.prototype.toDataURL = setNative(function() {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      }, 'toDataURL');
      window.HTMLCanvasElement.prototype.toBlob = setNative(function(cb) {
        if (cb) setTimeout(() => cb(new Blob([''], { type: 'image/png' })), 0);
      }, 'toBlob');
      window.HTMLCanvasElement.prototype.captureStream = setNative(() => ({}), 'captureStream');
      window.HTMLCanvasElement.prototype.transferControlToOffscreen = setNative(() => ({}), 'transferControlToOffscreen');
    }
  } catch (e) {}

  // ── 11. WebGL (minimal) ──
  try {
    if (window.WebGLRenderingContext) {
      window.WebGLRenderingContext.prototype.getParameter = setNative(() => {
        return 'WebGL Renderer';
      }, 'getParameter');
      window.WebGLRenderingContext.prototype.getExtension = setNative(() => null, 'getExtension');
      window.WebGLRenderingContext.prototype.getSupportedExtensions = setNative(() => [], 'getSupportedExtensions');
      window.WebGLRenderingContext.prototype.getShaderPrecisionFormat = setNative(() => ({
        rangeMin: 127, rangeMax: 127, precision: 23,
      }), 'getShaderPrecisionFormat');
    }
  } catch (e) {}

  // ── 12. AudioContext / Speech ──
  try {
    if (window.AudioContext) {
      window.AudioContext.prototype.createOscillator = setNative(() => ({
        type: 'sine', frequency: { value: 440 }, detune: { value: 0 },
        start: () => {}, stop: () => {}, connect: () => {}, disconnect: () => {},
        addEventListener: () => {}, removeEventListener: () => {},
      }), 'createOscillator');
      window.AudioContext.prototype.createGain = setNative(() => ({
        gain: { value: 1 }, connect: () => {}, disconnect: () => {},
      }), 'createGain');
      window.AudioContext.prototype.createAnalyser = setNative(() => ({
        fftSize: 2048, frequencyBinCount: 1024, minDecibels: -100, maxDecibels: -30,
        smoothingTimeConstant: 0.8, getFloatFrequencyData: () => {}, getByteFrequencyData: () => {},
        getFloatTimeDomainData: () => {}, getByteTimeDomainData: () => {},
        connect: () => {}, disconnect: () => {},
      }), 'createAnalyser');
      window.AudioContext.prototype.createBuffer = setNative(() => ({}), 'createBuffer');
      window.AudioContext.prototype.createBufferSource = setNative(() => ({
        buffer: null, loop: false, start: () => {}, stop: () => {},
        connect: () => {}, disconnect: () => {},
      }), 'createBufferSource');
      window.AudioContext.prototype.decodeAudioData = setNative(() => Promise.resolve({}), 'decodeAudioData');
      window.AudioContext.prototype.close = setNative(() => Promise.resolve(), 'close');
      window.AudioContext.prototype.resume = setNative(() => Promise.resolve(), 'resume');
    }
  } catch (e) {}

  // ── 13. Promise toString protection ──
  try {
    // Protect Function.prototype.toString
    setNative(Function.prototype.toString, 'toString');
    setNative(Function.prototype.call, 'call');
    setNative(Function.prototype.apply, 'apply');
    setNative(Function.prototype.bind, 'bind');

    // Make window and document have correct toString
    window.toString = () => '[object Window]';
    window[Symbol.toStringTag] = 'Window';
    doc.toString = () => '[object HTMLDocument]';
    doc[Symbol.toStringTag] = 'HTMLDocument';
  } catch (e) {}

  // ── 14. WebSocket / EventSource (no-op) ──
  try {
    if (window.WebSocket) {
      const WS_PROTO = window.WebSocket.prototype;
      WS_PROTO.send = setNative(() => {}, 'send');
      WS_PROTO.close = setNative(() => {}, 'close');
      WS_PROTO.addEventListener = setNative(() => {}, 'addEventListener');
    }
    if (window.EventSource) {
      const ES_PROTO = window.EventSource.prototype;
      ES_PROTO.close = setNative(() => {}, 'close');
      ES_PROTO.addEventListener = setNative(() => {}, 'addEventListener');
    }
  } catch (e) {}

  // ── 15. Error constructor stack trace limit ──
  try {
    Error.stackTraceLimit = 10;
  } catch (e) {}

  // ── 16. Storage ──
  try {
    const storage = {
      _data: new Map(),
      getItem: function(k) { return this._data.get(String(k)) || null; },
      setItem: function(k, v) { this._data.set(String(k), String(v)); },
      removeItem: function(k) { this._data.delete(String(k)); },
      clear: function() { this._data.clear(); },
      key: function(i) { const keys = [...this._data.keys()]; return keys[i] || null; },
      get length() { return this._data.size; },
      toString: () => '[object Storage]',
    };
    defGetter(window, 'localStorage', () => storage);
    defGetter(window, 'sessionStorage', () => {
      const s = Object.create(storage);
      s._data = new Map();
      return s;
    });
  } catch (e) {}

  // ── 17. IndexedDB ──
  try {
    if (window.indexedDB === undefined || window.indexedDB === null) {
      const idbStub = {
        open: () => ({
          result: null, error: null, source: null,
          transaction: null, readyState: 'done',
          onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null,
          addEventListener: () => {}, removeEventListener: () => {},
        }),
        deleteDatabase: () => ({
          onsuccess: null, onerror: null, onblocked: null,
          addEventListener: () => {}, removeEventListener: () => {},
        }),
        databases: () => Promise.resolve([]),
        cmp: () => 0,
      };
      defGetter(window, 'indexedDB', () => idbStub);
    }
  } catch (e) {}

  // ── 18. CustomEvent / MouseEvent / KeyboardEvent ──
  try {
    const eventProto = {
      bubbles: false, cancelable: false, composed: false,
      currentTarget: null, target: null, srcElement: null,
      defaultPrevented: false, returnValue: true,
      eventPhase: 0, timeStamp: Date.now(), type: '',
      isTrusted: true,
      preventDefault: () => {}, stopPropagation: () => {},
      stopImmediatePropagation: () => {},
      initEvent: () => {},
    };
    // RuiShu sometimes creates CustomEvent
    if (window.CustomEvent) {
      window.CustomEvent.prototype.preventDefault = () => {};
    }
  } catch (e) {}

  // ── 19. MutationObserver ──
  try {
    if (window.MutationObserver) {
      window.MutationObserver.prototype.observe = setNative(() => {}, 'observe');
      window.MutationObserver.prototype.disconnect = setNative(() => {}, 'disconnect');
      window.MutationObserver.prototype.takeRecords = setNative(() => [], 'takeRecords');
    }
  } catch (e) {}

  // ── 20. IntersectionObserver ──
  try {
    if (window.IntersectionObserver) {
      window.IntersectionObserver.prototype.observe = setNative(() => {}, 'observe');
      window.IntersectionObserver.prototype.unobserve = setNative(() => {}, 'unobserve');
      window.IntersectionObserver.prototype.disconnect = setNative(() => {}, 'disconnect');
      window.IntersectionObserver.prototype.takeRecords = setNative(() => [], 'takeRecords');
    }
  } catch (e) {}

  // ── 21. ResizeObserver ──
  try {
    if (window.ResizeObserver) {
      window.ResizeObserver.prototype.observe = setNative(() => {}, 'observe');
      window.ResizeObserver.prototype.unobserve = setNative(() => {}, 'unobserve');
      window.ResizeObserver.prototype.disconnect = setNative(() => {}, 'disconnect');
    }
  } catch (e) {}

  // ── 22. History ──
  try {
    if (window.history) {
      defGetter(window.history, 'length', () => 1);
      defGetter(window.history, 'state', () => null);
      window.history.back = setNative(() => {}, 'back');
      window.history.forward = setNative(() => {}, 'forward');
      window.history.go = setNative(() => {}, 'go');
      window.history.pushState = setNative(() => {}, 'pushState');
      window.history.replaceState = setNative(() => {}, 'replaceState');
    }
  } catch (e) {}

  // ── 23. Navigator clientInformation (alias) ──
  try {
    defGetter(window, 'clientInformation', () => nav);
  } catch (e) {}

  // ── 24. Style/ClassList on elements created by jsdom ──
  try {
    // jsdom creates real HTML elements from the parsed HTML.
    // Make sure those real elements have necessary stubs.
    if (doc.body && doc.body.style === undefined) {
      doc.body.style = {};
    }
    if (doc.documentElement && doc.documentElement.style === undefined) {
      doc.documentElement.style = {};
    }
  } catch (e) {}

  console.error('[ENV] 环境注入完成');
  return window;
}

module.exports = { injectEnv, setNative, defGetter };
