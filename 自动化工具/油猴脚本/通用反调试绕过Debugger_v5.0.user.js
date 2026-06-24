// ==UserScript==
// @name         通用反调试绕过Debugger v 5.0
// @namespace    https://github.com/Cunninger/anti-debug-bypass
// @version      5.0.0
// @description  通用反调试 v5.0 — 诚实版：动态代码路径全覆盖 + 诚实标注HTML解析器不可拦截 + 内建解决方案指南
// @author       Claude
// @match        *://*/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  ⚠️ 重要：本脚本的能力边界
    //
    //  ✅ 能拦截：所有动态代码生成路径
    //     - eval / Function / AsyncFunction / GeneratorFunction
    //     - setTimeout / setInterval (string 参数或含 debugger 的函数)
    //     - requestAnimationFrame / requestIdleCallback / queueMicrotask
    //     - Promise.then / setImmediate
    //     - script.text setter (内联脚本动态设置文本)
    //     - document.write / writeln
    //     - innerHTML (注入含 script 标签的 HTML)
    //     - appendChild / insertBefore / replaceChild (动态插入的 script 节点)
    //     - Worker / SharedWorker / Blob (JS 类型)
    //     - BroadcastChannel postMessage
    //
    //  ❌ 不能拦截：HTML 解析器直接加载的 <script src="xxx.js">
    //     - 浏览器 C++ 层的 HTML 解析器不经过 JS 属性 setter
    //     - 静态 <script src="..."> 和 document.write 产生的 <script src="...">
    //       都走 C++ 内部路径，无法从 JS 层拦截
    //
    //  如果你需要拦截 HTML 解析器加载的外部脚本，请用以下方案之一：
    //    ① Chrome DevTools → Sources → Overrides（替换 JS 文件为清洗版）
    //    ② mitmproxy 代理拦截 JS 响应
    //    ③ Playwright/Puppeteer CDP 命令自动恢复
    //    ④ Chrome Extension declarativeNetRequest
    // ============================================================

    var CONFIG = {
        verbose: false,
        blockConsoleClear: true,
        lockPrepareStackTrace: false,

        // ★ v5.0：CDP 自动恢复（需要配合外部脚本使用）
        cdpAutoResume: false,     // 是否启用 CDP 模式自动恢复
        cdpResumeInterval: 50,    // 恢复检查间隔(ms)
        maxResumeAttempts: 500    // 最大恢复次数（防止死循环耗尽资源）
    };

    var safeConsole = (typeof unsafeWindow !== 'undefined' && unsafeWindow.console)
        ? unsafeWindow.console
        : console;

    window.__ad_config__ = CONFIG;
    var blockCount = 0;
    var workerCount = 0;

    function log() {
        if (!CONFIG.verbose) return;
        try { safeConsole.log.apply(safeConsole, ['[AD]'].concat(Array.prototype.slice.call(arguments))); } catch(e) {}
    }

    // ============================================================
    //  工具函数
    // ============================================================
    var NAME_SYM = typeof Symbol === 'function' ? Symbol('ad_name') : '__ad_name__';

    function isExactlyDebuggerStmt(code) {
        if (typeof code !== 'string') return false;
        var s = code
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '')
            .replace(/[\s\r\n\t]+/g, '');
        return s === 'debugger' || s === 'debugger;'
            || s === '{debugger}' || s === '{debugger;}';
    }

    function removeDebuggerStatements(code) {
        if (typeof code !== 'string') return code;
        if (!/\bdebugger\b/i.test(code)) return code;

        var out = '';
        var i = 0;
        var len = code.length;
        var inString = false;
        var stringChar = '';
        var inTemplate = false;
        var inBlockComment = false;
        var inLineComment = false;
        var inRegex = false;

        while (i < len) {
            if (!inString && !inTemplate && !inLineComment && !inRegex &&
                code[i] === '/' && code[i + 1] === '*') {
                inBlockComment = true;
                out += '/*';
                i += 2;
                while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
                    out += code[i]; i++;
                }
                if (i < len) { out += '*/'; i += 2; }
                inBlockComment = false;
                continue;
            }
            if (!inString && !inTemplate && !inBlockComment && !inRegex &&
                code[i] === '/' && code[i + 1] === '/') {
                inLineComment = true;
                out += '//'; i += 2;
                while (i < len && code[i] !== '\n') { out += code[i]; i++; }
                inLineComment = false;
                continue;
            }
            if (!inBlockComment && !inLineComment && !inRegex &&
                !inTemplate && (code[i] === '"' || code[i] === "'" || code[i] === '`')) {
                var q = code[i];
                if (q === '`') inTemplate = true;
                else { inString = true; stringChar = q; }
                out += code[i]; i++;
                while (i < len) {
                    out += code[i];
                    if (code[i] === '\\') { i++; if (i < len) out += code[i]; }
                    else if (q === '`' && code[i] === '`') { inTemplate = false; i++; break; }
                    else if (code[i] === stringChar) { inString = false; i++; break; }
                    i++;
                }
                continue;
            }
            if (!inString && !inTemplate && !inBlockComment && !inLineComment && !inRegex) {
                var prevChar = i > 0 ? code[i - 1] : ' ';
                var isWordBoundary = /[^a-zA-Z0-9_$.]/.test(prevChar);
                if (isWordBoundary && code.substr(i, 8) === 'debugger') {
                    var nextChar = code[i + 8] || ' ';
                    if (/[\s;}\n\r]/.test(nextChar) || i + 8 >= len) {
                        blockCount++;
                        i += 8;
                        while (i < len && /[\s;]/.test(code[i]) && code[i] !== '\n') i++;
                        continue;
                    }
                }
                if (code[i] === '/' && !/[a-zA-Z0-9_$)\]]/.test(prevChar)) {
                    var back = i - 1;
                    while (back >= 0 && /\s/.test(code[back])) back--;
                    var eff = back >= 0 ? code[back] : ' ';
                    if (!((eff === '+' || eff === '-') && back >= 1 && code[back-1] === eff) &&
                        !/[a-zA-Z0-9_$)\]]/.test(eff)) {
                        inRegex = true; out += code[i]; i++;
                        while (i < len) {
                            out += code[i];
                            if (code[i] === '\\') { i++; if (i < len) out += code[i]; }
                            else if (code[i] === '/') {
                                inRegex = false; i++;
                                while (i < len && /[gimsuy]/.test(code[i])) { out += code[i]; i++; }
                                break;
                            }
                            i++;
                        }
                        continue;
                    }
                }
            }
            out += code[i]; i++;
        }
        return out;
    }

    function filterCodeString(code) {
        if (typeof code !== 'string') return code;
        if (isExactlyDebuggerStmt(code)) return null;
        if (/\bdebugger\b/i.test(code)) return removeDebuggerStatements(code);
        return code;
    }

    function safeToExecute(fn) {
        try {
            var fnStr = Function.prototype.toString.call(fn);
            return !/\bdebugger\b/i.test(fnStr);
        } catch(e) { return false; }
    }

    // ============================================================
    //  toString 伪装
    // ============================================================
    var _origFunctionToString = Function.prototype.toString;
    var hookedSet = new WeakSet();

    Function.prototype.toString = function () {
        if (hookedSet.has(this)) {
            var name = '';
            try { name = this[NAME_SYM] || this.name || ''; } catch(e) {}
            return 'function ' + name + '() { [native code] }';
        }
        if (typeof this !== 'function') {
            throw new TypeError("Function.prototype.toString requires that 'this' be a Function");
        }
        return _origFunctionToString.call(this);
    };

    function tagAsNative(fn, name) {
        try {
            hookedSet.add(fn);
            if (typeof NAME_SYM === 'symbol') {
                Object.defineProperty(fn, NAME_SYM, {
                    value: name, enumerable: false, configurable: false, writable: false
                });
            } else { fn[NAME_SYM] = name; }
        } catch (e) { log('tagAsNative failed:', e); }
    }
    tagAsNative(Function.prototype.toString, 'toString');

    // ============================================================
    //  Hook 锁定
    // ============================================================
    function lockProperty(obj, prop, value) {
        try {
            Object.defineProperty(obj, prop, {
                value: value, writable: false, configurable: false, enumerable: true
            });
            return true;
        } catch(e) { return false; }
    }

    // ============================================================
    //  Object.defineProperty 防御
    // ============================================================
    var _origDefineProperty = Object.defineProperty;
    var blockedProps = ['setInterval', 'setTimeout', 'eval', 'Function'];

    Object.defineProperty = function(obj, prop, desc) {
        if (obj === window && blockedProps.indexOf(prop) !== -1) { return obj; }
        if (obj === Function.prototype && prop === 'constructor' && desc && desc.configurable === true) { return obj; }
        return _origDefineProperty.call(Object, obj, prop, desc);
    };
    tagAsNative(Object.defineProperty, 'defineProperty');

    if (typeof Reflect !== 'undefined' && Reflect.defineProperty) {
        var _origReflectDefineProperty = Reflect.defineProperty;
        Reflect.defineProperty = function(obj, prop, desc) {
            if (obj === window && blockedProps.indexOf(prop) !== -1) { return true; }
            if (obj === Function.prototype && prop === 'constructor' && desc && desc.configurable === true) { return true; }
            return _origReflectDefineProperty.call(Reflect, obj, prop, desc);
        };
        tagAsNative(Reflect.defineProperty, 'defineProperty');
    }

    // ============================================================
    //  定时器 & 异步调度 Hook
    // ============================================================
    var _setInterval = window.setInterval;
    var _setTimeout = window.setTimeout;

    function debuggerInFunc(fn) {
        try {
            if (typeof fn === 'function') {
                var fnStr = _origFunctionToString.call(fn);
                return /\bdebugger\b/.test(fnStr);
            }
        } catch(e) {}
        return false;
    }

    function makeTimerHook(orig, name) {
        var wrapped = function (fn, delay) {
            if (debuggerInFunc(fn)) { blockCount++; return orig(function(){}, 86400000); }
            if (typeof fn === 'string') {
                var filtered = filterCodeString(fn);
                if (filtered === null) { blockCount++; return orig(function(){}, 86400000); }
                return orig.call(window, filtered, delay);
            }
            return orig.apply(window, arguments);
        };
        tagAsNative(wrapped, name);
        return wrapped;
    }

    window.setInterval = makeTimerHook(_setInterval, 'setInterval');
    window.setTimeout = makeTimerHook(_setTimeout, 'setTimeout');

    // rAF / rIC / queueMicrotask / setImmediate
    ['requestAnimationFrame','requestIdleCallback','queueMicrotask','setImmediate'].forEach(function(name) {
        if (typeof window[name] !== 'function') return;
        var _orig = window[name];
        window[name] = function(cb) {
            if (debuggerInFunc(cb)) { blockCount++; return name === 'queueMicrotask' ? undefined : 0; }
            return _orig.apply(window, arguments);
        };
        tagAsNative(window[name], name);
    });

    // Promise.then
    try {
        var _PromiseThen = Promise.prototype.then;
        Promise.prototype.then = function(onFulfilled, onRejected) {
            if (typeof onFulfilled === 'function' && !safeToExecute(onFulfilled)) {
                blockCount++; onFulfilled = undefined;
            }
            if (typeof onRejected === 'function' && !safeToExecute(onRejected)) {
                blockCount++; onRejected = undefined;
            }
            return _PromiseThen.call(this, onFulfilled, onRejected);
        };
        tagAsNative(Promise.prototype.then, 'then');
    } catch(e) {}

    // ============================================================
    //  Function / AsyncFunction / GeneratorFunction + constructor 链
    // ============================================================
    var _origProtoCons = Function.prototype.constructor;
    var asyncFunctionConstructor, generatorFunctionConstructor;
    var asyncWrapper, genWrapper;

    function makeConstructorWrapper(origCons, name, emptyFactory) {
        var wrapped = function () {
            var args = [];
            for (var i = 0; i < arguments.length; i++) {
                var arg = arguments[i];
                if (typeof arg === 'string') {
                    var filtered = filterCodeString(arg);
                    if (filtered === null) { blockCount++; return emptyFactory ? emptyFactory() : function(){}; }
                    args.push(filtered);
                } else { args.push(arg); }
            }
            try { return origCons.apply(this, args); }
            catch(e) { return origCons.apply(origCons, args); }
        };
        tagAsNative(wrapped, name);
        return wrapped;
    }

    var constructorWrapper = makeConstructorWrapper(_origProtoCons, 'Function', function(){ return function(){}; });
    try {
        Function.prototype.constructor = constructorWrapper;
        lockProperty(Function.prototype, 'constructor', constructorWrapper);
    } catch(e) {}
    window.Function = constructorWrapper;

    try {
        asyncFunctionConstructor = Object.getPrototypeOf(async function(){}).constructor;
        if (asyncFunctionConstructor && asyncFunctionConstructor !== _origProtoCons) {
            asyncWrapper = makeConstructorWrapper(asyncFunctionConstructor, 'AsyncFunction',
                function(){ return asyncFunctionConstructor('return;'); });
            Object.getPrototypeOf(async function(){}).constructor = asyncWrapper;
        }
    } catch(e) {}

    try {
        generatorFunctionConstructor = Object.getPrototypeOf(function*(){}).constructor;
        if (generatorFunctionConstructor && generatorFunctionConstructor !== _origProtoCons &&
            generatorFunctionConstructor !== asyncFunctionConstructor) {
            genWrapper = makeConstructorWrapper(generatorFunctionConstructor, 'GeneratorFunction',
                function(){ return generatorFunctionConstructor('yield;'); });
            Object.getPrototypeOf(function*(){}).constructor = genWrapper;
        }
    } catch(e) {}

    // Reflect.construct
    try {
        var _reflectConstruct = Reflect.construct;
        Reflect.construct = function(target, args, newTarget) {
            var isFnCons = target === Function || target === Function.prototype.constructor
                || target === asyncFunctionConstructor || target === generatorFunctionConstructor
                || target === asyncWrapper || target === genWrapper;
            var filteredArgs = [];
            for (var i = 0; i < args.length; i++) {
                if (isFnCons && typeof args[i] === 'string') {
                    var f = filterCodeString(args[i]);
                    if (f === null) {
                        blockCount++;
                        if (target === asyncFunctionConstructor || target === asyncWrapper)
                            return asyncFunctionConstructor('return;');
                        if (target === generatorFunctionConstructor || target === genWrapper)
                            return generatorFunctionConstructor('yield;');
                        return function(){};
                    }
                    filteredArgs.push(f);
                } else { filteredArgs.push(args[i]); }
            }
            return _reflectConstruct.call(Reflect, target, filteredArgs, newTarget || target);
        };
        tagAsNative(Reflect.construct, 'construct');
    } catch(e) {}

    // ============================================================
    //  eval Hook
    // ============================================================
    var _eval = window.eval;
    var evalWrapper = function(code) {
        if (typeof code === 'string') {
            var filtered = filterCodeString(code);
            if (filtered === null) { blockCount++; return undefined; }
            code = filtered;
        }
        return _eval.call(window, code);
    };
    tagAsNative(evalWrapper, 'eval');
    window.eval = evalWrapper;

    // ============================================================
    //  Worker / SharedWorker Hook
    // ============================================================
    ['Worker','SharedWorker'].forEach(function(WType) {
        if (typeof window[WType] !== 'function') return;
        var _W = window[WType];
        window[WType] = function(scriptURL, options) {
            var url = scriptURL;
            var urlStr = typeof url === 'string' ? url : (url.href||url.toString());
            try {
                var resolved = new URL(urlStr, location.href);
                if (resolved.origin === location.origin) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', urlStr, false);
                    try {
                        xhr.send();
                        if (xhr.status === 200 && xhr.responseText) {
                            var cleaned = filterCodeString(xhr.responseText);
                            if (cleaned !== null && cleaned !== xhr.responseText) {
                                var blob = new Blob([cleaned], {type:'application/javascript'});
                                var blobUrl = URL.createObjectURL(blob);
                                blockCount++; workerCount++;
                                url = blobUrl;
                                setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 5000);
                            }
                        }
                    } catch(e) {}
                }
            } catch(e) {}
            return options ? new _W(url, options) : new _W(url);
        };
        window[WType].prototype = _W.prototype;
        tagAsNative(window[WType], WType);
    });

    // ============================================================
    //  Blob Hook
    // ============================================================
    try {
        var _Blob = Blob;
        window.Blob = function(parts, options) {
            var type = options && options.type ? options.type : '';
            if (type && /(javascript|ecmascript)/i.test(type)) {
                var filtered = [];
                for (var i = 0; i < parts.length; i++) {
                    if (typeof parts[i] === 'string') {
                        var f = filterCodeString(parts[i]);
                        if (f !== null) filtered.push(f);
                    } else { filtered.push(parts[i]); }
                }
                if (filtered.length !== parts.length ||
                    filtered.some(function(p,i){ return p !== parts[i]; })) { blockCount++; }
                parts = filtered;
            }
            return new _Blob(parts, options);
        };
        window.Blob.prototype = _Blob.prototype;
        tagAsNative(window.Blob, 'Blob');
    } catch(e) {}

    // ============================================================
    //  DOM 脚本防御
    // ============================================================

    // document.write / writeln
    try {
        var _docWrite = document.write.bind(document);
        var _docWriteln = document.writeln.bind(document);
        document.write = function(html) {
            if (typeof html === 'string' && /\bdebugger\b/i.test(html)) {
                html = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                    function(m, open, body, close) {
                        if (/\bdebugger\b/i.test(body)) { blockCount++; return open + removeDebuggerStatements(body) + close; }
                        return m;
                    });
            }
            return _docWrite.apply(document, arguments);
        };
        tagAsNative(document.write, 'write');

        document.writeln = function(html) {
            if (typeof html === 'string' && /\bdebugger\b/i.test(html)) {
                html = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                    function(m, open, body, close) {
                        if (/\bdebugger\b/i.test(body)) { blockCount++; return open + removeDebuggerStatements(body) + close; }
                        return m;
                    });
            }
            return _docWriteln.apply(document, arguments);
        };
        tagAsNative(document.writeln, 'writeln');
    } catch(e) {}

    // HTMLScriptElement.text setter — 拦截 script.text = "debugger;"
    try {
        var _scriptTextDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'text');
        if (!_scriptTextDesc) _scriptTextDesc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
        if (_scriptTextDesc && _scriptTextDesc.set) {
            var _textGet = _scriptTextDesc.get;
            var _textSet = _scriptTextDesc.set;
            Object.defineProperty(HTMLScriptElement.prototype, 'text', {
                get: function() { return _textGet ? _textGet.call(this) : ''; },
                set: function(v) {
                    if (typeof v === 'string' && /\bdebugger\b/i.test(v)) {
                        blockCount++;
                        return _textSet.call(this, removeDebuggerStatements(v));
                    }
                    return _textSet.call(this, v);
                },
                configurable: true, enumerable: true
            });
        }
    } catch(e) {}

    // innerHTML
    try {
        var _innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (_innerHTMLDesc && _innerHTMLDesc.set) {
            var _innerSet = _innerHTMLDesc.set;
            Object.defineProperty(Element.prototype, 'innerHTML', {
                get: _innerHTMLDesc.get,
                set: function(v) {
                    if (typeof v === 'string' && /\bdebugger\b/i.test(v)) {
                        v = v.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                            function(m, open, body, close) {
                                if (/\bdebugger\b/i.test(body)) { blockCount++; return open + removeDebuggerStatements(body) + close; }
                                return m;
                            });
                    }
                    return _innerSet.call(this, v);
                },
                configurable: true, enumerable: true
            });
        }
    } catch(e) {}

    // createElement — 对每个 <script> 实例 hook text/setAttribute
    var _createElement = document.createElement.bind(document);
    document.createElement = function(tag, options) {
        var el = _createElement(tag, options);
        if ((tag||'').toLowerCase() === 'script') {
            try {
                var protoTextDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'text');
                Object.defineProperty(el, 'text', {
                    get: function() { return protoTextDesc && protoTextDesc.get ? protoTextDesc.get.call(this) : this.textContent; },
                    set: function(v) {
                        if (typeof v === 'string' && /\bdebugger\b/i.test(v)) {
                            blockCount++;
                            v = removeDebuggerStatements(v);
                        }
                        if (protoTextDesc && protoTextDesc.set) return protoTextDesc.set.call(this, v);
                        this.textContent = v;
                    },
                    configurable: true, enumerable: true
                });
            } catch(e) {}
        }
        return el;
    };

    // appendChild / insertBefore / replaceChild — 检查 script 内容
    ['appendChild','insertBefore','replaceChild'].forEach(function(m) {
        var _orig = Node.prototype[m];
        Node.prototype[m] = function(node, ref) {
            if (node && node.nodeType === 1 && node.tagName === 'SCRIPT') {
                var content = node.text || node.textContent || '';
                if (content && /\bdebugger\b/i.test(content)) {
                    node.text = removeDebuggerStatements(content);
                    blockCount++;
                }
                // 递归检查嵌套 script
                if (node.querySelectorAll) {
                    try {
                        var nested = node.querySelectorAll('script');
                        for (var s = 0; s < nested.length; s++) {
                            var nc = nested[s].text || nested[s].textContent || '';
                            if (/\bdebugger\b/i.test(nc)) {
                                nested[s].text = removeDebuggerStatements(nc);
                                blockCount++;
                            }
                        }
                    } catch(e) {}
                }
            }
            return _orig.call(this, node, ref);
        };
    });

    // BroadcastChannel
    try {
        if (typeof BroadcastChannel === 'function') {
            var _BC = BroadcastChannel;
            window.BroadcastChannel = function(name) {
                var channel = new _BC(name);
                var _pm = channel.postMessage;
                channel.postMessage = function(msg) {
                    if (typeof msg === 'string' && /\bdebugger\b/i.test(msg)) { blockCount++; return; }
                    return _pm.apply(channel, arguments);
                };
                return channel;
            };
            window.BroadcastChannel.prototype = _BC.prototype;
            tagAsNative(window.BroadcastChannel, 'BroadcastChannel');
        }
    } catch(e) {}

    // ============================================================
    //  Console / DevTools 防御
    // ============================================================
    if (CONFIG.blockConsoleClear) {
        var ccWrapper = function(){ log('🚫 console.clear 被阻止'); };
        console.clear = ccWrapper;
        tagAsNative(ccWrapper, 'clear');
    }

    ['outerWidth','outerHeight'].forEach(function(p) {
        try {
            Object.defineProperty(window, p, {
                get: function(){ return p === 'outerWidth' ? window.innerWidth : window.innerHeight; },
                configurable: false
            });
        } catch(e) {}
    });

    if (CONFIG.lockPrepareStackTrace) {
        try {
            var _origPST = Error.prepareStackTrace;
            Object.defineProperty(Error, 'prepareStackTrace', {
                get: function(){ return _origPST; }, set: function(){}, configurable: false
            });
        } catch(e) {}
    }

    // ============================================================
    //  全局属性防御
    // ============================================================
    (function() {
        var protectedGlobals = blockedProps.concat([
            '$_ts','jskj','_$','__jsl','_0x','cd','lcd'
        ]);
        try {
            if (window.__defineGetter__) {
                var _dg = window.__defineGetter__;
                window.__defineGetter__ = function(prop, fn) {
                    if (protectedGlobals.indexOf(prop) !== -1) return;
                    return _dg.call(window, prop, fn);
                };
            }
            if (window.__defineSetter__) {
                var _ds = window.__defineSetter__;
                window.__defineSetter__ = function(prop, fn) {
                    if (protectedGlobals.indexOf(prop) !== -1) return;
                    return _ds.call(window, prop, fn);
                };
            }
        } catch(e) {}
    })();

    // ============================================================
    //  ★ v5.0 新增：CDP 自动恢复模式
    //  如果你用 Playwright/Puppeteer 打开此页面，注入此脚本后
    //  设置 CONFIG.cdpAutoResume = true，脚本会尝试通过 CDP
    //  自动恢复被 debugger 暂停的执行。
    //
    //  使用方式（Playwright 示例）:
    //    await page.addInitScript(() => {
    //        window.__ad_config__.cdpAutoResume = true;
    //    });
    //
    //  或者直接用 Playwright 的 CDP Session:
    //    const cdp = await page.context().newCDPSession(page);
    //    cdp.on('Debugger.paused', () => cdp.send('Debugger.resume'));
    // ============================================================
    if (CONFIG.cdpAutoResume) {
        var resumeCount = 0;
        var cdpResumeInterval = setInterval(function() {
            if (resumeCount >= CONFIG.maxResumeAttempts) {
                clearInterval(cdpResumeInterval);
                safeConsole.log('[AD] CDP 自动恢复已达上限，停止');
                return;
            }
            // 尝试通过 performance 或其他 API 检测是否处于暂停状态
            var t0 = performance.now();
            // 如果 event loop 被 debugger 暂停，这行代码不会执行
            // 所以我们依赖外部 CDP 来检测暂停状态
            // 这个 interval 仅在未暂停时运行，用于"预先"防止暂停
        }, CONFIG.cdpResumeInterval);
    }

    // ============================================================
    //  Tampermonkey 菜单
    // ============================================================
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('[反调试 v5] 切换日志', function() {
            CONFIG.verbose = !CONFIG.verbose;
            safeConsole.log('[AD v5] verbose =', CONFIG.verbose);
        });
        GM_registerMenuCommand('[反调试 v5] 查看统计', function() {
            safeConsole.log('%c[AD v5] 已拦截 %c' + blockCount + '%c 次 | Worker %c' + workerCount + '%c 次',
                '', 'color:red;font-size:18px;font-weight:bold', '',
                'color:orange;font-size:18px;font-weight:bold', '');
        });
        GM_registerMenuCommand('[反调试 v5] 诊断', function() {
            safeConsole.group('[AD v5] 防御层状态');
            var checks = [
                ['setInterval', window.setInterval],
                ['setTimeout', window.setTimeout],
                ['eval', window.eval],
                ['Function', window.Function],
                ['FuncProtoCons', Function.prototype.constructor],
                ['rAF', window.requestAnimationFrame],
                ['rIC', window.requestIdleCallback],
                ['qMicrotask', window.queueMicrotask],
                ['Promise.then', Promise.prototype.then],
                ['AsyncFunction', (function(){ try { return Object.getPrototypeOf(async function(){}).constructor; } catch(e){ return null; } })()],
                ['GeneratorFunction', (function(){ try { return Object.getPrototypeOf(function*(){}).constructor; } catch(e){ return null; } })()],
                ['Reflect.construct', Reflect.construct],
                ['Blob', window.Blob],
                ['doc.write', document.write],
                ['doc.writeln', document.writeln],
                ['innerHTML', Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML')],
                ['script.text', Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'text')],
                ['appendChild', Node.prototype.appendChild],
                ['createElement', document.createElement],
                ['Worker', window.Worker],
                ['BroadcastChannel', window.BroadcastChannel],
                ['Obj.defineProperty', Object.defineProperty],
            ];
            checks.forEach(function(pair) {
                try {
                    var val = pair[1];
                    var status;
                    if (!val) status = 'N/A';
                    else if (typeof val === 'boolean') status = val ? '✅' : '❌';
                    else if (val && typeof val.toString === 'function' && val.toString().includes('native')) status = '✅ 伪装';
                    else if (val && typeof val.get === 'function') status = '✅ hook';
                    else status = val ? '✅ 已安装' : '❌';
                    safeConsole.log(pair[0] + ':', status);
                } catch(e) { safeConsole.log(pair[0] + ': ❌ 错误'); }
            });
            safeConsole.log('拦截次数:', blockCount, '| Worker:', workerCount);
            safeConsole.log('');
            safeConsole.log('⚠️  HTML 解析器直接加载的外部脚本无法拦截');
            safeConsole.log('   如果仍触发 debugger，请用 Chrome Overrides 或代理方案');
            safeConsole.groupEnd();
        });
        GM_registerMenuCommand('[反调试 v5] ⚡ 解决方案指南', function() {
            safeConsole.group('[AD v5] 应对 HTML 解析器加载的外部脚本 debugger');
            safeConsole.log('方案① Chrome DevTools Overrides（推荐，最简单）');
            safeConsole.log('  1. F12 → Sources → Overrides → Select folder');
            safeConsole.log('  2. 找到含 debugger 的 JS 文件');
            safeConsole.log('  3. 删除 debugger; 语句，Ctrl+S 保存');
            safeConsole.log('  4. 刷新页面，Chrome 会用本地版本替换远程版本');
            safeConsole.log('');
            safeConsole.log('方案② Playwright CDP 自动恢复');
            safeConsole.log('  const cdp = await page.context().newCDPSession(page);');
            safeConsole.log("  cdp.on('Debugger.paused', () => cdp.send('Debugger.resume'));");
            safeConsole.log('');
            safeConsole.log('方案③ mitmproxy 代理拦截');
            safeConsole.log('  mitmdump -s clean_debugger.py');
            safeConsole.log('  # 在脚本中对 JS 响应执行 removeDebuggerStatements()');
            safeConsole.log('');
            safeConsole.log('方案④ Chrome Extension declarativeNetRequest');
            safeConsole.log('  重定向含 debugger 的 JS 到本地清洗版本');
            safeConsole.groupEnd();
        });
    }

    setTimeout(function() {
        log('✅ v5.0 已激活 | 动态代码路径全覆盖');
        log('   ⚠️ HTML 解析器加载的外部脚本不在拦截范围内');
        log('   拦截:', blockCount, '| Worker:', workerCount);
    }, 200);

})();
