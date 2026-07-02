/**
 * env_site.js — 欧冶 (ouyeel.com) 瑞数6 环境补丁
 * =================================================
 *
 * 基于 .claude/env-patch/env_patch.js 通用框架，
 * 仅包含欧冶 RS6 需要的站点专属覆盖。
 * 通用环境属性由 env_patch 提供。
 *
 * 不修改 env_patch.js — 所有差异写在这里。
 */

const { setupEnv, sn } = require('../../../.claude/env-patch/env_patch.js');

// ═══════════════════════════════════════════════════════════════
// 1. 基础环境配置
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: 'https://www.ouyeel.com/steel',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/143.0.0.0 Safari/537.36',
  platform: 'Win32',
  screenWidth: 1920,
  screenHeight: 1080,
  canvas: true,
  webgl: true,           // WebGL ctx + WebGLRenderingContext 全局
  plugins: true,         // navigator.plugins — RS6 可能检测
  storage: true,         // localStorage / sessionStorage
  extraConstructors: true, // 200+ 浏览器构造函数
  crypto: true,           // Web Crypto API
  windowToGlobal: true,   // window === globalThis — RS6 VM 必需
});

// ═══════════════════════════════════════════════════════════════
// 1b. 设置 global 原型链（window instanceof Window）
//     env_patch 未做此设置，但 RS6 可能检测 instanceof。
//     0110 指南显示 windowToGlobal 模式下必须设置原型链。
// ═══════════════════════════════════════════════════════════════
Object.setPrototypeOf(global, Window.prototype);
// 如果 setPrototypeOf 后某些属性失效，手动补丁：
if (typeof global.addEventListener !== 'function') {
  global.addEventListener = Window.prototype.addEventListener;
  global.removeEventListener = Window.prototype.removeEventListener;
  global.dispatchEvent = Window.prototype.dispatchEvent;
}

// ═══════════════════════════════════════════════════════════════
// 2. RS6 专属覆盖
// ═══════════════════════════════════════════════════════════════
//
// 规则：
//   - 函数用 sn() 包装 → toString() 返回 [native code]
//   - 属性用 Object.defineProperty getter（可枚举，对齐浏览器行为）
//   - 原型链方法挂在 prototype 上，实例方法直接赋值
//

// ── 2.1 window.attachEvent — RS6 检测 IE 遗留 API ──
window.attachEvent = function attachEvent(type, handler) {
  var eventName = type.startsWith('on') ? type.slice(2) : type;
  return this.addEventListener(eventName, handler);
};
sn(window.attachEvent, 'attachEvent');

// ── 2.2 window.scrollTo — RS6 有时会调用 ──
window.scrollTo = function scrollTo() {};
sn(window.scrollTo, 'scrollTo');

// ── 2.3 document 元属性 ──
document.URL = 'https://www.ouyeel.com/steel';
document.documentURI = 'https://www.ouyeel.com/steel';
document.compatMode = 'CSS1Compat';
document.inputEncoding = 'UTF-8';
document.contentType = 'text/html';

// ── 2.4 document.all — RS6 检测浏览器模式 ──
// env_patch 已设为 undefined（Chrome 特征），无需重复

// ── 2.5 window.name — RS6 可能读取 ──
window.name = '';

// ── 2.6 暴露 HTMLMetaElement 构造函数 ──
// RS6 可能通过 document.createElement('meta') 创建并检查类型
// 注册到全局
function HTMLMetaElement() {}
Object.setPrototypeOf(HTMLMetaElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLMetaElement.prototype, Symbol.toStringTag, {
  value: 'HTMLMetaElement',
  configurable: true,
});
sn(HTMLMetaElement, 'HTMLMetaElement');
global.HTMLMetaElement = HTMLMetaElement;

// ── 2.7 暴露 HTMLLinkElement （env_patch 未注册为全局） ──
function HTMLLinkElement() {}
Object.setPrototypeOf(HTMLLinkElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLLinkElement.prototype, Symbol.toStringTag, {
  value: 'HTMLLinkElement',
  configurable: true,
});
sn(HTMLLinkElement, 'HTMLLinkElement');
global.HTMLLinkElement = HTMLLinkElement;

// ── 2.8 getComputedStyle — RS6 可能调用 ──
// env_patch 已有 getComputedStyle stub

// ── 2.9 HTMLElement 原型补全 — RS6 通过元素实例调用原型方法 ──
//
//    env_patch 的 HTMLElement.prototype 缺少：
//      - getElementsByTagName  ← RS6 在 createElement('div') 后立即调用
//      - querySelector         ← RS6 可能调用
//      - closest               ← RS6 可能调用
//      - matches               ← RS6 可能调用
//
//    补充 Element 级别的原型方法，使元素实例具备完整浏览器行为。

HTMLElement.prototype.getElementsByTagName = function (tagName) {
  // 元素级的 getElementsByTagName 通常返回空集合
  var tag = String(tagName).toUpperCase();
  // 如果是 meta 标签且当前元素有 content 属性
  if (tag === 'META' && this.getAttribute) {
    var content = this.getAttribute('content');
    if (content) {
      var collection = [this];
      Object.defineProperty(collection, Symbol.toStringTag, {
        value: 'HTMLCollection', configurable: true,
      });
      collection.item = function (i) { return collection[i] || null; };
      collection.namedItem = function () { return null; };
      return collection;
    }
  }
  var emptyCollection = [];
  Object.defineProperty(emptyCollection, Symbol.toStringTag, {
    value: 'HTMLCollection', configurable: true,
  });
  emptyCollection.item = function () { return null; };
  emptyCollection.namedItem = function () { return null; };
  return emptyCollection;
};
sn(HTMLElement.prototype.getElementsByTagName, 'getElementsByTagName');

HTMLElement.prototype.querySelector = function () { return null; };
sn(HTMLElement.prototype.querySelector, 'querySelector');

HTMLElement.prototype.closest = function () { return null; };
sn(HTMLElement.prototype.closest, 'closest');

HTMLElement.prototype.matches = function () { return false; };
sn(HTMLElement.prototype.matches, 'matches');

HTMLElement.prototype.addEventListener = function (type, listener) {
  // no-op stub
};
sn(HTMLElement.prototype.addEventListener, 'addEventListener');

HTMLElement.prototype.removeEventListener = function () {};
sn(HTMLElement.prototype.removeEventListener, 'removeEventListener');

// ── 2.10 确保 style 是实例属性（不是原型共享） ──
//    env_patch 的 HTMLElement.prototype.style = {} 会导致所有元素
//    共享同一个 style 对象。RS6 可能修改 element.style 影响判断。
//    用 getter 确保每个元素有独立的 style 对象。
var _origStyleDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style');
if (_origStyleDesc && !_origStyleDesc.get) {
  // env_patch 是直接赋值，替换为 getter
  Object.defineProperty(HTMLElement.prototype, 'style', {
    get: function () {
      if (!this._style) this._style = {};
      return this._style;
    },
    set: function (v) { this._style = v; },
    configurable: true,
    enumerable: true,
  });
}

// ── 2.11 补齐 HTMLDocument.prototype 上的 DOM 操作方法 ──
//    env_patch 的 HTMLDocument 继承自 EventTarget，不是 Node，
//    所以 document 上没有 appendChild/removeChild。
//    RS6 会在 document 上直接调用这些方法。
HTMLDocument.prototype.appendChild = function (child) {
  return child;
};
sn(HTMLDocument.prototype.appendChild, 'appendChild');

HTMLDocument.prototype.removeChild = function (child) {
  return child;
};
sn(HTMLDocument.prototype.removeChild, 'removeChild');

HTMLDocument.prototype.insertBefore = function () {
  return null;
};
sn(HTMLDocument.prototype.insertBefore, 'insertBefore');

// ── 2.12 覆盖 document.createElement 确保元素属性完整 ──
//    env_patch 的 createElement 不设置 tagName/nodeName/ownerDocument，
//    RS6 可能通过元素反射检测这些属性。
var origCreateElement = document.createElement.bind(document);
document.createElement = function (tagName) {
  var el = origCreateElement(tagName);
  var tagUpper = String(tagName).toUpperCase();
  el.tagName = tagUpper;
  el.nodeName = tagUpper;
  el.ownerDocument = document;
  if (el._style === undefined && !Object.prototype.hasOwnProperty.call(el, '_style')) {
    el._style = {};
  }
  return el;
};
sn(document.createElement, 'createElement');

// ── 2.13 补充 env_patch 未提供的浏览器全局 API ──
//    RS6 环境指纹检测可能检查这些 API 的存在性。
//    indexedDB 在 Chrome 中始终存在，env_patch 未提供。
if (typeof global.indexedDB === 'undefined') {
  function IDBFactory() {}
  IDBFactory.prototype.open = function () {
    var req = { result: null, error: null, readyState: 'done',
      onupgradeneeded: null, onsuccess: null, onerror: null };
    return req;
  };
  IDBFactory.prototype.deleteDatabase = function () {};
  IDBFactory.prototype.cmp = function () { return 0; };
  Object.defineProperty(global, 'indexedDB', {
    value: new IDBFactory(),
    writable: true, configurable: true, enumerable: false,
  });
}

// ── 2.14 修复 document.cookie 为追加/更新模式 ──
//    env_patch 的 cookie setter 是替换（_cookie = v），
//    而浏览器中 document.cookie = "key=val" 是追加或更新同名的。
//    RS6 依次设置多个 cookie 时，先设置的会被后设置的覆盖掉。
(function () {
  var _cookieMap = {};
  var _orderedNames = [];

  // 从已有的 document.cookie 中导入初始值
  function initFromExisting() {
    var current = '';
    try { current = document.cookie || ''; } catch (e) {}
    if (current) {
      current.split(';').forEach(function (p) {
        p = p.trim(); if (!p) return;
        var ei = p.indexOf('=');
        if (ei < 0) return;
        var n = p.slice(0, ei).trim();
        var nl = n.toLowerCase();
        if (['path','expires','domain','max-age','samesite','httponly','secure','comment'].indexOf(nl) >= 0) return;
        if (!_cookieMap[n]) { _cookieMap[n] = p.slice(ei+1).trim(); _orderedNames.push(n); }
      });
    }
  }
  initFromExisting();

  Object.defineProperty(document, 'cookie', {
    get: function () {
      return _orderedNames.map(function (n) { return n + '=' + _cookieMap[n]; }).join('; ');
    },
    set: function (val) {
      if (!val || typeof val !== 'string') return;
      var parts = val.split(';');
      var first = parts[0].trim();
      var ei = first.indexOf('=');
      if (ei < 0) return;
      var name = first.slice(0, ei).trim();
      var value = first.slice(ei+1).trim();
      var nl = name.toLowerCase();
      if (['path','expires','domain','max-age','samesite','httponly','secure','comment'].indexOf(nl) >= 0) return;
      // max-age=0 或 value 为空 -> 删除 cookie
      var shouldDelete = (value === '');
      for (var pi = 1; pi < parts.length; pi++) {
        var attr = parts[pi].trim().toLowerCase();
        if (attr === 'max-age=0' || attr === 'max-age=-1' || (attr.indexOf('max-age=') === 0 && parseInt(attr.split('=')[1], 10) <= 0)) {
          shouldDelete = true;
        }
      }
      if (shouldDelete) {
        if (_cookieMap[name]) {
          delete _cookieMap[name];
          var idx = _orderedNames.indexOf(name);
          if (idx >= 0) _orderedNames.splice(idx, 1);
        }
      } else if (_cookieMap[name]) {
        _cookieMap[name] = value;
      } else {
        _cookieMap[name] = value;
        _orderedNames.push(name);
      }
    },
    configurable: true, enumerable: true,
  });
})();

// ⚠️ 以下内容在 run-time 由 runner.js 动态设置 ──
//   - document.getElementsByTagName('META') → meta content
//   - document.cookie 初始值
//   - setTimeout / setInterval 替换为 no-op
//   - RS6 内联脚本 + 外链 JS 的执行

// ── 2.15 统一 Proxy 包裹（匹配 0110 指南模式） ──
//    RS6 在运行时通过 Proxy 拦截所有属性访问，确保：
//      - 函数访问时自动 .bind(target) 防止 Illegal invocation
//      - 所有属性访问经过统一 logger（调试时）
//      - 不存在属性返回 undefined 而不是抛出
//
//    ⭐ 这是 0110 指南中 setProxyArr 的核心逻辑。
//    必须在所有环境设置完成后执行（最后一步）。
(function () {
  var SILENT_PROPS = new Set([
    'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURI',
    'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
    'JSON', 'Math', 'Reflect', 'Atomics', 'undefined', 'Infinity',
    '-Infinity', 'NaN', 'console', 'Uint8Array', 'ArrayBuffer',
    'eval', 'arguments', 'caller', 'callee', 'Symbol',
  ]);

  function makeHandler(objName) {
    return {
      get: function (target, prop, receiver) {
        if (typeof prop !== 'symbol' && !(prop in target) && !isNaN(prop)) {
          return undefined;
        }
        var value = Reflect.get(target, prop, receiver);
        var propStr = typeof prop === 'symbol' ? prop.toString() : String(prop);
        if (!SILENT_PROPS.has(propStr) && typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      },
      set: function (target, prop, value, receiver) {
        return Reflect.set(target, prop, value, receiver);
      },
    };
  }

  // 对关键 BOM 对象施加 Proxy 包裹
  var TARGETS = ['window', 'document', 'location', 'navigator', 'screen', 'history'];
  TARGETS.forEach(function (name) {
    var obj = globalThis[name];
    if (obj && typeof obj === 'object') {
      globalThis[name] = new Proxy(obj, makeHandler(name));
    }
  });
})();

// ═══════════════════════════════════════════════════════════════
// 3. DEBUG_PROXY 调试（如需排查缺失属性，取消注释）
// ═══════════════════════════════════════════════════════════════
// const { watch: dbgWatch } = require('../../../.claude/env-patch/debug-proxy.js');
// global.window    = dbgWatch(global.window,    'window');
// global.document  = dbgWatch(global.document,  'document');
// global.navigator = dbgWatch(global.navigator, 'navigator');
// global.location  = dbgWatch(global.location,  'location');
// global.screen    = dbgWatch(global.screen,    'screen');
// global.history   = dbgWatch(global.history,   'history');
