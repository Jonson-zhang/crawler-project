#!/usr/bin/env node
/**
 * 测试用户提供的 Gemini 版 env 代码是否能跑通当前 RS6
 * 代码来源: 0110原型链补环境欧冶-瑞数6.md 的 Gemini 优化版
 */
const vm = require('vm');
const https = require('https');

// ── 保存原生引用 ──
const REAL_CONSOLE = console;

// ═══════════════════════════════════════════
// 用户提供的 gemini 版 env 代码（从 markdown 提取并微调）
// ═══════════════════════════════════════════

// 注意：以下代码直接来自 0110 指南的 Gemini 版本，
// 但做了一个关键调整：EventTarget 定义前移到 Window 之前
// （原代码中 Window 引用了 EventTarget，但 EventTarget 在后面定义）

function v_log(...args) { /* 生产环境静默 */ }

const __seenLogKeys = new Set();
function logOnce(key, ...args) {
    if (__seenLogKeys.has(key)) return;
    __seenLogKeys.add(key);
    v_log(...args);
}

function safeFunction(func) {
    if (!Function.prototype.$call) Function.prototype.$call = Function.prototype.call;
    if (!Function.prototype.$toString) Function.prototype.$toString = Function.prototype.toString;
    const sym = Symbol("native_code");
    const fakeToString = function () {
        if (typeof this === "function" && this[sym]) return this[sym];
        return Function.prototype.$toString.call(this);
    };
    Object.defineProperty(Function.prototype, "toString", {
        value: fakeToString, writable: true, configurable: true
    });
    if (typeof func === "function") {
        const name = func.name || "";
        Object.defineProperty(func, sym, {
            value: `function ${name}() { [native code] }`
        });
    }
    return func;
}

// ── EventTarget（提前定义，Window 需要它） ──
const _listeners = Symbol("listeners");
function EventTarget() {}
safeFunction(EventTarget);
EventTarget.prototype.addEventListener = function addEventListener(type, listener) {
    if (!this[_listeners]) { Object.defineProperty(this, _listeners, {value: {}, enumerable: false}); }
    if (!this[_listeners][type]) this[_listeners][type] = [];
    this[_listeners][type].push(listener);
};
EventTarget.prototype.removeEventListener = function removeEventListener(type, listener) {};
EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
    const type = event.type;
    if (this[_listeners] && this[_listeners][type]) {
        this[_listeners][type].forEach(fn => fn.call(this, event));
    }
    return true;
};
safeFunction(EventTarget.prototype.addEventListener);
safeFunction(EventTarget.prototype.removeEventListener);
safeFunction(EventTarget.prototype.dispatchEvent);

// ── Proxy handler ──
const SILENT_PROPS = new Set([
    "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURI",
    "encodeURIComponent", "decodeURI", "decodeURIComponent",
    "JSON", "Math", "Reflect", "Atomics", "undefined", "Infinity",
    "-Infinity", "NaN", "console", "Uint8Array", "ArrayBuffer",
    "eval", "arguments", "caller", "callee"
]);

function createHandler(objName, target) {
    return {
        get(target, prop, receiver) {
            if (typeof prop !== "symbol" && !(prop in target) && !isNaN(prop)) return undefined;
            const value = Reflect.get(target, prop, receiver);
            if (typeof value === "function" && !SILENT_PROPS.has(prop)) {
                return value.bind(target);
            }
            return value;
        },
        set(target, prop, value, receiver) {
            return Reflect.set(target, prop, value, receiver);
        }
    };
}

function watch(obj, name = "anonymous") {
    if (typeof obj !== "object" && typeof obj !== "function") return obj;
    return new Proxy(obj, createHandler(name, obj));
}

function setProxyArr(arr) {
    for (const name of arr) {
        let obj = globalThis[name];
        if (obj === undefined) { obj = {}; globalThis[name] = obj; }
        globalThis[name] = new Proxy(obj, createHandler(name, obj));
    }
}

// ── Window ──
function Window() { EventTarget.call(this); }
Object.setPrototypeOf(Window.prototype, EventTarget.prototype);
Object.defineProperty(Window.prototype, Symbol.toStringTag, { value: "Window", configurable: true });
Window.prototype.attachEvent = function attachEvent(type, listener) {
    return this.addEventListener(type.replace(/^on/, ''), listener);
};
Window.prototype.scrollTo = function scrollTo() {};
Window.prototype.getComputedStyle = function getComputedStyle() { return {}; };
safeFunction(Window);
safeFunction(Window.prototype.attachEvent);
safeFunction(Window.prototype.scrollTo);
safeFunction(Window.prototype.getComputedStyle);

window = globalThis;
Object.setPrototypeOf(window, Window.prototype);
globalThis.Window = Window;
self = window; top = window; parent = window;
Object.defineProperty(window, "ActiveXObject", { value: undefined, writable: true, enumerable: false, configurable: true });

// ── Node → Element → HTMLElement ──
function Node() { EventTarget.call(this); }
Object.setPrototypeOf(Node.prototype, EventTarget.prototype);
safeFunction(Node);
Node.prototype.appendChild = function appendChild(child) { return child; };
Node.prototype.removeChild = function removeChild(child) { return child; };
safeFunction(Node.prototype.appendChild);
safeFunction(Node.prototype.removeChild);

function Element() { Node.call(this); }
Object.setPrototypeOf(Element.prototype, Node.prototype);
safeFunction(Element);
Element.prototype.getAttribute = function getAttribute(name) { return this[name] || null; };
Element.prototype.setAttribute = function setAttribute(name, value) { this[name] = String(value); };
Element.prototype.removeAttribute = function removeAttribute(name) { delete this[name]; };
Element.prototype.getElementsByClassName = function getElementsByClassName() { return []; };
safeFunction(Element.prototype.getAttribute);
safeFunction(Element.prototype.setAttribute);
safeFunction(Element.prototype.removeAttribute);
safeFunction(Element.prototype.getElementsByClassName);

Object.defineProperty(Element.prototype, "style", {
    get: function () { if (!this._style) this._style = {}; return this._style; },
    configurable: true, enumerable: true
});
Object.defineProperty(Element.prototype, "className", {
    get: function () { return this["class"] || ""; },
    set: function (val) { this["class"] = val; },
    configurable: true, enumerable: true
});

// ── HTML 元素构造器 ──
function HTMLMetaElement() { HTMLElement.call(this); }
Object.setPrototypeOf(HTMLMetaElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLMetaElement.prototype, Symbol.toStringTag, {value: "HTMLMetaElement", configurable: true});
safeFunction(HTMLMetaElement);

function HTMLHeadElement() { HTMLElement.call(this); }
Object.setPrototypeOf(HTMLHeadElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLHeadElement.prototype, Symbol.toStringTag, {value: "HTMLHeadElement", configurable: true});
safeFunction(HTMLHeadElement);

function HTMLLinkElement() { HTMLElement.call(this); }
Object.setPrototypeOf(HTMLLinkElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLLinkElement.prototype, Symbol.toStringTag, {value: "HTMLLinkElement", configurable: true});
safeFunction(HTMLLinkElement);

function HTMLElement() { Element.call(this); }
Object.setPrototypeOf(HTMLElement.prototype, Element.prototype);
safeFunction(HTMLElement);

function HTMLDivElement() { HTMLElement.call(this); }
Object.setPrototypeOf(HTMLDivElement.prototype, HTMLElement.prototype);
safeFunction(HTMLDivElement);

function HTMLScriptElement() { HTMLElement.call(this); }
Object.setPrototypeOf(HTMLScriptElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLScriptElement.prototype, Symbol.toStringTag, {value: "HTMLScriptElement", configurable: true});
safeFunction(HTMLScriptElement);
window.HTMLScriptElement = HTMLScriptElement;

// ── tagConstructorMap + virtualNodes ──
const tagConstructorMap = {
    'meta': HTMLMetaElement, 'head': HTMLHeadElement,
    'div': HTMLDivElement, 'script': HTMLScriptElement, 'link': HTMLLinkElement
};
const virtualNodes = {
    get meta() { return [{name: "referrer", content: "PLACEHOLDER_META_CONTENT"}, {"http-equiv": "pragma", content: "no-cache"}]; },
    'head': [{}],
    'base': [{href: "https://www.ouyeel.com/"}],
    'link': [{rel: "stylesheet", href: "style.css"}]
};

Element.prototype.getElementsByTagName = function getElementsByTagName(tagName) {
    const tag = String(tagName).toLowerCase();
    const collection = [];
    if (virtualNodes[tag]) {
        virtualNodes[tag].forEach(data => {
            const Constructor = tagConstructorMap[tag] || HTMLElement;
            const el = new Constructor();
            Object.assign(el, data);
            collection.push(watch(el, `Element<${tag}>`));
        });
    }
    Object.defineProperty(collection, Symbol.toStringTag, {value: "HTMLCollection"});
    return watch(collection, "HTMLCollection");
};
safeFunction(Element.prototype.getElementsByTagName);

// ── Document ──
function Document() { Node.call(this); }
Object.setPrototypeOf(Document.prototype, Node.prototype);
Document.prototype.createElement = function createElement(tagName) {
    const tag = String(tagName).toLowerCase();
    let element;
    switch (tag) {
        case 'div': element = new HTMLDivElement(); break;
        case 'script': element = new HTMLScriptElement(); break;
        default: element = new HTMLElement();
    }
    element.tagName = tag.toUpperCase();
    element.nodeName = tag.toUpperCase();
    return watch(element, `element <${tag}>`);
};
Document.prototype.getElementById = function getElementById(id) {
    const element = new HTMLDivElement();
    Object.defineProperty(element, 'id', {value: id, enumerable: true});
    return watch(element, `Element(id:${id})`);
};
Document.prototype.getElementsByName = function getElementsByName(name) {
    const collection = [];
    const element = new HTMLDivElement();
    element.name = name;
    collection.push(watch(element, `Element(name:${name})`));
    Object.defineProperty(collection, Symbol.toStringTag, {value: "NodeList"});
    return watch(collection, "NodeList");
};
Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
Document.prototype.getElementsByClassName = Element.prototype.getElementsByClassName;
safeFunction(Document);
safeFunction(Document.prototype.createElement);
safeFunction(Document.prototype.getElementById);
safeFunction(Document.prototype.getElementsByName);
Object.defineProperty(Document.prototype, Symbol.toStringTag, {value: "HTMLDocument", configurable: true});

const documentInstance = new Document();
globalThis.Document = Document;
globalThis.HTMLDocument = Document;
window.document = documentInstance;
globalThis.document = documentInstance;
document.body = watch(new HTMLDivElement(), "document.body");

// ── Navigator ──
function Navigator() {}
safeFunction(Navigator);
Object.defineProperty(Navigator.prototype, Symbol.toStringTag, {value: "Navigator", configurable: true});
Navigator.prototype.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/143.0.0.0 Safari/537.36";
const navigatorInstance = new Navigator();
window.navigator = navigatorInstance;
globalThis.navigator = navigatorInstance;
globalThis.Navigator = Navigator;

// ── Screen ──
function Screen() {}
safeFunction(Screen);
Object.defineProperty(Screen.prototype, Symbol.toStringTag, {value: "Screen", configurable: true});
Screen.prototype.width = 1920; Screen.prototype.height = 1080;
Screen.prototype.availWidth = 1920; Screen.prototype.availHeight = 1040;
const screenInstance = new Screen();
window.screen = screenInstance;
globalThis.screen = screenInstance;
globalThis.Screen = Screen;

// ── History ──
function History() {}
safeFunction(History);
Object.defineProperty(History.prototype, Symbol.toStringTag, {value: "History", configurable: true});
History.prototype.length = 1; History.prototype.state = null;
const historyInstance = new History();
window.history = historyInstance;
globalThis.history = historyInstance;
globalThis.History = History;

// ── Location ──
function Location() {
    let _url = new URL("https://www.ouyeel.com/steel");
    const props = ["href", "protocol", "host", "hostname", "port", "pathname", "search", "hash", "origin"];
    props.forEach(prop => {
        Object.defineProperty(this, prop, {
            get() { return _url[prop]; },
            set(v) {
                if (prop === "href") { try { _url = new URL(String(v)); } catch(e) {} }
                else { try { let t = new URL(_url.href); t[prop] = String(v); _url = t; } catch(e) {} }
            },
            enumerable: true, configurable: false
        });
    });
    Object.defineProperty(this, Symbol.toStringTag, {value: "Location", configurable: true});
}
Location.prototype.toString = function toString() { return this.href; };
safeFunction(Location.prototype.toString);
const _location = new Location();
location = watch(_location, "location");
["href", "protocol", "host"].forEach(p => {
    Object.defineProperty(Location.prototype, p, {enumerable: false, value: undefined});
});

// ── 挂 Proxy ──
setProxyArr(["window", "document", "location", "history", "screen", "navigator"]);

// ── cookie（简洁实现） ──
let _cookieStore = {};
Object.defineProperty(document.constructor.prototype, 'cookie', {
    get: function() {
        return Object.keys(_cookieStore).map(k => k + '=' + _cookieStore[k]).join('; ');
    },
    set: function(val) {
        if (!val) return;
        const parts = val.split(';');
        const first = parts[0].trim();
        const ei = first.indexOf('=');
        if (ei < 0) return;
        const name = first.slice(0, ei).trim();
        const value = first.slice(ei+1).trim();
        const nl = name.toLowerCase();
        if (['path','expires','domain','max-age','samesite','httponly','secure','comment'].indexOf(nl) >= 0) return;
        // max-age=0 或空值 -> 删除
        let shouldDelete = (value === '');
        for (let pi = 1; pi < parts.length; pi++) {
            const attr = parts[pi].trim().toLowerCase();
            if (attr === 'max-age=0' || attr.indexOf('max-age=') === 0 && parseInt(attr.split('=')[1], 10) <= 0) shouldDelete = true;
        }
        if (shouldDelete) { delete _cookieStore[name]; }
        else { _cookieStore[name] = value; }
    },
    configurable: true, enumerable: true,
});

// ═══════════════════════════════════════════
// 测试：下载页面并执行 RS6
// ═══════════════════════════════════════════

global.setTimeout = function(){};
global.setInterval = function(){};

async function fetchBody(url) {
    return new Promise(r => {
        let d = '';
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            res.setEncoding('utf8');
            res.on('data', c => d += c);
            res.on('end', () => r(d));
        });
    });
}

async function main() {
    const html = await fetchBody('https://www.ouyeel.com/steel');

    // meta content
    const metaRe = /<meta[^>]+content=["']([^"']+)["']/gi;
    let m, mc = '';
    while ((m = metaRe.exec(html)) !== null) mc = m[1];

    // 注入 meta content 到 virtualNodes
    virtualNodes.meta = [{name: "referrer", content: mc}];

    // 提取脚本
    const scripts = [];
    const re = /<script\s*([^>]*)>([\s\S]*?)<\/script>/gi;
    while ((m = re.exec(html)) !== null) {
        const attrs = m[1], content = (m[2] || '').trim();
        const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
        if (srcMatch) {
            let u = srcMatch[1];
            if (!u.startsWith('http')) u = 'https://www.ouyeel.com' + (u.startsWith('/') ? '' : '/') + u;
            scripts.push({ type: 'external', url: u });
        } else if (content) {
            scripts.push({ type: 'inline', code: content });
        }
    }

    // 按序执行
    for (let i = 0; i < scripts.length; i++) {
        const s = scripts[i];
        if (s.type === 'inline') {
            try { vm.runInThisContext(s.code, { filename: 's' + i + '.js', timeout: 30000, displayErrors: false }); }
            catch (e) { console.error('inline #' + i + ':', e.message.slice(0, 80)); }
        } else {
            console.error('fetching external JS...');
            const ext = await fetchBody(s.url);
            console.error('running ' + ext.length + 'b...');
            const t0 = Date.now();
            try { vm.runInThisContext(ext, { filename: 'ext.js', timeout: 60000, displayErrors: true }); }
            catch (e) { console.error('FAIL after', Date.now()-t0, 'ms:', e.message.slice(0, 100)); }
            console.error('OK in', Date.now()-t0, 'ms');
        }
    }

    // 触发事件
    try { vm.runInThisContext('window.dispatchEvent(new Event("load"))', { filename: 'load.js', timeout: 5000 }); }
    catch (e) { console.error('load event error:', e.message.slice(0, 80)); }

    const cookie = vm.runInThisContext('document.cookie', { filename: 'get.js', timeout: 5000 });
    console.error('\nCookie:', cookie.length, 'bytes');
    console.log(cookie);
}

main().catch(e => console.error('FATAL:', e.message));
