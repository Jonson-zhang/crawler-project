/************************************************************
 * 通用 RS6 补环境框架
 *
 * 可复用于不同 RS6 站点（兰州交通大学/欧冶/深圳大学/国家专利局等）。
 * 用法：
 *   require("./env_framework");
 *   然后加载目标站点的 RS VM 代码即可。
 *
 * 核心思路：
 *   1. 构建完整的浏览器原型链（EventTarget→Node→Element→HTMLElement）
 *   2. Proxy 监控所有对象访问（调试模式），发现缺失立即补
 *   3. 生产模式关闭日志，性能最优
 ************************************************************/

const DEBUG_MODE = false;  // true=打印所有 GET/SET 日志, false=静默

/************************************************************
 * 模块 0：日志系统
 ************************************************************/
function v_log(...args) { if (DEBUG_MODE) console.log(...args); }

const __seenLogKeys = new Set();
function logOnce(key, ...args) {
    if (__seenLogKeys.has(key)) return;
    __seenLogKeys.add(key);
    if (DEBUG_MODE) v_log(...args);
}

/************************************************************
 * 模块 1：safeFunction — toString 伪装为 [native code]
 ************************************************************/
const nativeCodeStr = " { [native code] }";

function safeFunction(func) {
    if (typeof func !== "function") return func;
    const name = func.name || "";
    const fake = `function ${name}()` + nativeCodeStr;
    Object.defineProperty(func, "toString", {
        value: function () { return fake; },
        writable: false, enumerable: false, configurable: true
    });
    return func;
}

/************************************************************
 * 模块 2：Proxy 监控器
 ************************************************************/
function createHandler(objName, target) {
    return {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            const propStr = typeof prop === "symbol" ? prop.toString() : String(prop);
            if (DEBUG_MODE) {
                const key = objName + "." + propStr;
                logOnce("get:" + key, `[GET] ${objName}.${propStr}`, typeof value === "function" ? "function" : value);
                if (value === undefined && !String(prop).startsWith("Symbol(")) {
                    logOnce("undefined:" + key, `[WARN] ${objName}.${propStr} -> undefined`);
                }
            }
            if (typeof value === "function") {
                return value.bind(target);
            }
            return value;
        },
        set(target, prop, value, receiver) {
            const propStr = typeof prop === "symbol" ? prop.toString() : String(prop);
            if (DEBUG_MODE) v_log(`[SET] ${objName}.${propStr} =`, value);
            return Reflect.set(target, prop, value, receiver);
        }
    };
}

function watch(obj, name) {
    return new Proxy(obj, createHandler(name, obj));
}

/************************************************************
 * 模块 3：EventTarget — 事件系统基类
 ************************************************************/
function EventTarget() {}

EventTarget.prototype.addEventListener = function (type, listener) {
    v_log(`[Event] addEventListener("${type}")`);
};
EventTarget.prototype.removeEventListener = function (type, listener) {
    v_log(`[Event] removeEventListener("${type}")`);
};
EventTarget.prototype.dispatchEvent = function (event) {
    v_log(`[Event] dispatchEvent("${event && event.type}")`);
    return true;
};

safeFunction(EventTarget);
safeFunction(EventTarget.prototype.addEventListener);
safeFunction(EventTarget.prototype.removeEventListener);
safeFunction(EventTarget.prototype.dispatchEvent);

/************************************************************
 * 模块 4：DOM 原型链 (Node → Element → HTMLElement)
 ************************************************************/

// --- HTMLCollection ---
function HTMLCollection(list) {
    if (!list) list = [];
    list.item = function (i) { return list[i] || null; };
    list.namedItem = function (name) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === name || (list[i].name === name)) return list[i];
        }
        return null;
    };
    safeFunction(list.item);
    safeFunction(list.namedItem);
    return watch(list, "HTMLCollection");
}
Object.defineProperty(HTMLCollection.prototype, Symbol.toStringTag, {
    value: "HTMLCollection", configurable: true
});
safeFunction(HTMLCollection);

// --- Node (继承 EventTarget) ---
function Node() {}
Node.prototype = Object.create(EventTarget.prototype);
Node.prototype.constructor = Node;

Node.prototype.appendChild = function (child) { return child; };
Node.prototype.removeChild = function (child) { return child; };
Node.prototype.replaceChild = function (newChild, oldChild) { return oldChild; };
Node.prototype.insertBefore = function (newChild, ref) { return newChild; };
Node.prototype.cloneNode = function () { return this; };
Node.prototype.contains = function () { return false; };
Node.prototype.hasChildNodes = function () { return false; };

safeFunction(Node);
safeFunction(Node.prototype.appendChild);
safeFunction(Node.prototype.removeChild);
safeFunction(Node.prototype.replaceChild);
safeFunction(Node.prototype.insertBefore);
safeFunction(Node.prototype.cloneNode);
safeFunction(Node.prototype.contains);
safeFunction(Node.prototype.hasChildNodes);

// --- Element (继承 Node) ---
function Element() {}
Element.prototype = Object.create(Node.prototype);
Element.prototype.constructor = Element;

Element.prototype.getAttribute = function (name) {
    return (this.attributes && this.attributes[name]) || null;
};
Element.prototype.setAttribute = function (name, value) {
    if (!this.attributes) this.attributes = {};
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name === "name") this.name = String(value);
    if (name === "class") this.className = String(value);
    if (name === "content") this.content = String(value);
};
Element.prototype.removeAttribute = function (name) {
    if (this.attributes) delete this.attributes[name];
};
Element.prototype.getElementsByTagName = function (tag) {
    var t = String(tag).toLowerCase();
    return HTMLCollection([]);
};
Element.prototype.getElementsByClassName = function (cls) {
    return HTMLCollection([]);
};
Element.prototype.matches = function () { return false; };
Element.prototype.closest = function () { return null; };

// style 属性
Object.defineProperty(Element.prototype, "style", {
    get: function () {
        if (!this._style) this._style = watch({}, this.tagName + ".style");
        return this._style;
    },
    configurable: true, enumerable: true
});

// className
Object.defineProperty(Element.prototype, "className", {
    get: function () { return this.attributes ? (this.attributes["class"] || "") : ""; },
    set: function (v) { this.setAttribute("class", String(v)); },
    configurable: true, enumerable: true
});

// innerHTML
Object.defineProperty(Element.prototype, "innerHTML", {
    get: function () { return this._innerHTML || ""; },
    set: function (v) { this._innerHTML = String(v); },
    configurable: true, enumerable: true
});

// outerHTML
Object.defineProperty(Element.prototype, "outerHTML", {
    get: function () { return "<" + (this.tagName || "div") + "></" + (this.tagName || "div") + ">"; },
    configurable: true, enumerable: true
});

// textContent
Object.defineProperty(Element.prototype, "textContent", {
    get: function () { return this._textContent || ""; },
    set: function (v) { this._textContent = String(v); },
    configurable: true, enumerable: true
});

// children
Object.defineProperty(Element.prototype, "children", {
    get: function () { return HTMLCollection([]); },
    configurable: true, enumerable: true
});

// firstElementChild / lastElementChild
Object.defineProperty(Element.prototype, "firstElementChild", {
    get: function () { return null; }, configurable: true
});
Object.defineProperty(Element.prototype, "lastElementChild", {
    get: function () { return null; }, configurable: true
});

// parentElement / parentNode
Object.defineProperty(Element.prototype, "parentElement", {
    get: function () { return document.body || null; }, configurable: true
});
Object.defineProperty(Element.prototype, "parentNode", {
    get: function () { return document.body || null; }, configurable: true
});

safeFunction(Element);
safeFunction(Element.prototype.getAttribute);
safeFunction(Element.prototype.setAttribute);
safeFunction(Element.prototype.removeAttribute);
safeFunction(Element.prototype.getElementsByTagName);
safeFunction(Element.prototype.getElementsByClassName);
safeFunction(Element.prototype.matches);
safeFunction(Element.prototype.closest);

// --- HTMLElement (继承 Element) ---
function HTMLElement() {}
HTMLElement.prototype = Object.create(Element.prototype);
HTMLElement.prototype.constructor = HTMLElement;

// offsetHeight / offsetWidth 等布局属性
["offsetHeight", "offsetWidth", "offsetTop", "offsetLeft",
 "clientHeight", "clientWidth", "clientTop", "clientLeft",
 "scrollHeight", "scrollWidth", "scrollTop", "scrollLeft"
].forEach(function (p) {
    Object.defineProperty(HTMLElement.prototype, p, {
        get: function () { return 0; }, configurable: true
    });
});

safeFunction(HTMLElement);

// --- 具体 HTML 元素构造函数 ---
function HTMLDivElement() { HTMLElement.call(this); this.tagName = "DIV"; this.nodeName = "DIV"; }
HTMLDivElement.prototype = Object.create(HTMLElement.prototype);
Object.defineProperty(HTMLDivElement.prototype, Symbol.toStringTag, { value: "HTMLDivElement" });
safeFunction(HTMLDivElement);

function HTMLMetaElement() { HTMLElement.call(this); this.tagName = "META"; this.nodeName = "META"; }
HTMLMetaElement.prototype = Object.create(HTMLElement.prototype);
Object.defineProperty(HTMLMetaElement.prototype, Symbol.toStringTag, { value: "HTMLMetaElement" });
safeFunction(HTMLMetaElement);

function HTMLScriptElement() { HTMLElement.call(this); this.tagName = "SCRIPT"; this.nodeName = "SCRIPT"; }
HTMLScriptElement.prototype = Object.create(HTMLElement.prototype);
Object.defineProperty(HTMLScriptElement.prototype, Symbol.toStringTag, { value: "HTMLScriptElement" });
safeFunction(HTMLScriptElement);

function HTMLHeadElement() { HTMLElement.call(this); this.tagName = "HEAD"; this.nodeName = "HEAD"; }
HTMLHeadElement.prototype = Object.create(HTMLElement.prototype);
safeFunction(HTMLHeadElement);

function HTMLBodyElement() { HTMLElement.call(this); this.tagName = "BODY"; this.nodeName = "BODY"; }
HTMLBodyElement.prototype = Object.create(HTMLElement.prototype);
safeFunction(HTMLBodyElement);

function HTMLFormElement() { HTMLElement.call(this); this.tagName = "FORM"; this.nodeName = "FORM"; }
HTMLFormElement.prototype = Object.create(HTMLElement.prototype);
safeFunction(HTMLFormElement);

function HTMLInputElement() { HTMLElement.call(this); this.tagName = "INPUT"; this.nodeName = "INPUT"; }
HTMLInputElement.prototype = Object.create(HTMLElement.prototype);
safeFunction(HTMLInputElement);

function HTMLAnchorElement() { HTMLElement.call(this); this.tagName = "A"; this.nodeName = "A"; }
HTMLAnchorElement.prototype = Object.create(HTMLElement.prototype);
safeFunction(HTMLAnchorElement);

function HTMLImageElement() { HTMLElement.call(this); this.tagName = "IMG"; this.nodeName = "IMG"; }
HTMLImageElement.prototype = Object.create(HTMLElement.prototype);
safeFunction(HTMLImageElement);

function HTMLIFrameElement() { HTMLElement.call(this); this.tagName = "IFRAME"; this.nodeName = "IFRAME"; }
HTMLIFrameElement.prototype = Object.create(HTMLElement.prototype);
safeFunction(HTMLIFrameElement);

// 映射表
var tagConstructorMap = {
    "div": HTMLDivElement, "meta": HTMLMetaElement, "script": HTMLScriptElement,
    "head": HTMLHeadElement, "body": HTMLBodyElement, "form": HTMLFormElement,
    "input": HTMLInputElement, "a": HTMLAnchorElement, "img": HTMLImageElement,
    "iframe": HTMLIFrameElement
};

/************************************************************
 * 模块 5：Document
 ************************************************************/
function Document() {}
Document.prototype = Object.create(Node.prototype);
Document.prototype.constructor = Document;
Object.defineProperty(Document.prototype, Symbol.toStringTag, { value: "HTMLDocument" });

Document.prototype.createElement = function (tagName) {
    var tag = String(tagName).toUpperCase();
    var Ctor = tagConstructorMap[tag.toLowerCase()] || HTMLElement;
    var el = Object.create(Ctor.prototype);
    Ctor.call(el);
    el.tagName = tag;
    el.nodeName = tag;
    el.attributes = {};
    return el;
};

// getElementsByTagName — RS6 核心：必须返回 meta 标签
Document.prototype.getElementsByTagName = function (tagName) {
    var tag = String(tagName).toUpperCase();
    var res = [];
    if (tag === "META") {
        var meta = this.createElement("META");
        // metacontent 由 loader.js 中的全局变量提供
        meta.setAttribute("content", globalThis.__metacontent || "");
        res.push(meta);
    }
    return HTMLCollection(res);
};

Document.prototype.getElementById = function (id) { return null; };
Document.prototype.querySelector = function (sel) { return null; };

Document.prototype.querySelectorAll = function (sel) {
    var res = [];
    res.item = function (i) { return res[i] || null; };
    return res;
};

Document.prototype.getElementsByClassName = function (cls) { return HTMLCollection([]); };
Document.prototype.getElementsByName = function (name) { return HTMLCollection([]); };
Document.prototype.createDocumentFragment = function () { return this.createElement("DIV"); };
Document.prototype.createTextNode = function (text) { return this.createElement("DIV"); };
Document.prototype.createComment = function (text) { return this.createElement("DIV"); };

// documentElement / head / body
Object.defineProperty(Document.prototype, "documentElement", {
    get: function () { return this.createElement("HTML"); }, configurable: true
});
Object.defineProperty(Document.prototype, "head", {
    get: function () { return this.createElement("HEAD"); }, configurable: true
});
Object.defineProperty(Document.prototype, "body", {
    get: function () { return this.createElement("BODY"); }, configurable: true
});

// cookie - RS6 最终写入在这里
Document.prototype._cookie = "";
Object.defineProperty(Document.prototype, "cookie", {
    get: function () { return this._cookie; },
    set: function (v) {
        this._cookie = String(v);
        v_log("[COOKIE SET]", v.substring(0, 100) + "...");
    },
    configurable: true, enumerable: true
});

// 兼容 document.all (typeof === "undefined" 是 RS 检测点)
Object.defineProperty(Document.prototype, "all", {
    get: function () { return undefined; }, configurable: true
});

// 兼容 document.readyState
Object.defineProperty(Document.prototype, "readyState", {
    get: function () { return "complete"; }, configurable: true
});

// 兼容 document.domain / document.URL / document.title 等
Object.defineProperty(Document.prototype, "domain", {
    get: function () { return location.hostname; }, configurable: true
});
Object.defineProperty(Document.prototype, "URL", {
    get: function () { return location.href; }, configurable: true
});
Object.defineProperty(Document.prototype, "title", {
    get: function () { return ""; }, set: function () {}, configurable: true
});

safeFunction(Document);
safeFunction(Document.prototype.createElement);
safeFunction(Document.prototype.getElementsByTagName);
safeFunction(Document.prototype.getElementById);
safeFunction(Document.prototype.querySelector);
safeFunction(Document.prototype.querySelectorAll);
safeFunction(Document.prototype.getElementsByClassName);
safeFunction(Document.prototype.createDocumentFragment);

// 实例化
var documentInstance = new Document();
globalThis.Document = Document;

/************************************************************
 * 模块 6：Window + BOM 对象
 ************************************************************/

// --- Window ---
function Window() {}
Window.prototype = Object.create(EventTarget.prototype);
Window.prototype.constructor = Window;

Window.prototype.attachEvent = function (type, listener) {
    return this.addEventListener(type.replace(/^on/, ""), listener);
};
Window.prototype.scrollTo = function () {};
Window.prototype.scrollBy = function () {};
Window.prototype.open = function () { return null; };
Window.prototype.close = function () {};
Window.prototype.focus = function () {};
Window.prototype.blur = function () {};
Window.prototype.print = function () {};
Window.prototype.stop = function () {};
Window.prototype.postMessage = function () {};
Window.prototype.getComputedStyle = function () { return watch({}, "ComputedStyle"); };
Window.prototype.requestAnimationFrame = function (cb) { return 0; };
Window.prototype.cancelAnimationFrame = function () {};
Window.prototype.getSelection = function () { return null; };
Window.prototype.matchMedia = function () { return { matches: false, media: "", addListener: function () {} }; };

// setTimeout / setInterval 置空（RS 会检查是否被篡改）
Window.prototype.setTimeout = function () { return 0; };
Window.prototype.setInterval = function () { return 0; };
Window.prototype.clearTimeout = function () {};
Window.prototype.clearInterval = function () {};

safeFunction(Window);
safeFunction(Window.prototype.attachEvent);
safeFunction(Window.prototype.scrollTo);
safeFunction(Window.prototype.open);

// 创建 window 实例 — DEBUG_MODE=true 时 window = globalThis
var windowInstance;
if (DEBUG_MODE) {
    windowInstance = globalThis;
    Object.setPrototypeOf(windowInstance, Window.prototype);
    if (!windowInstance.addEventListener) {
        windowInstance.addEventListener = Window.prototype.addEventListener.bind(windowInstance);
        windowInstance.removeEventListener = Window.prototype.removeEventListener.bind(windowInstance);
        windowInstance.dispatchEvent = Window.prototype.dispatchEvent.bind(windowInstance);
        windowInstance.attachEvent = Window.prototype.attachEvent.bind(windowInstance);
    }
} else {
    windowInstance = new Window();
    Object.setPrototypeOf(windowInstance, Window.prototype);
}

// 全局映射
globalThis.window = windowInstance;
globalThis.self = windowInstance;
globalThis.top = windowInstance;
globalThis.parent = windowInstance;
globalThis.globalThis = windowInstance;

// 暴露 window 上的关键类
windowInstance.HTMLCollection = HTMLCollection;
windowInstance.HTMLDivElement = HTMLDivElement;
windowInstance.HTMLScriptElement = HTMLScriptElement;
windowInstance.HTMLMetaElement = HTMLMetaElement;

// --- Navigator ---
function Navigator() {}
safeFunction(Navigator);
Object.defineProperty(Navigator.prototype, Symbol.toStringTag, { value: "Navigator" });
Object.defineProperty(Navigator.prototype, "userAgent", {
    get: function () {
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
    }, configurable: true
});
Object.defineProperty(Navigator.prototype, "webdriver", { get: function () { return false; }, configurable: true });
Object.defineProperty(Navigator.prototype, "language", { get: function () { return "zh-CN"; }, configurable: true });
Object.defineProperty(Navigator.prototype, "platform", { get: function () { return "Win32"; }, configurable: true });
Object.defineProperty(Navigator.prototype, "cookieEnabled", { get: function () { return true; }, configurable: true });
Object.defineProperty(Navigator.prototype, "plugins", {
    get: function () { return []; }, configurable: true
});

var navigatorInstance = new Navigator();
windowInstance.navigator = navigatorInstance;
globalThis.navigator = navigatorInstance;

// --- Screen ---
function Screen() {}
safeFunction(Screen);
Object.defineProperty(Screen.prototype, Symbol.toStringTag, { value: "Screen" });
Screen.prototype.width = 1920;
Screen.prototype.height = 1080;
Screen.prototype.availWidth = 1920;
Screen.prototype.availHeight = 1040;
Screen.prototype.colorDepth = 24;
Screen.prototype.pixelDepth = 24;

var screenInstance = new Screen();
windowInstance.screen = screenInstance;
globalThis.screen = screenInstance;

// --- History ---
function History() {}
safeFunction(History);
Object.defineProperty(History.prototype, Symbol.toStringTag, { value: "History" });
History.prototype.length = 1;
History.prototype.state = null;
History.prototype.back = function () {};
History.prototype.forward = function () {};
History.prototype.go = function () {};
History.prototype.pushState = function () {};
History.prototype.replaceState = function () {};

var historyInstance = new History();
windowInstance.history = historyInstance;
globalThis.history = historyInstance;

// --- Location ---
function Location() {
    var _url = new URL("https://zbzx.lzjtu.edu.cn/zbxx/hwl.htm");
    var props = ["href", "protocol", "host", "hostname", "port", "pathname", "search", "hash", "origin"];
    var self = this;
    props.forEach(function (prop) {
        Object.defineProperty(self, prop, {
            get: function () { return _url[prop]; },
            set: function (v) {
                if (prop === "href") {
                    try { _url = new URL(String(v)); } catch (e) {}
                }
            },
            enumerable: true, configurable: true
        });
    });
    Object.defineProperty(this, Symbol.toStringTag, { value: "Location", configurable: true });
}
safeFunction(Location);
Location.prototype.toString = function () { return this.href; };
Location.prototype.reload = function () {};
Location.prototype.replace = function (url) {};
Location.prototype.assign = function (url) {};
safeFunction(Location.prototype.toString);
safeFunction(Location.prototype.reload);

var locationInstance = new Location();
windowInstance.location = locationInstance;
globalThis.location = locationInstance;

// --- 特殊环境指纹 ---
// ActiveXObject — Chrome 中是 undefined 而非不存在
try {
    Object.defineProperty(windowInstance, "ActiveXObject", {
        value: undefined, writable: true, enumerable: false, configurable: true
    });
} catch (e) {}

// Chrome 特有对象
windowInstance.chrome = { loadTimes: function () {}, csi: function () {} };
windowInstance.external = {};

// 屏蔽定时器（RS 会检测是否被重写）
globalThis.setTimeout = function () { return 0; };
globalThis.setInterval = function () { return 0; };
globalThis.clearTimeout = function () {};
globalThis.clearInterval = function () {};

// 挂载 document 到 window 和 globalThis
windowInstance.document = documentInstance;
globalThis.document = documentInstance;
globalThis.Document = Document;

/************************************************************
 * 模块 7：挂 Proxy 监控
 ************************************************************/
if (DEBUG_MODE) {
    v_log("[DEBUG] 开启 Proxy 监控");
    window = watch(windowInstance, "window");
    document = watch(documentInstance, "document");
    navigator = watch(navigatorInstance, "navigator");
    location = watch(locationInstance, "location");
    screen = watch(screenInstance, "screen");
    history = watch(historyInstance, "history");
} else {
    // 生产模式只包裹关键对象
    window = watch(windowInstance, "window");
    document = watch(documentInstance, "document");
}

v_log("[ENV] 环境初始化完毕");
