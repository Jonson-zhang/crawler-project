/************************************************************
 * 全局配置：站点 URL（可随时修改）
 ************************************************************/
const SITE_URL = "https://www.toutiao.com/";

/************************************************************
 * 配置：双模式开关
 ************************************************************/
const DEBUG_MODE = true;   // true = 调试模式（日志监控）
// const DEBUG_MODE = false; // false = 生产模式

/************************************************************
 * 模块 0：日志系统
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
 * 模块 1：安全 safeFunction
 ************************************************************/
const nativeCode = " { [native code] }"; // ⭐ 必须加上这一行
function safeFunction(func) {
    if (typeof func !== "function") return func;

    const name = func.name || "";
    const fakeStr = `function ${name}()` + nativeCode;

    /************************************************************
     * 1. 定义 toString 伪装函数（核心）
     ************************************************************/
    const toStringProxy = function toString() {
        if (this === toStringProxy) {
            return `function toString()` + nativeCode;
        }
        return fakeStr;
    };

    /************************************************************
     * 2. 递归伪装 toStringProxy 自身
     ************************************************************/
    Object.defineProperty(toStringProxy, "name", {
        value: "toString",
        writable: false,
        enumerable: false,
        configurable: true
    });

    Object.defineProperty(toStringProxy, "toString", {
        value: function () {
            return `function toString()` + nativeCode;
        },
        writable: false,
        enumerable: false,
        configurable: true
    });

    /************************************************************
     * 3. 绑定到目标函数
     ************************************************************/
    Object.defineProperty(func, "toString", {
        value: toStringProxy,
        writable: false,
        enumerable: false,
        configurable: true
    });

    /************************************************************
     * 4. 原型处理（白名单机制）
     ************************************************************/
    const keepPrototype = new Set([
        "Window", "Document", "Element", "Node", "History",
        "Location", "Navigator", "Screen", "Storage",
        "EventTarget", "HTMLDocument", "HTMLElement"
    ]);

    if (!keepPrototype.has(name)) {
        try {
            if (Object.prototype.hasOwnProperty.call(func, "prototype")) {
                delete func.prototype;
            }
        } catch (e) {
        }
    }

    return func;
}


/************************************************************
 * 安全监控器（不会破坏 jsdom）
 ************************************************************/
function createSafeWatcher(obj, name) {
    return new Proxy(obj, {
        get(target, prop, receiver) {
            const key = `${name}.${String(prop)}`;
            console.log(`[MONITOR][GET] ${key}`);

            const value = Reflect.get(target, prop, receiver);

            if (value === undefined) {
                console.log(`[MONITOR][UNDEFINED] ${key} → undefined`);
            }

            if (typeof value === "function") {
                return function (...args) {
                    console.log(`[MONITOR][CALL] ${key}(${args.map(a => JSON.stringify(a)).join(", ")})`);
                    return value.apply(this, args);
                };
            }

            return value;
        },

        set(target, prop, value, receiver) {
            const key = `${name}.${String(prop)}`;
            console.log(`[MONITOR][SET] ${key} =`, value);
            return Reflect.set(target, prop, value, receiver);
        }
    });
}

/************************************************************
 * 模块 2：Proxy 监控器
 ************************************************************/
function createHandler(objName, targetObj) {
    return {
        get(target, prop, receiver) {

            if (prop === Symbol.toPrimitive) {
                const desc = Object.getOwnPropertyDescriptor(target, Symbol.toPrimitive);
                if (!desc) return undefined;
            }

            const value = Reflect.get(target, prop, receiver);
            const propStr = typeof prop === "symbol" ? prop.toString() : String(prop);
            const key = objName + "." + propStr;

            if (DEBUG_MODE && value === undefined) {
                logOnce("undefined:" + key, `⚠️ ${objName}.${propStr} → undefined`);
            }

            logOnce("get:" + key, `[GET] ${objName}.${propStr}`);

            if (typeof value === "function") {
                if (value.prototype && value.prototype.constructor === value) {
                    return value;
                }
                return value.bind(target);
            }

            return value;
        },

        set(target, prop, value, receiver) {
            const propStr = typeof prop === "symbol" ? prop.toString() : String(prop);
            logOnce("set:" + objName + "." + propStr, `[SET] ${objName}.${propStr} =`, value);
            return Reflect.set(target, prop, value, receiver);
        }
    };
}

function watch(obj, name) {
    return new Proxy(obj, createHandler(name, obj));
}

/************************************************************
 * 模块 3：Window
 ************************************************************/
function Window() {
}

safeFunction(Window);

Object.defineProperties(Window.prototype, {
    innerWidth: {value: 1920, writable: true},
    innerHeight: {value: 1080, writable: true},

    outerWidth: {value: 1920 + 16, writable: true},
    outerHeight: {value: 1080 + 32, writable: true},

    screenX: {value: 0, writable: true},
    screenY: {value: 0, writable: true},

    pageXOffset: {value: 0, writable: true},
    pageYOffset: {value: 0, writable: true},


    devicePixelRatio: {value: 1.25, writable: true}
});

/************************************************************
 * Window 补充：sizeWidth / sizeHeight / clientWidth / clientHeight
 ************************************************************/
Object.defineProperties(Window.prototype, {
    sizeWidth: {
        get() {
            return 1920;
        },
        configurable: true
    },
    sizeHeight: {
        get() {
            return 1080;
        },
        configurable: true
    },

    clientWidth: {
        get() {
            return 1920;
        },
        configurable: true
    },
    clientHeight: {
        get() {
            return 1080;
        },
        configurable: true
    }
});

Window.prototype.requestAnimationFrame = safeFunction(function (callback) {
    return setTimeout(() => callback(Date.now()), 16);
});

/************************************************************
 * EventSource（最小可用版本）
 ************************************************************/
function EventSource(url) {
    this.url = url;
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;

    setTimeout(() => {
        this.readyState = 1;
        if (this.onopen) this.onopen({type: "open"});
    }, 0);
}

safeFunction(EventSource);

Object.defineProperty(Window.prototype, "EventSource", {
    value: EventSource,
    writable: true,
    configurable: true
});

/************************************************************
 * window.onwheelx（网站自定义字段）
 ************************************************************/
Object.defineProperty(Window.prototype, "onwheelx", {
    value: {_Ax: "0X21"},
    writable: true,
    configurable: true
});

/************************************************************
 * 今日头条业务字段：_sdkGlueVersionMap
 ************************************************************/
Object.defineProperty(Window.prototype, "_sdkGlueVersionMap", {
    value: {
        sdkGlueVersion: "1.0.0.55",
        bdmsVersion: "1.0.1.7",
        captchaVersion: "4.0.2"
    },
    writable: true,
    enumerable: false,
    configurable: true
});

/************************************************************
 * Storage（最小可用版本）
 ************************************************************/
function Storage() {
    this._data = {};
}

safeFunction(Storage);

Storage.prototype.getItem = safeFunction(function (key) {
    key = String(key);
    return Object.prototype.hasOwnProperty.call(this._data, key)
        ? this._data[key]
        : null;
});

Storage.prototype.setItem = safeFunction(function (key, value) {
    this._data[String(key)] = String(value);
});

Storage.prototype.removeItem = safeFunction(function (key) {
    delete this._data[String(key)];
});

Storage.prototype.clear = safeFunction(function () {
    this._data = {};
});

Object.defineProperty(Storage.prototype, "length", {
    get() {
        return Object.keys(this._data).length;
    }
});

Storage.prototype.key = safeFunction(function (n) {
    const keys = Object.keys(this._data);
    return keys[n] || null;
});

/************************************************************
 * window.localStorage / window.sessionStorage
 ************************************************************/
const _localStorage = watch(new Storage(), "localStorage");
const _sessionStorage = watch(new Storage(), "sessionStorage");

Object.defineProperty(Window.prototype, "localStorage", {
    value: _localStorage,
    writable: false,
    configurable: true
});

Object.defineProperty(Window.prototype, "sessionStorage", {
    value: _sessionStorage,
    writable: false,
    configurable: true
});

/************************************************************
 * 模块 4：Document
 ************************************************************/
function Document() {
}

safeFunction(Document);

Object.defineProperty(Document.prototype, Symbol.toStringTag, {value: "HTMLDocument"});

/************************************************************
 * document.cookie（真实浏览器行为）
 ************************************************************/
(function () {
    let cookieStore = "";

    Object.defineProperty(Document.prototype, "cookie", {
        get: safeFunction(function () {
            return cookieStore;
        }),

        set: safeFunction(function (v) {
            v = String(v).trim();
            if (!v) return;

            if (cookieStore) {
                cookieStore += "; " + v;
            } else {
                cookieStore = v;
            }
        }),

        configurable: true
    });
})();

/************************************************************
 * document.createElement（最小可用）
 ************************************************************/
let span = {classList: []};

Document.prototype.createElement = safeFunction(function (tag) {
    v_log(`🛠️ [LOG] document.createElement -> <${tag}>`);
    if (tag === 'span') {
        return span;
    } else {
        return {tagName: tag.toUpperCase(), style: {}, attributes: {}};
    }
});

/************************************************************
 * document.documentElement
 ************************************************************/
const _documentElement = {
    tagName: "HTML",
    style: {},
    attributes: {},
};

Object.defineProperty(Document.prototype, "documentElement", {
    get() {
        return watch(_documentElement, "documentElement");
    },
    configurable: true
});

/************************************************************
 * document.body
 ************************************************************/
const _documentBody = {
    tagName: "BODY",
    style: {},
    attributes: {},
};

Object.defineProperty(Document.prototype, "body", {
    get() {
        return watch(_documentBody, "document.body");
    },
    configurable: true
});

Object.defineProperties(_documentBody, {
    clientWidth: {
        get() {
            return 1920;
        },
        configurable: true
    },
    clientHeight: {
        get() {
            return 1080;
        },
        configurable: true
    }
});
/************************************************************
 * Document 补充：clientWidth / clientHeight
 ************************************************************/
Object.defineProperties(Document.prototype, {
    clientWidth: {
        get() {
            return 1920;
        },
        configurable: true
    },
    clientHeight: {
        get() {
            return 1080;
        },
        configurable: true
    }
});

/************************************************************
 * document.referrer
 ************************************************************/
Object.defineProperty(Document.prototype, "referrer", {
    get() {
        return "";
    },
    configurable: true
});

/************************************************************
 * document.createEvent
 ************************************************************/
Document.prototype.createEvent = safeFunction(function (type) {
    return {
        type,
        initEvent: safeFunction(function (eventType, bubbles, cancelable) {
            this.type = eventType;
            this.bubbles = !!bubbles;
            this.cancelable = !!cancelable;
        })
    };
});

/************************************************************
 * document.all（HTMLAllCollection 伪装）
 ************************************************************/
function HTMLAllCollection() {
}

safeFunction(HTMLAllCollection);

const _documentAll = new HTMLAllCollection();

Object.defineProperty(_documentAll, Symbol.toPrimitive, {
    value: function (hint) {
        if (hint === "number") return 0;
        return undefined;
    },
    configurable: true
});

Object.defineProperty(HTMLAllCollection.prototype, Symbol.toStringTag, {
    value: "HTMLAllCollection"
});

_documentAll.length = 1;
_documentAll[0] = {tagName: "HTML"};

const callable = safeFunction(function (selector) {
    return [];
});

const documentAllProxy = new Proxy(callable, {
    get(target, prop) {
        if (prop in _documentAll) return _documentAll[prop];
        return target[prop];
    },
    apply(target, thisArg, args) {
        return target.apply(_documentAll, args);
    }
});

Object.defineProperty(Document.prototype, "all", {
    get() {
        return documentAllProxy;
    },
    configurable: true
});

/************************************************************
 * 模块 5：Navigator（增强版 + 今日头条补丁）
 ************************************************************/
function Navigator() {
}

safeFunction(Navigator);

Object.defineProperty(Navigator.prototype, Symbol.toStringTag, {value: "Navigator"});

Object.defineProperties(Navigator.prototype, {
    userAgent: {
        get: () =>
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/143.0.0.0 Safari/537.36"
    },
    platform: {value: "Win32"},
    vendor: {value: "Google Inc."},
    language: {value: "zh-CN"},
    languages: {value: ["zh-CN", "zh"]},
    hardwareConcurrency: {value: 8},
    deviceMemory: {value: 8},
    maxTouchPoints: {value: 0},
    webdriver: {value: false},

    /********************************************************
     * 今日头条必需：plugins / mimeTypes 不能是空数组
     ********************************************************/
    plugins: {
        value: [
            {name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format"},
            {
                name: "Chrome PDF Viewer",
                filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                description: "Portable Document Format"
            },
            {name: "Native Client", filename: "internal-nacl-plugin", description: ""}
        ]
    },


    mimeTypes: {
        value: [{
            type: "application/pdf",
            suffixes: "pdf",
            description: "Portable Document Format"
        }]
    }
});
/************************************************************
 * Navigator 补充：userAgentData.platform
 ************************************************************/
Object.defineProperty(Navigator.prototype, "userAgentData", {
    value: {
        platform: "Windows",
        brands: [
            {brand: "Chromium", version: "143"},
            {brand: "Google Chrome", version: "143"}
        ],
        mobile: false
    },
    configurable: true
});

/************************************************************
 * 今日头条必需：navigator.connection
 ************************************************************/
Object.defineProperty(Navigator.prototype, "connection", {
    value: {
        effectiveType: "4g",
        rtt: 50,
        downlink: 10,
        saveData: false
    },
    writable: false,
    configurable: true
});

/************************************************************
 * 模块 6：Screen（增强版）
 ************************************************************/
function Screen() {
}

safeFunction(Screen);

Object.defineProperty(Screen.prototype, Symbol.toStringTag, {value: "Screen"});

Object.defineProperties(Screen.prototype, {
    width: {value: 1920},
    height: {value: 1080},
    availWidth: {value: 1920},
    availHeight: {value: 1040},
    colorDepth: {value: 24},
    pixelDepth: {value: 24},

    orientation: {
        value: {
            type: "landscape-primary",
            angle: 0,
            onchange: null
        },
        writable: false
    }
});
/************************************************************
 * Screen 补充：sizeWidth / sizeHeight
 ************************************************************/
Object.defineProperties(Screen.prototype, {
    sizeWidth: {value: 1920, configurable: true},
    sizeHeight: {value: 1080, configurable: true}
});

/************************************************************
 * 模块 7：History（增强版）
 ************************************************************/
function History() {
}

safeFunction(History);

Object.defineProperty(History.prototype, Symbol.toStringTag, {value: "History"});

/************************************************************
 * 模块 8：Location（真实浏览器级）
 ************************************************************/
function Location() {
    this._url = new URL(SITE_URL);
}

safeFunction(Location);

Object.defineProperties(Location.prototype, {
    href: {
        get() {
            return this._url.href;
        },
        set(v) {
            this._url = new URL(v, this._url.href);
        }
    },

    protocol: {
        get() {
            return this._url.protocol;
        },
        set(v) {
            this._url.protocol = v;
        }
    },

    host: {
        get() {
            return this._url.host;
        },
        set(v) {
            this._url.host = v;
        }
    },

    hostname: {
        get() {
            return this._url.hostname;
        },
        set(v) {
            this._url.hostname = v;
        }
    },

    origin: {
        get() {
            return this._url.origin;
        }
    },

    pathname: {
        get() {
            return this._url.pathname;
        },
        set(v) {
            this._url.pathname = v;
        }
    },

    search: {
        get() {
            return this._url.search;
        },
        set(v) {
            this._url.search = v;
        }
    },

    hash: {
        get() {
            return this._url.hash;
        },
        set(v) {
            this._url.hash = v;
        }
    }
});

Location.prototype.toString = safeFunction(function () {
    return this.href;
});

/************************************************************
 * XMLHttpRequest（最小可用版本）
 ************************************************************/
function XMLHttpRequest() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = "";
    this.onreadystatechange = null;
}

safeFunction(XMLHttpRequest);

XMLHttpRequest.prototype.open = safeFunction(function (method, url) {
    this._method = method;
    this._url = url;
    this.readyState = 1;
    if (this.onreadystatechange) this.onreadystatechange();
});

XMLHttpRequest.prototype.send = safeFunction(function (body) {
    this.readyState = 4;
    this.status = 200;
    this.responseText = "";
    if (this.onreadystatechange) this.onreadystatechange();
});

/************************************************************
 * 今日头条必需：chrome 对象
 ************************************************************/
globalThis.chrome = {
    runtime: {},
    app: {isInstalled: false},
    webstore: {},
    csi: () => ({startE: Date.now()}),
    loadTimes: () => ({
        requestTime: Date.now() / 1000,
        startLoadTime: Date.now() / 1000,
        commitLoadTime: Date.now() / 1000,
        finishDocumentLoadTime: Date.now() / 1000,
        finishLoadTime: Date.now() / 1000,
        navigationType: "Other"
    })
};

/************************************************************
 * 今日头条必需：Intl 补丁
 ************************************************************/
const _resolvedOptions = {
    locale: "zh-CN",
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: "Asia/Shanghai"
};

const _dtf = {
    resolvedOptions: () => _resolvedOptions
};

globalThis.Intl = {
    DateTimeFormat: function () {
        return _dtf;
    }
};

/************************************************************
 * 模块 9：实例化与挂载
 ************************************************************/
let windowInstance;

if (DEBUG_MODE) {
    windowInstance = globalThis;
    Object.setPrototypeOf(windowInstance, Window.prototype);
    v_log("🟩 调试模式：window = globalThis");
} else {
    windowInstance = new Window();
    v_log("🟦 生产模式：window = new Window()");
}

const documentInstance = new Document();
const navigatorInstance = new Navigator();
const screenInstance = new Screen();
const historyInstance = new History();
const locationInstance = new Location();

const setupMap = {
    window: windowInstance,
    self: windowInstance,
    top: windowInstance,
    document: documentInstance,
    navigator: navigatorInstance,
    screen: screenInstance,
    history: historyInstance,
    location: locationInstance
};

for (const [key, inst] of Object.entries(setupMap)) {
    windowInstance[key] = inst;
    globalThis[key] = inst;
}

documentInstance.location = locationInstance;
documentInstance._cookie = "";

/************************************************************
 * 模块 10：调试模式 Proxy
 ************************************************************/
if (DEBUG_MODE) {
    v_log("🟩 开始代理监控...");

    const proxiedWindow = watch(windowInstance, "window");
    Object.defineProperty(globalThis, 'window', {value: proxiedWindow});

    document = watch(documentInstance, "document");
    navigator = watch(navigatorInstance, "navigator");
    screen = watch(screenInstance, "screen");
    history = watch(historyInstance, "history");
    location = watch(locationInstance, "location");

    windowInstance.XMLHttpRequest = XMLHttpRequest;
    globalThis.XMLHttpRequest = XMLHttpRequest;
}
