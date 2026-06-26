/**
 * Boss直聘 JSVMP 补环境 (v2 - 完整版)
 * 对齐浏览器真实属性值（Chrome 139, Windows 10, zh-CN）
 */
(function () {
    const $toString = Function.prototype.toString;
    const $callToString = Function.prototype.call.bind($toString);
    const memoryMap = new Map();
    const myToString = function toString() {
        return typeof this === 'function' && memoryMap.get(this) || $callToString(this);
    };
    Object.defineProperty(Function.prototype, "toString", {
        enumerable: false, configurable: true, writable: true, value: myToString
    });
    function set_native(obj, value) { memoryMap.set(obj, value); }
    set_native(Function.prototype.toString, "function toString() { [native code] }");
    global.setNative = function setNative(func, funcname) {
        Object.defineProperty(func, "name", { value: funcname || func.name || '', writable: false, enumerable: false, configurable: true });
        set_native(func, `function ${funcname || func.name || ''}() { [native code] }`);
    };
})();

window = globalThis; global.window = window; global.self = window; global.top = window; global.parent = window;

function Navigator() {} function Document() {} function HTMLElement() {} function HTMLHtmlElement() {} function Location() {} function Screen() {} function History() {} function Storage() {} function Performance() {} function EventTarget() {}

setNative(Navigator,'Navigator'); setNative(Document,'Document'); setNative(HTMLElement,'HTMLElement'); setNative(HTMLHtmlElement,'HTMLHtmlElement'); setNative(Location,'Location'); setNative(Screen,'Screen'); setNative(History,'History'); setNative(Storage,'Storage'); setNative(Performance,'Performance'); setNative(EventTarget,'EventTarget');

// ---- navigator (Chrome 139 / Windows) ----
navigator = new Navigator();
Navigator.prototype.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
Navigator.prototype.appVersion = '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
Navigator.prototype.platform = 'Win32';
Navigator.prototype.language = 'zh-CN';
Navigator.prototype.languages = ['zh-CN', 'zh', 'en'];
Navigator.prototype.cookieEnabled = true;
Navigator.prototype.webdriver = false;
Navigator.prototype.hardwareConcurrency = 2;
Navigator.prototype.maxTouchPoints = 1;
Navigator.prototype.vendor = '';
Navigator.prototype.vendorSub = '';
Navigator.prototype.productSub = '20100101';
Navigator.prototype.doNotTrack = '1';
Navigator.prototype.onLine = true;

// ---- document ----
document = new Document();
Document.prototype.addEventListener = function () {};
Object.defineProperty(Document.prototype, 'cookie', {
    get: function () { return '__a=' + (global._zp_a || '0.0..0.1.1.1.1') + '; __c=' + (global._zp_ts || '0') + '; __g=-' + '; ab_guid=test'; },
    set: function () {}, enumerable: true, configurable: true
});
Document.prototype.referrer = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
Document.prototype.title = '';
Document.prototype.readyState = 'complete';
Document.prototype.hidden = false;
Document.prototype.visibilityState = 'visible';
Document.prototype.characterSet = 'UTF-8';

HTMLElement.prototype = new EventTarget();
HTMLElement.prototype.offsetWidth = 1920; HTMLElement.prototype.offsetHeight = 1080;
HTMLElement.prototype.clientWidth = 1920; HTMLElement.prototype.clientHeight = 1080;
HTMLElement.prototype.style = {}; HTMLElement.prototype.className = ''; HTMLElement.prototype.id = ''; HTMLElement.prototype.innerHTML = '';
HTMLElement.prototype.appendChild = function () {}; setNative(HTMLElement.prototype.appendChild, 'appendChild');
HTMLElement.prototype.removeChild = function () {}; setNative(HTMLElement.prototype.removeChild, 'removeChild');
HTMLElement.prototype.setAttribute = function () {}; setNative(HTMLElement.prototype.setAttribute, 'setAttribute');
HTMLElement.prototype.getAttribute = function (attr) { return null; }; setNative(HTMLElement.prototype.getAttribute, 'getAttribute');
HTMLElement.prototype.getBoundingClientRect = function () { return { top: 0, left: 0, width: 1920, height: 1080, right: 1920, bottom: 1080 }; };
setNative(HTMLElement.prototype.getBoundingClientRect, 'getBoundingClientRect');

HTMLHtmlElement.prototype = new HTMLElement(); setNative(HTMLHtmlElement, 'HTMLHtmlElement');
document.documentElement = new HTMLHtmlElement(); document.body = new HTMLElement(); document.head = new HTMLElement();
document.createElement = function (tagName) { return new HTMLElement(); }; setNative(document.createElement, 'createElement');

// ---- location ----
location = new Location();
Location.prototype.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
Location.prototype.protocol = 'https:'; Location.prototype.host = 'www.zhipin.com'; Location.prototype.hostname = 'www.zhipin.com';
Location.prototype.port = ''; Location.prototype.pathname = '/web/geek/jobs';
Location.prototype.search = '?city=101010100&query=python'; Location.prototype.hash = ''; Location.prototype.origin = 'https://www.zhipin.com';

// ---- screen ----
screen = new Screen();
Screen.prototype.width = 1920; Screen.prototype.height = 1080;
Screen.prototype.availWidth = 1920; Screen.prototype.availHeight = 1040;
Screen.prototype.colorDepth = 24; Screen.prototype.pixelDepth = 24;

// ---- history ----
history = new History(); History.prototype.length = 1;
History.prototype.pushState = function () {}; setNative(History.prototype.pushState, 'pushState');
History.prototype.replaceState = function () {}; setNative(History.prototype.replaceState, 'replaceState');

// ---- localStorage / sessionStorage ----
localStorage = new Storage(); sessionStorage = new Storage();
Storage.prototype.getItem = function (key) { return null; }; setNative(Storage.prototype.getItem, 'getItem');
Storage.prototype.setItem = function (key, value) {}; setNative(Storage.prototype.setItem, 'setItem');
Storage.prototype.removeItem = function (key) {}; setNative(Storage.prototype.removeItem, 'removeItem');
Storage.prototype.clear = function () {}; setNative(Storage.prototype.clear, 'clear');
Storage.prototype.length = 0; Storage.prototype.key = function (index) { return null; }; setNative(Storage.prototype.key, 'key');

// ---- performance ----
performance = new Performance();
Performance.prototype.now = function () { return Date.now(); }; setNative(Performance.prototype.now, 'now');
Performance.prototype.timing = { navigationStart: Date.now(), fetchStart: Date.now() };

// ---- crypto ----
try { window.crypto = globalThis.crypto || require('crypto'); } catch(e) {}

// ---- 挂载 ----
window.document = document; window.navigator = navigator; window.location = location; window.screen = screen;
window.history = history; window.localStorage = localStorage; window.sessionStorage = sessionStorage; window.performance = performance;
window.setTimeout = setTimeout; window.setInterval = setInterval; window.clearTimeout = clearTimeout; window.clearInterval = clearInterval;
window.Date = Date; window.Math = Math; window.parseInt = parseInt; window.parseFloat = parseFloat;
window.encodeURIComponent = encodeURIComponent; window.decodeURIComponent = decodeURIComponent;
window.btoa = function (str) { return Buffer.from(str).toString('base64'); };
window.atob = function (str) { return Buffer.from(str, 'base64').toString(); };
window.addEventListener = function () {};
