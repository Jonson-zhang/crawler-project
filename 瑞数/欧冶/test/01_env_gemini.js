/************************************************************
 * 模块 0：日志去重（方案 1：同一属性只打印一次）
 ************************************************************/

function v_log(...args) {
    console.log(...args);
}

const __seenLogKeys = new Set();

function logOnce(key, ...args) {
    if (__seenLogKeys.has(key)) return;
    __seenLogKeys.add(key);
    v_log(...args);
}

/************************************************************
 * 模块 1：核心基础设施（Proxy + safeFunction + Window）
 ************************************************************/

function safeFunction(func) {
    if (!Function.prototype.$call) Function.prototype.$call = Function.prototype.call;
    if (!Function.prototype.$toString) Function.prototype.$toString = Function.prototype.toString;

    const sym = Symbol("native_code");

    const fakeToString = function () {
        if (typeof this === "function" && this[sym]) {
            return this[sym];
        }
        return Function.prototype.$toString.call(this);
    };

    Object.defineProperty(Function.prototype, "toString", {
        value: fakeToString,
        writable: true,
        configurable: true
    });

    if (typeof func === "function") {
        const name = func.name || "";
        Object.defineProperty(func, sym, {
            value: `function ${name}() { [native code] }`
        });
    }

    return func;
}

function createHandler(objName, target) {
    const SILENT_PROPS = new Set([
        "isNaN", "isFinite", "parseInt", "parseFloat", "encodeURI",
        "encodeURIComponent", "decodeURI", "decodeURIComponent",
        "JSON", "Math", "Reflect", "Atomics", "undefined", "Infinity",
        "-Infinity", "NaN", "console", "Uint8Array", "ArrayBuffer",
        "eval", "arguments", "caller", "callee"
    ]);

    return {
        get(target, prop, receiver) {
            // ⭐ 修复：先判断 prop 是否为 Symbol，避免 isNaN 报错
            if (typeof prop !== "symbol" && !(prop in target) && !isNaN(prop)) {
                return undefined;
            }

            const value = Reflect.get(target, prop, receiver);
            const propStr = typeof prop === "symbol" ? prop.toString() : String(prop);
            const key = objName + "." + propStr;

            if (!SILENT_PROPS.has(propStr)) {
                logOnce("get:" + key, "方法:", "get", "对象:", objName, "属性:", propStr, "属性值:", value, "类型:", typeof value);
            }

            if (value === undefined) {
                logOnce("undefined:" + key, "⚠️ 警告：", objName + "." + propStr, "返回 undefined");
            }

            if (typeof value === "function") {
                return value.bind(target);
            }

            return value;
        },

        set(target, prop, value, receiver) {
            const propStr = typeof prop === "symbol" ? prop.toString() : String(prop);
            const key = objName + "." + propStr;
            logOnce("set:" + key, "方法:", "set", "对象:", objName, "属性:", propStr, "新值:", value);
            return Reflect.set(target, prop, value, receiver);
        }
    };
}

function watch(obj, name = "anonymous") {
    return new Proxy(obj, createHandler(name, obj));
}

function setProxyArr(arr) {
    for (const name of arr) {
        let obj = globalThis[name];
        if (obj === undefined) {
            v_log("警告: 对象不存在，创建空对象:", name);
            obj = {};
            globalThis[name] = obj;
        }
        globalThis[name] = new Proxy(obj, createHandler(name, obj));
        v_log("✅ 成功代理对象:", name);
    }
}

/************************************************************
 * 模块 2： Window 原型链调整
 ************************************************************/

function Window() {
    EventTarget.call(this);
}

Object.setPrototypeOf(Window.prototype, EventTarget.prototype);

Object.defineProperty(Window.prototype, Symbol.toStringTag, {
    value: "Window",
    configurable: true
});

Window.prototype.attachEvent = function attachEvent(type, listener) {
    v_log(`[Window] 调用遗留方法 attachEvent: ${type}`);
    return this.addEventListener(type.replace(/^on/, ''), listener);
};

Window.prototype.scrollTo = function scrollTo(x, y) {
    v_log(`[Window] scrollTo(${x}, ${y})`);
};
Window.prototype.getComputedStyle = function getComputedStyle(el) {
    v_log(`[Window] getComputedStyle`);
    return watch({}, "ComputedStyle");
};

safeFunction(Window);
safeFunction(Window.prototype.attachEvent);
safeFunction(Window.prototype.scrollTo);
safeFunction(Window.prototype.getComputedStyle);

// 按照 Location 模式：多重挂载与全局关联
window = globalThis;
Object.setPrototypeOf(window, Window.prototype);

globalThis.Window = Window; // 暴露大写构造函数
self = window;
top = window;
parent = window;

// ⭐ 补齐 Chrome 风格的 window.ActiveXObject
Object.defineProperty(window, "ActiveXObject", {
    value: undefined,
    writable: true,
    enumerable: false,
    configurable: true
});
/************************************************************
 * 模块 3：DOM 核心基础设施 (EventTarget -> Node -> Element)+  document
 ************************************************************/

const _listeners = Symbol("listeners");

function EventTarget() {
}

safeFunction(EventTarget);

EventTarget.prototype.addEventListener = function addEventListener(type, listener) {
    if (!this[_listeners]) {
        Object.defineProperty(this, _listeners, {value: {}, enumerable: false});
    }
    if (!this[_listeners][type]) this[_listeners][type] = [];
    this[_listeners][type].push(listener);
    v_log(`[EventTarget] ${this.constructor.name} 注册事件: ${type}`);
};
EventTarget.prototype.removeEventListener = function removeEventListener(type, listener) {
    v_log(`[EventTarget] ${this.constructor.name} 移除事件: ${type}`);
};
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

function Node() {
    EventTarget.call(this);
}

Object.setPrototypeOf(Node.prototype, EventTarget.prototype);
safeFunction(Node);

Node.prototype.appendChild = function appendChild(child) {
    v_log("DOM操作: appendChild");
    return child;
};
Node.prototype.removeChild = function removeChild(child) {
    v_log("DOM操作: removeChild");
    return child;
};
safeFunction(Node.prototype.appendChild);
safeFunction(Node.prototype.removeChild);

function Element() {
    Node.call(this);
}

Object.setPrototypeOf(Element.prototype, Node.prototype);
safeFunction(Element);

Element.prototype.getAttribute = function getAttribute(name) {
    v_log(`DOM操作: ${this.constructor.name}.getAttribute('${name}')`);
    return this[name] || null;
};
Element.prototype.setAttribute = function setAttribute(name, value) {
    v_log(`DOM操作: ${this.constructor.name}.setAttribute('${name}', '${value}')`);
    this[name] = String(value);
};
Element.prototype.removeAttribute = function removeAttribute(name) {
    v_log(`DOM操作: ${this.constructor.name}.removeAttribute('${name}')`);
    delete this[name];
};

// --- 3.4 具体的 HTML 元素构造函数扩展 ---

// 统一定义并伪装构造函数
function HTMLMetaElement() {
    HTMLElement.call(this);
}

Object.setPrototypeOf(HTMLMetaElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLMetaElement.prototype, Symbol.toStringTag, {value: "HTMLMetaElement", configurable: true});
safeFunction(HTMLMetaElement);

function HTMLHeadElement() {
    HTMLElement.call(this);
}

Object.setPrototypeOf(HTMLHeadElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLHeadElement.prototype, Symbol.toStringTag, {value: "HTMLHeadElement", configurable: true});
safeFunction(HTMLHeadElement);

function HTMLLinkElement() {
    HTMLElement.call(this);
}

Object.setPrototypeOf(HTMLLinkElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLLinkElement.prototype, Symbol.toStringTag, {value: "HTMLLinkElement", configurable: true});
safeFunction(HTMLLinkElement);

// - 映射表与虚拟数据池 ---
const tagConstructorMap = {
    'meta': HTMLMetaElement,
    'head': HTMLHeadElement,
    'div': HTMLDivElement,
    'script': HTMLScriptElement,
    'link': HTMLLinkElement
};
const virtualNodes = {
    get meta() {
        return [
            {name: "referrer", content: "A2bnzJwSMjyC8NxLVUF9avD0ULH6jS59X7KfspqJdmnDFqXiu8FqI1_qwnMaYoDg"},   //
            {"http-equiv": "pragma", content: "no-cache"}
        ];
    },
    'head': [{}],
    'base': [{href: "https://www.ouyeel.com/"}],
    'link': [{rel: "stylesheet", href: "style.css"}]
};

Element.prototype.getElementsByTagName = function getElementsByTagName(tagName) {
    const tag = String(tagName).toLowerCase();
    v_log(`DOM操作: ${this.constructor.name}.getElementsByTagName('${tag}')`);

    const collection = [];

    // 如果有预设的虚拟节点，则根据数据生成实例
    if (virtualNodes[tag]) {
        virtualNodes[tag].forEach(data => {
            const Constructor = tagConstructorMap[tag] || HTMLElement;
            const el = new Constructor();
            // 填充数据
            Object.assign(el, data);
            // 必须 watch 每一个元素，使其 getAttribute 等操作被记录
            collection.push(watch(el, `Element<${tag}>`));
        });
    }

    // 设置集合标识并 watch 集合本身（处理 -1 等索引问题）
    Object.defineProperty(collection, Symbol.toStringTag, {value: "HTMLCollection"});
    return watch(collection, "HTMLCollection");
};

Element.prototype.getElementsByClassName = function getElementsByClassName(className) {
    v_log(`DOM操作: ${this.constructor.name}.getElementsByClassName('${className}')`);
    const collection = [];
    Object.defineProperty(collection, Symbol.toStringTag, {value: "HTMLCollection"});
    return watch(collection, "HTMLCollection");
};

Object.defineProperty(Element.prototype, "style", {
    get: function () {
        if (!this._style) {
            this._style = watch({}, `${this.constructor.name}.style`);
        }
        return this._style;
    },
    configurable: true,
    enumerable: true
});

Object.defineProperty(Element.prototype, "className", {
    get: function () {
        return this["class"] || "";
    },
    set: function (val) {
        this["class"] = val;
    },
    configurable: true,
    enumerable: true
});

safeFunction(Element.prototype.getAttribute);
safeFunction(Element.prototype.setAttribute);
safeFunction(Element.prototype.removeAttribute);
safeFunction(Element.prototype.getElementsByTagName);
safeFunction(Element.prototype.getElementsByClassName);

function HTMLElement() {
    Element.call(this);
}

Object.setPrototypeOf(HTMLElement.prototype, Element.prototype);
safeFunction(HTMLElement);

function HTMLDivElement() {
    HTMLElement.call(this);
}

Object.setPrototypeOf(HTMLDivElement.prototype, HTMLElement.prototype);
safeFunction(HTMLDivElement);

function HTMLScriptElement() {
    HTMLElement.call(this);
}

Object.setPrototypeOf(HTMLScriptElement.prototype, HTMLElement.prototype);
Object.defineProperty(HTMLScriptElement.prototype, Symbol.toStringTag, {
    value: "HTMLScriptElement",
    configurable: true
});
safeFunction(HTMLScriptElement);
window.HTMLScriptElement = HTMLScriptElement;


/************************************************************
 * 模块 3.5：Document (重点完善部分)
 ************************************************************/

function Document() {
    Node.call(this);
}

Object.setPrototypeOf(Document.prototype, Node.prototype);

Document.prototype.createElement = function createElement(tagName) {
    const tag = String(tagName).toLowerCase();
    v_log("DOM操作: document.createElement ->", tag);
    let element;
    switch (tag) {
        case 'div':
            element = new HTMLDivElement();
            break;
        case 'script':
            element = new HTMLScriptElement();
            break;
        default:
            element = new HTMLElement();
    }
    return watch(element, `element <${tag}>`);
};

// ⭐ 完善 getElementById
Document.prototype.getElementById = function getElementById(id) {
    v_log(`DOM操作: document.getElementById('${id}')`);
    // 创建一个真实的实例，使其自动具备 Element 的方法和 style 监控
    const element = new HTMLDivElement();
    Object.defineProperty(element, 'id', {value: id, enumerable: true});
    return watch(element, `Element(id:${id})`);
};

// ⭐ 完善 getElementsByName
Document.prototype.getElementsByName = function getElementsByName(name) {
    v_log(`DOM操作: document.getElementsByName('${name}')`);
    const collection = [];
    // 模拟集合中包含一个元素
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

Object.defineProperty(Document.prototype, Symbol.toStringTag, {
    value: "HTMLDocument",
    configurable: true
});

// 实例化、暴露类、多重挂载
const documentInstance = new Document();
globalThis.Document = Document;     // 暴露大写构造函数
globalThis.HTMLDocument = Document; // 兼容性别名
window.document = documentInstance;
globalThis.document = documentInstance;

// 初始化 body
document.body = watch(new HTMLDivElement(), "document.body");


/************************************************************
 * 模块 4： Navigator
 ************************************************************/
function Navigator() {
}

safeFunction(Navigator);
Object.defineProperty(Navigator.prototype, Symbol.toStringTag, {value: "Navigator", configurable: true});
Navigator.prototype.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/143.0.0.0 Safari/537.36";

const navigatorInstance = new Navigator();
window.navigator = navigatorInstance;
globalThis.navigator = navigatorInstance;
globalThis.Navigator = Navigator;

/************************************************************
 * 模块 5： Screen
 ************************************************************/
function Screen() {
}

safeFunction(Screen);
Object.defineProperty(Screen.prototype, Symbol.toStringTag, {value: "Screen", configurable: true});
// 补充常用属性
Screen.prototype.width = 1920;
Screen.prototype.height = 1080;
Screen.prototype.availWidth = 1920;
Screen.prototype.availHeight = 1040;

const screenInstance = new Screen();
window.screen = screenInstance;
globalThis.screen = screenInstance;
globalThis.Screen = Screen;

/************************************************************
 * 模块 6： History
 ************************************************************/
function History() {
}

safeFunction(History);
Object.defineProperty(History.prototype, Symbol.toStringTag, {value: "History", configurable: true});
History.prototype.length = 1;
History.prototype.state = null;

const historyInstance = new History();
window.history = historyInstance;
globalThis.history = historyInstance;
globalThis.History = History;

/************************************************************
 * 模块 7： Location
 ************************************************************/
function Location() {
    let _url = new URL("https://www.ouyeel.com/steel");

    // 将属性定义在实例上，解决 hasOwnProperty 检测
    const props = ["href", "protocol", "host", "hostname", "port", "pathname", "search", "hash", "origin"];

    props.forEach(prop => {
        Object.defineProperty(this, prop, {
            get() {
                v_log(`[Location] get ${prop}`);
                return _url[prop];
            },
            set(v) {
                if (prop === "href") {
                    try {
                        _url = new URL(String(v));
                    } catch (e) {
                    }
                } else {
                    // 模拟部分属性可写（如 location.hash）
                    try {
                        let temp = new URL(_url.href);
                        temp[prop] = String(v);
                        _url = temp;
                    } catch (e) {
                    }
                }
            },
            enumerable: true,
            configurable: false // 模拟真浏览器的不可配置特性
        });
    });

    // 屏蔽 toStringTag，让 Object.prototype.toString.call(location) 返回 [object Location]
    Object.defineProperty(this, Symbol.toStringTag, {
        value: "Location",
        configurable: true
    });
}

// 方法依然放在原型上
Location.prototype.toString = function toString() {
    return this.href;
};
safeFunction(Location.prototype.toString);

// 此时创建的实例
const _location = new Location();
// 使用你的原生方法包装逻辑
location = watch(_location, "location");

// 补一个关键点：屏蔽 Location.prototype 上的这些 get，防止脚本探测原型链
["href", "protocol", "host"].forEach(p => {
    Object.defineProperty(Location.prototype, p, {enumerable: false, value: undefined});
});

/************************************************************
 * 模块 8：挂 Proxy
 ************************************************************/

setProxyArr(["window", "document", "location", "history", "screen", "navigator"]);

