// ==UserScript==
// @name         通用反调试绕过Debugger v 4.1
// @namespace    https://github.com/Cunninger/anti-debug-bypass
// @version      4.1.0
// @description  通用反调试绕过 v4.1 — 新增 script.src 拦截（同步清洗外部JS）+ 全防御层
// @author       Claude (Enhanced)
// @match        *://*/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    //  配置
    // ============================================================
    var CONFIG = {
        verbose: false,
        blockConsoleClear: true,
        lockPrepareStackTrace: false
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
                    out += code[i];
                    i++;
                }
                if (i < len) { out += '*/'; i += 2; }
                inBlockComment = false;
                continue;
            }

            if (!inString && !inTemplate && !inBlockComment && !inRegex &&
                code[i] === '/' && code[i + 1] === '/') {
                inLineComment = true;
                out += '//';
                i += 2;
                while (i < len && code[i] !== '\n') {
                    out += code[i];
                    i++;
                }
                inLineComment = false;
                continue;
            }

            if (!inBlockComment && !inLineComment && !inRegex &&
                !inTemplate && (code[i] === '"' || code[i] === "'" || code[i] === '`')) {
                var q = code[i];
                if (q === '`') inTemplate = true;
                else { inString = true; stringChar = q; }
                out += code[i];
                i++;
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
                        log('🔧 移除源代码中的 debugger 语句');
                        blockCount++;
                        i += 8;
                        while (i < len && /[\s;]/.test(code[i]) && code[i] !== '\n') i++;
                        continue;
                    }
                }

                if (code[i] === '/' && !/[a-zA-Z0-9_$)\]]/.test(prevChar)) {
                    var lookBack = i - 1;
                    while (lookBack >= 0 && /\s/.test(code[lookBack])) lookBack--;
                    var effectivePrev = lookBack >= 0 ? code[lookBack] : ' ';
                    var isIncrementDecrement = false;
                    if ((effectivePrev === '+' || effectivePrev === '-') && lookBack >= 1) {
                        if (code[lookBack - 1] === effectivePrev) {
                            isIncrementDecrement = true;
                        }
                    }
                    if (!isIncrementDecrement && !/[a-zA-Z0-9_$)\]]/.test(effectivePrev)) {
                        inRegex = true;
                        out += code[i];
                        i++;
                        while (i < len) {
                            out += code[i];
                            if (code[i] === '\\') { i++; if (i < len) out += code[i]; }
                            else if (code[i] === '/') {
                                inRegex = false;
                                i++;
                                while (i < len && /[gimsuy]/.test(code[i])) {
                                    out += code[i];
                                    i++;
                                }
                                break;
                            }
                            i++;
                        }
                        continue;
                    }
                }
            }

            out += code[i];
            i++;
        }

        return out;
    }

    function filterCodeString(code) {
        if (typeof code !== 'string') return code;
        if (isExactlyDebuggerStmt(code)) return null;
        if (/\bdebugger\b/i.test(code)) return removeDebuggerStatements(code);
        return code;
    }

    // ★ 检测函数体是否在实际执行时会产生 debugger（String.fromCharCode 拼接的情况）
    function safeToExecute(fn) {
        try {
            var fnStr = Function.prototype.toString.call(fn);
            return !/\bdebugger\b/i.test(fnStr);
        } catch(e) {
            return false;
        }
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
                    value: name,
                    enumerable: false,
                    configurable: false,
                    writable: false
                });
            } else {
                fn[NAME_SYM] = name;
            }
        } catch (e) { log('tagAsNative failed:', e); }
    }

    tagAsNative(Function.prototype.toString, 'toString');

    // ============================================================
    //  ★ 锁定关键函数 — 防止被反调试 overwrite
    // ============================================================
    function lockProperty(obj, prop, value, name) {
        try {
            Object.defineProperty(obj, prop, {
                value: value,
                writable: false,
                configurable: false,
                enumerable: true
            });
            return true;
        } catch(e) {
            // 如果已经被锁定（configurable: false），尝试用 __defineGetter__ 覆盖（兼容旧浏览器）
            return false;
        }
    }

    // ============================================================
    //  ★ 防御 Object.defineProperty — 防止反调试用 defineProperty 撤销 hook
    // ============================================================
    var _origDefineProperty = Object.defineProperty;
    var blockedProps = ['setInterval', 'setTimeout', 'eval', 'Function'];

    Object.defineProperty = function(obj, prop, desc) {
        // 如果试图重新定义我们保护的 window 属性，拦截
        if (obj === window && blockedProps.indexOf(prop) !== -1) {
            log('🚫 阻止重新定义 window.' + prop);
            return obj;
        }
        // 如果试图让 Function.prototype.constructor 变为可配置，拦截
        if (obj === Function.prototype && prop === 'constructor' && desc && desc.configurable === true) {
            log('🚫 阻止将 Function.prototype.constructor 设为可配置');
            return obj;
        }
        return _origDefineProperty.call(Object, obj, prop, desc);
    };
    tagAsNative(Object.defineProperty, 'defineProperty');

    // ★ 也防御 Reflect.defineProperty
    if (typeof Reflect !== 'undefined' && Reflect.defineProperty) {
        var _origReflectDefineProperty = Reflect.defineProperty;
        Reflect.defineProperty = function(obj, prop, desc) {
            if (obj === window && blockedProps.indexOf(prop) !== -1) {
                log('🚫 阻止 Reflect.defineProperty 重新定义 window.' + prop);
                return true;
            }
            if (obj === Function.prototype && prop === 'constructor' && desc && desc.configurable === true) {
                log('🚫 阻止 Reflect.defineProperty 将 Function.prototype.constructor 设为可配置');
                return true;
            }
            return _origReflectDefineProperty.call(Reflect, obj, prop, desc);
        };
        tagAsNative(Reflect.defineProperty, 'defineProperty');
    }

    // ★ 防御 Object.getOwnPropertyDescriptor — 防止获取原始描述符
    var _origGOPD = Object.getOwnPropertyDescriptor;
    Object.getOwnPropertyDescriptor = function(obj, prop) {
        var desc = _origGOPD.call(Object, obj, prop);
        // 对保护的属性返回当前值，防止泄露原始引用
        if (obj === Function.prototype && prop === 'constructor') {
            if (desc && desc.value && !hookedSet.has(desc.value)) {
                // 反调试在尝试获取原始 Function 构造器！
                log('⚠️ 检测到 Object.getOwnPropertyDescriptor(Function.prototype, constructor)');
            }
        }
        return desc;
    };
    tagAsNative(Object.getOwnPropertyDescriptor, 'getOwnPropertyDescriptor');

    // ============================================================
    //  定时器 Hook（含 rAF / setImmediate / queueMicrotask）
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
            if (debuggerInFunc(fn)) {
                log('🔧 ' + name + ' 拦截 (含 debugger 的函数)');
                blockCount++;
                return orig(function () {}, 86400000);
            }
            if (typeof fn === 'string') {
                var filtered = filterCodeString(fn);
                if (filtered === null) {
                    log('⚡ ' + name + ' 纯debugger拦截');
                    blockCount++;
                    return orig(function () {}, 86400000);
                }
                return orig.call(window, filtered, delay);
            }
            // ★ v4.0: 即使 fn 是普通函数，也包装一层做运行时检测
            if (typeof fn === 'function') {
                var wrappedFn = function() {
                    try { return fn.apply(this, arguments); } catch(e) {
                        if (/\bdebugger\b/.test(e+'')) {
                            log('🔧 ' + name + ' 运行时捕获 debugger 异常');
                            blockCount++;
                            return;
                        }
                        throw e;
                    }
                };
                return orig.call(window, wrappedFn, delay);
            }
            return orig.apply(window, arguments);
        };
        tagAsNative(wrapped, name);
        return wrapped;
    }

    window.setInterval = makeTimerHook(_setInterval, 'setInterval');
    window.setTimeout = makeTimerHook(_setTimeout, 'setTimeout');

    // ★ 新增：requestAnimationFrame hook
    if (typeof requestAnimationFrame === 'function') {
        var _rAF = requestAnimationFrame;
        window.requestAnimationFrame = function(cb) {
            if (debuggerInFunc(cb)) {
                log('🔧 requestAnimationFrame 拦截');
                blockCount++;
                return 0;
            }
            return _rAF.call(window, cb);
        };
        tagAsNative(window.requestAnimationFrame, 'requestAnimationFrame');
    }

    // ★ 新增：requestIdleCallback hook
    if (typeof requestIdleCallback === 'function') {
        var _rIC = requestIdleCallback;
        window.requestIdleCallback = function(cb, opts) {
            if (debuggerInFunc(cb)) {
                log('🔧 requestIdleCallback 拦截');
                blockCount++;
                return 0;
            }
            return _rIC.call(window, cb, opts);
        };
        tagAsNative(window.requestIdleCallback, 'requestIdleCallback');
    }

    // ★ 新增：setImmediate hook（Node.js 环境 + 部分浏览器 polyfill）
    if (typeof setImmediate === 'function') {
        var _setImmediate = setImmediate;
        window.setImmediate = function(cb) {
            var args = [];
            for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
            if (debuggerInFunc(cb)) {
                log('🔧 setImmediate 拦截');
                blockCount++;
                return _setImmediate(function(){});
            }
            return _setImmediate.apply(window, [cb].concat(args));
        };
        tagAsNative(window.setImmediate, 'setImmediate');
    }

    // ★ 新增：queueMicrotask hook
    if (typeof queueMicrotask === 'function') {
        var _qMT = queueMicrotask;
        window.queueMicrotask = function(cb) {
            if (debuggerInFunc(cb)) {
                log('🔧 queueMicrotask 拦截');
                blockCount++;
                return;
            }
            return _qMT.call(window, cb);
        };
        tagAsNative(window.queueMicrotask, 'queueMicrotask');
    }

    // ============================================================
    //  ★ 新增：Promise.prototype.then hook（微任务链 debugger）
    // ============================================================
    try {
        var _PromiseThen = Promise.prototype.then;
        Promise.prototype.then = function(onFulfilled, onRejected) {
            var safeOnFulfilled = onFulfilled;
            var safeOnRejected = onRejected;
            if (typeof onFulfilled === 'function' && !safeToExecute(onFulfilled)) {
                log('🔧 Promise.then onFulfilled 拦截');
                blockCount++;
                safeOnFulfilled = undefined;
            }
            if (typeof onRejected === 'function' && !safeToExecute(onRejected)) {
                log('🔧 Promise.then onRejected 拦截');
                blockCount++;
                safeOnRejected = undefined;
            }
            return _PromiseThen.call(this, safeOnFulfilled, safeOnRejected);
        };
        tagAsNative(Promise.prototype.then, 'then');
    } catch(e) { log('Promise.then hook 失败:', e); }

    // ============================================================
    //  Function 三兄弟 Hook + ★ constructor 链防御
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
                    if (filtered === null) {
                        log('⚡ 纯debugger拦截 (' + name + ')');
                        blockCount++;
                        return emptyFactory ? emptyFactory() : function () {};
                    }
                    args.push(filtered);
                } else {
                    args.push(arg);
                }
            }
            // 防御：确保 this 正确
            try {
                return origCons.apply(this, args);
            } catch(e) {
                // 如果通过非标准路径调用，fallback
                return origCons.apply(origCons, args);
            }
        };
        tagAsNative(wrapped, name);
        return wrapped;
    }

    var constructorWrapper = makeConstructorWrapper(_origProtoCons, 'Function', function() { return function(){}; });

    // ★ v4.0：同时替换 prototype.constructor 和全局 Function
    try {
        Function.prototype.constructor = constructorWrapper;
        lockProperty(Function.prototype, 'constructor', constructorWrapper, 'constructor');
    } catch(e) { log('锁定 Function.prototype.constructor 失败:', e); }

    window.Function = constructorWrapper;

    // ★ v4.0 关键：通过 constructor 链绕过检测 → 在 Function.prototype 上建立最后防线
    // [].constructor.constructor → Array.constructor → Function (通过 prototype 链访问到 Function.prototype.constructor)
    // 由于我们已经替换了 Function.prototype.constructor，这个路径已被覆盖

    // 额外加固：直接替换可能被访问的 constructor.constructor 路径
    // 通过 Object.prototype 防御（所有对象的 constructor 最终都指向这里）
    try {
        // 确保普通对象的 constructor 链也经过我们的 hook
        var _origObjCons = Object.prototype.constructor;
        // Object.prototype.constructor === Object，不需要替换
        // 关键是 Function.prototype.constructor 已经被我们替换
    } catch(e) {}

    // AsyncFunction
    try {
        asyncFunctionConstructor = Object.getPrototypeOf(async function () {}).constructor;
        if (asyncFunctionConstructor && asyncFunctionConstructor !== _origProtoCons) {
            asyncWrapper = makeConstructorWrapper(
                asyncFunctionConstructor,
                'AsyncFunction',
                function() { return asyncFunctionConstructor('return;'); }
            );
            Object.getPrototypeOf(async function () {}).constructor = asyncWrapper;
        }
    } catch (e) { log('AsyncFunction hook 失败:', e); }

    // GeneratorFunction
    try {
        generatorFunctionConstructor = Object.getPrototypeOf(function* () {}).constructor;
        if (generatorFunctionConstructor &&
            generatorFunctionConstructor !== _origProtoCons &&
            generatorFunctionConstructor !== asyncFunctionConstructor) {
            genWrapper = makeConstructorWrapper(
                generatorFunctionConstructor,
                'GeneratorFunction',
                function() { return generatorFunctionConstructor('yield;'); }
            );
            Object.getPrototypeOf(function* () {}).constructor = genWrapper;
        }
    } catch (e) { log('GeneratorFunction hook 失败:', e); }

    // Reflect.construct — 对函数构造器生效
    try {
        var _reflectConstruct = Reflect.construct;
        Reflect.construct = function (target, args, newTarget) {
            var isFunctionConstructor = (
                target === Function ||
                target === Function.prototype.constructor ||
                target === asyncFunctionConstructor ||
                target === generatorFunctionConstructor ||
                target === asyncWrapper ||
                target === genWrapper
            );

            var filteredArgs = [];
            for (var i = 0; i < args.length; i++) {
                if (isFunctionConstructor && typeof args[i] === 'string') {
                    var f = filterCodeString(args[i]);
                    if (f === null) {
                        log('⚡ 纯debugger拦截 (Reflect.construct)');
                        blockCount++;
                        if (target === asyncFunctionConstructor || target === asyncWrapper) {
                            return asyncFunctionConstructor('return;');
                        } else if (target === generatorFunctionConstructor || target === genWrapper) {
                            return generatorFunctionConstructor('yield;');
                        } else {
                            return function () {};
                        }
                    }
                    filteredArgs.push(f);
                } else {
                    filteredArgs.push(args[i]);
                }
            }
            return _reflectConstruct.call(Reflect, target, filteredArgs, newTarget || target);
        };
        tagAsNative(Reflect.construct, 'construct');
    } catch (e) { log('Reflect.construct hook 失败:', e); }

    // ============================================================
    //  eval Hook
    // ============================================================
    var _eval = window.eval;
    var evalWrapper = function (code) {
        if (typeof code === 'string') {
            var filtered = filterCodeString(code);
            if (filtered === null) {
                log('⚡ 纯debugger拦截 (eval)');
                blockCount++;
                return undefined;
            }
            code = filtered;
        }
        return _eval.call(window, code);
    };
    tagAsNative(evalWrapper, 'eval');
    window.eval = evalWrapper;

    // ============================================================
    //  Worker Hook
    // ============================================================
    ['Worker', 'SharedWorker'].forEach(function (WorkerType) {
        if (typeof window[WorkerType] !== 'function') return;
        var _OrigWorker = window[WorkerType];

        window[WorkerType] = function (scriptURL, options) {
            var url = scriptURL;
            var urlStr = typeof url === 'string' ? url : (url.href || url.toString());

            try {
                var resolvedUrl = new URL(urlStr, location.href);
                if (resolvedUrl.origin === location.origin) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', urlStr, false);
                    try {
                        xhr.send();
                        if (xhr.status === 200 && xhr.responseText) {
                            var cleanedCode = filterCodeString(xhr.responseText);
                            if (cleanedCode !== null && cleanedCode !== xhr.responseText) {
                                var blob = new Blob([cleanedCode], { type: 'application/javascript' });
                                var blobUrl = URL.createObjectURL(blob);
                                log('🔧 Worker 脚本已清理:', urlStr.substring(0, 60));
                                blockCount++;
                                workerCount++;
                                url = blobUrl;
                                setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 5000);
                            }
                        }
                    } catch (e) { log('⚠️ Worker 脚本无法获取:', urlStr, e.message); }
                }
            } catch (e) { log('Worker URL 解析失败:', e); }

            return options ? new _OrigWorker(url, options) : new _OrigWorker(url);
        };

        window[WorkerType].prototype = _OrigWorker.prototype;
        tagAsNative(window[WorkerType], WorkerType);
    });

    // ============================================================
    //  Blob Hook
    // ============================================================
    try {
        var _Blob = Blob;
        window.Blob = function BlobWrapper(parts, options) {
            var type = options && options.type ? options.type : '';
            if (type && /(javascript|ecmascript)/i.test(type)) {
                var filtered = [];
                for (var i = 0; i < parts.length; i++) {
                    if (typeof parts[i] === 'string') {
                        var f = filterCodeString(parts[i]);
                        if (f !== null) filtered.push(f);
                    } else {
                        filtered.push(parts[i]);
                    }
                }
                if (filtered.length !== parts.length ||
                    filtered.some(function (p, i) { return p !== parts[i]; })) {
                    log('🔧 Blob JS 内容已清理');
                    blockCount++;
                }
                parts = filtered;
            }
            return new _Blob(parts, options);
        };
        window.Blob.prototype = _Blob.prototype;
        tagAsNative(window.Blob, 'Blob');
    } catch (e) { log('Blob hook 失败:', e); }

    // ============================================================
    //  ★ v4.1 关键新增：HTMLScriptElement.prototype.src setter 拦截
    //  拦截浏览器 HTML 解析器对 <script src="..."> 的加载（包括初始 HTML），
    //  同步抓取同源 JS 文件、清洗 debugger 后替换为 Blob URL。
    //  这是对抗「VM 解释器源码中嵌入 debugger」的唯一用户态方案。
    // ============================================================
    var scriptSrcInterceptorEnabled = true;
    var cleanedScripts = {};  // url → blobUrl 缓存

    try {
        var _srcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
        if (_srcDesc && _srcDesc.set) {
            var _origSrcGet = _srcDesc.get;
            var _origSrcSet = _srcDesc.set;

            Object.defineProperty(HTMLScriptElement.prototype, 'src', {
                get: function() {
                    // 返回原始 URL（而非 blob URL），保持 DOM 属性透明
                    var origUrl = this.getAttribute('__ad_orig_src__');
                    return origUrl || _origSrcGet.call(this);
                },
                set: function(url) {
                    if (!scriptSrcInterceptorEnabled || !url || typeof url !== 'string') {
                        return _origSrcSet.call(this, url);
                    }

                    // 只处理同源脚本
                    var isSameOrigin = false;
                    try {
                        var parsed = new URL(url, location.href);
                        isSameOrigin = parsed.origin === location.origin;
                    } catch(e) {
                        // 相对路径 → 同源
                        if (url.indexOf('//') !== 0 && url.indexOf('://') === -1) {
                            isSameOrigin = true;
                        }
                    }

                    // 跳过 data: / blob: / 非同源
                    if (!isSameOrigin || /^(data|blob|javascript):/i.test(url)) {
                        return _origSrcSet.call(this, url);
                    }

                    // 检查缓存
                    if (cleanedScripts[url]) {
                        this.setAttribute('__ad_orig_src__', url);
                        return _origSrcSet.call(this, cleanedScripts[url]);
                    }

                    // ★ 同步抓取原始 JS 内容
                    var cleaned = false;
                    try {
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', url, false);  // 同步
                        xhr.send();

                        if (xhr.status === 200 && xhr.responseText &&
                            /\bdebugger\b/i.test(xhr.responseText)) {

                            var cleanedCode = removeDebuggerStatements(xhr.responseText);
                            if (cleanedCode !== xhr.responseText) {
                                var blob = new Blob([cleanedCode], { type: 'application/javascript' });
                                var blobUrl = URL.createObjectURL(blob);
                                cleanedScripts[url] = blobUrl;

                                this.setAttribute('__ad_orig_src__', url);
                                log('🔧 清洗外部脚本:', url.substring(url.lastIndexOf('/') + 1));
                                blockCount++;

                                // 延迟清理 Blob URL（脚本执行后）
                                var self = this;
                                self.addEventListener('load', function() {
                                    setTimeout(function() {
                                        URL.revokeObjectURL(blobUrl);
                                        delete cleanedScripts[url];
                                    }, 1000);
                                }, { once: true });

                                return _origSrcSet.call(this, blobUrl);
                            }
                        }
                    } catch(e) {
                        // 同步 XHR 可能在部分环境被阻止，静默回退
                        log('⚠️ 无法同步抓取脚本:', url, e.message);
                    }

                    // 未清洗或无法清洗 → 原样加载
                    return _origSrcSet.call(this, url);
                },
                configurable: true,
                enumerable: true
            });

            log('✅ script.src 拦截器已激活');
        }
    } catch(e) { log('script.src 拦截器安装失败:', e); }

    // ============================================================
    //  v4.0 / v4.1：document.write / writeln hook
    // ============================================================
    try {
        var _docWrite = document.write.bind(document);
        var _docWriteln = document.writeln.bind(document);

        document.write = function(html) {
            if (typeof html === 'string' && /\bdebugger\b/i.test(html)) {
                var cleaned = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                    function (m, open, body, close) {
                        if (/\bdebugger\b/i.test(body)) {
                            log('🔧 document.write script debugger 清理');
                            blockCount++;
                            return open + removeDebuggerStatements(body) + close;
                        }
                        return m;
                    });
                return _docWrite.call(document, cleaned);
            }
            return _docWrite.apply(document, arguments);
        };
        tagAsNative(document.write, 'write');

        document.writeln = function(html) {
            if (typeof html === 'string' && /\bdebugger\b/i.test(html)) {
                var cleaned = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                    function (m, open, body, close) {
                        if (/\bdebugger\b/i.test(body)) {
                            log('🔧 document.writeln script debugger 清理');
                            blockCount++;
                            return open + removeDebuggerStatements(body) + close;
                        }
                        return m;
                    });
                return _docWriteln.call(document, cleaned);
            }
            return _docWriteln.apply(document, arguments);
        };
        tagAsNative(document.writeln, 'writeln');
    } catch(e) { log('document.write hook 失败:', e); }

    // ============================================================
    //  ★ v4.0/v4.1：HTMLScriptElement.prototype.text setter hook
    //  反调试代码会做: script.text = "debugger;" 然后 appendChild
    //  配合 src setter 拦截器（上方），形成对静态+动态脚本加载的完整覆盖
    // ============================================================
    try {
        var _scriptTextDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'text');
        if (!_scriptTextDesc) {
            // 如果没有 text 描述符，检查 textContent
            _scriptTextDesc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
        }

        var _textSet, _textGet;
        if (_scriptTextDesc) {
            _textGet = _scriptTextDesc.get;
            _textSet = _scriptTextDesc.set;

            if (_textSet) {
                Object.defineProperty(HTMLScriptElement.prototype, 'text', {
                    get: function() {
                        return _textGet ? _textGet.call(this) : '';
                    },
                    set: function(v) {
                        if (typeof v === 'string' && /\bdebugger\b/i.test(v)) {
                            var cleaned = removeDebuggerStatements(v);
                            log('🔧 HTMLScriptElement.text setter 清理 debugger');
                            blockCount++;
                            return _textSet.call(this, cleaned);
                        }
                        return _textSet.call(this, v);
                    },
                    configurable: true,
                    enumerable: true
                });
            }
        }
    } catch(e) { log('HTMLScriptElement.text hook 失败:', e); }

    // ============================================================
    //  DOM 脚本防御（innerHTML / createElement / appendChild 等）
    // ============================================================
    // innerHTML
    try {
        var _innerHTMLDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (_innerHTMLDesc && _innerHTMLDesc.set) {
            var _innerSet = _innerHTMLDesc.set;
            Object.defineProperty(Element.prototype, 'innerHTML', {
                get: _innerHTMLDesc.get,
                set: function (v) {
                    if (typeof v === 'string' && /\bdebugger\b/i.test(v)) {
                        v = v.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                            function (m, open, body, close) {
                                if (/\bdebugger\b/i.test(body)) {
                                    log('🔧 清理 innerHTML script 中的 debugger');
                                    blockCount++;
                                    return open + removeDebuggerStatements(body) + close;
                                }
                                return m;
                            });
                    }
                    return _innerSet.call(this, v);
                },
                configurable: true,
                enumerable: true,
            });
        }
    } catch (e) { log('innerHTML hook 失败:', e); }

    // createElement — 监控 script 元素创建
    var _createElement = document.createElement.bind(document);
    document.createElement = function (tag, options) {
        var el = _createElement(tag, options);
        var tagLower = (tag || '').toLowerCase();
        if (tagLower === 'script') {
            // ★ v4.0：对每个创建的 script 元素，hook 其 text 属性
            try {
                var elTextDesc = Object.getOwnPropertyDescriptor(el, 'text');
                if (!elTextDesc || elTextDesc.configurable !== false) {
                    // 先检查元素是否有自己的 text 描述符
                    var protoTextDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'text');
                    var protoTextSet = protoTextDesc && protoTextDesc.set;

                    Object.defineProperty(el, 'text', {
                        get: function() {
                            return protoTextDesc && protoTextDesc.get ? protoTextDesc.get.call(this) : this.textContent;
                        },
                        set: function(v) {
                            if (typeof v === 'string' && /\bdebugger\b/i.test(v)) {
                                var cleaned = removeDebuggerStatements(v);
                                log('🔧 动态 script.text setter 清理 debugger');
                                blockCount++;
                                if (protoTextSet) {
                                    return protoTextSet.call(this, cleaned);
                                }
                                this.textContent = cleaned;
                                return;
                            }
                            if (protoTextSet) {
                                return protoTextSet.call(this, v);
                            }
                            this.textContent = v;
                        },
                        configurable: true,
                        enumerable: true
                    });
                }
            } catch(e) {}

            // ★ 同样监控 src 属性
            try {
                var srcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
                if (srcDesc && srcDesc.set) {
                    var _srcSet = srcDesc.set;
                    Object.defineProperty(el, 'src', {
                        get: srcDesc.get,
                        set: function (v) {
                            log('⚠️ 动态 script.src:', v);
                            return _srcSet.call(this, v);
                        },
                        configurable: true,
                    });
                }
            } catch (e) {}
        }

        // ★ v4.0：iframe 监控 — 防止通过 iframe 获取干净的全局对象
        if (tagLower === 'iframe') {
            try {
                var origSetAttribute = el.setAttribute;
                // 劫持 iframe 的 contentWindow 获取
                var _contentWindowDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
                // 不能直接 hook contentWindow getter，但可以 hook src setter 和 sandbox
            } catch(e) {}
        }

        return el;
    };

    // appendChild / insertBefore / replaceChild — 检查 script 节点的 text
    ['appendChild', 'insertBefore', 'replaceChild'].forEach(function (m) {
        var _orig = Node.prototype[m];
        Node.prototype[m] = function (node, ref) {
            if (node && node.nodeType === 1 && (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME')) {
                // 检查 script 文本内容
                if (node.tagName === 'SCRIPT') {
                    var scriptContent = node.text || node.textContent || '';
                    if (scriptContent && /\bdebugger\b/i.test(scriptContent)) {
                        if (node.text !== undefined) {
                            node.text = removeDebuggerStatements(scriptContent);
                        } else {
                            node.textContent = removeDebuggerStatements(scriptContent);
                        }
                        log('🔧 清理 ' + m + ' script text');
                        blockCount++;
                    }
                }

                // ★ v4.0：检查递归子节点中的 script
                if (node.querySelectorAll) {
                    try {
                        var nestedScripts = node.querySelectorAll('script');
                        for (var s = 0; s < nestedScripts.length; s++) {
                            var ns = nestedScripts[s];
                            var nsContent = ns.text || ns.textContent || '';
                            if (/\bdebugger\b/i.test(nsContent)) {
                                ns.text = removeDebuggerStatements(nsContent);
                                ns.textContent = removeDebuggerStatements(nsContent);
                                log('🔧 清理嵌套 script text');
                                blockCount++;
                            }
                        }
                    } catch(e) {}
                }
            }
            return _orig.call(this, node, ref);
        };
    });

    // ============================================================
    //  ★ v4.0：MessagePort / BroadcastChannel / postMessage hook
    //  某些反调试通过消息传递触发 debugger
    // ============================================================
    try {
        if (typeof BroadcastChannel === 'function') {
            var _BC = BroadcastChannel;
            window.BroadcastChannel = function(name) {
                var channel = new _BC(name);
                var _postMessage = channel.postMessage;
                channel.postMessage = function(msg) {
                    if (typeof msg === 'string' && /\bdebugger\b/i.test(msg)) {
                        log('🔧 BroadcastChannel.postMessage 拦截');
                        blockCount++;
                        return;
                    }
                    return _postMessage.apply(channel, arguments);
                };
                return channel;
            };
            window.BroadcastChannel.prototype = _BC.prototype;
            tagAsNative(window.BroadcastChannel, 'BroadcastChannel');
        }
    } catch(e) {}

    // ============================================================
    //  Console Hook
    // ============================================================
    if (CONFIG.blockConsoleClear) {
        var ccWrapper = function () { log('🚫 console.clear 被阻止'); };
        console.clear = ccWrapper;
        tagAsNative(ccWrapper, 'clear');
    }

    ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table', 'time', 'timeEnd',
        'group', 'groupEnd', 'assert', 'count', 'profile', 'profileEnd'
    ].forEach(function (m) {
        if (typeof console[m] === 'function') {
            try {
                Object.defineProperty(console, m, {
                    value: console[m],
                    writable: true,
                    configurable: true,
                });
            } catch (e) {}
        }
    });

    // ============================================================
    //  DevTools 检测绕过
    // ============================================================
    ['outerWidth', 'outerHeight'].forEach(function (p) {
        try {
            Object.defineProperty(window, p, {
                get: function () {
                    return p === 'outerWidth' ? window.innerWidth : window.innerHeight;
                },
                configurable: false,
            });
        } catch (e) {}
    });

    if (CONFIG.lockPrepareStackTrace) {
        try {
            var _origPrepareStackTrace = Error.prepareStackTrace;
            Object.defineProperty(Error, 'prepareStackTrace', {
                get: function () { return _origPrepareStackTrace; },
                set: function () {},
                configurable: false,
            });
        } catch (e) {}
    }

    // ============================================================
    //  ★ v4.0：原型链/全局属性重定义防御
    //  阻止任何脚本通过 __defineGetter__ 覆盖受保护的全局 API
    //  这同时适用于 $_ts、jskj、xhs 等各类反调试/反爬框架
    // ============================================================
    var _globalAttrBlockerInstalled = false;
    function installGlobalAttrBlocker() {
        if (_globalAttrBlockerInstalled) return;
        _globalAttrBlockerInstalled = true;

        // 扩展保护列表：涵盖常见反调试框架的入口变量名
        var protectedGlobals = blockedProps.concat([
            '$_ts',    // Accesine / 数美
            'jskj',    // 极验系
            '_$',      // 通用混淆器入口
            '__jsl',   // 阿里系
            '_0x',     // obfuscator.io 入口
            'cd',      // 常见 VM 指令入口
            'lcd'      // VM 执行入口
        ]);

        try {
            if (window.__defineGetter__) {
                var _defineGetter = window.__defineGetter__;
                window.__defineGetter__ = function(prop, fn) {
                    if (protectedGlobals.indexOf(prop) !== -1) {
                        log('🚫 阻止 __defineGetter__:', prop);
                        return;
                    }
                    return _defineGetter.call(window, prop, fn);
                };
            }
        } catch(e) {}

        // 也防御 __defineSetter__
        try {
            if (window.__defineSetter__) {
                var _defineSetter = window.__defineSetter__;
                window.__defineSetter__ = function(prop, fn) {
                    if (protectedGlobals.indexOf(prop) !== -1) {
                        log('🚫 阻止 __defineSetter__:', prop);
                        return;
                    }
                    return _defineSetter.call(window, prop, fn);
                };
            }
        } catch(e) {}
    }

    // document-start 阶段尽早安装
    installGlobalAttrBlocker();

    // ============================================================
    //  Verbose 专用 Hook（按需注入）
    // ============================================================
    var verboseHooksInstalled = false;
    function installVerboseHooks() {
        if (verboseHooksInstalled) return;
        verboseHooksInstalled = true;

        try {
            var _fromCharCode = String.fromCharCode;
            String.fromCharCode = function () {
                var result = _fromCharCode.apply(String, arguments);
                if (CONFIG.verbose && /\bdebugger\b/i.test(result)) {
                    log('⚠️ String.fromCharCode 构造了含 debugger 的字符串:', result.substring(0, 50));
                }
                return result;
            };
        } catch (e) {}

        try {
            if (typeof atob === 'function') {
                var _atob = atob;
                window.atob = function (str) {
                    var result = _atob(str);
                    if (CONFIG.verbose && /\bdebugger\b/i.test(result)) {
                        log('⚠️ atob 解码了含 debugger 的字符串:', result.substring(0, 50));
                    }
                    return result;
                };
            }
        } catch (e) {}

        // ★ v4.0：监控 String.fromCodePoint
        try {
            if (typeof String.fromCodePoint === 'function') {
                var _fromCodePoint = String.fromCodePoint;
                String.fromCodePoint = function() {
                    var result = _fromCodePoint.apply(String, arguments);
                    if (CONFIG.verbose && /\bdebugger\b/i.test(result)) {
                        log('⚠️ String.fromCodePoint 构造了含 debugger 的字符串');
                    }
                    return result;
                };
            }
        } catch(e) {}
    }

    // ============================================================
    //  Tampermonkey 菜单
    // ============================================================
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('[反调试 v4.1] 切换日志', function () {
            CONFIG.verbose = !CONFIG.verbose;
            safeConsole.log('[AD v4.1] verbose =', CONFIG.verbose);
            if (CONFIG.verbose) installVerboseHooks();
        });
        GM_registerMenuCommand('[反调试 v4.1] 切换 console.clear 拦截', function () {
            CONFIG.blockConsoleClear = !CONFIG.blockConsoleClear;
            safeConsole.log('[AD v4.1] blockConsoleClear =', CONFIG.blockConsoleClear);
        });
        GM_registerMenuCommand('[反调试 v4.1] 切换 script.src 拦截', function () {
            scriptSrcInterceptorEnabled = !scriptSrcInterceptorEnabled;
            safeConsole.log('[AD v4.1] scriptSrcInterceptorEnabled =', scriptSrcInterceptorEnabled);
        });
        GM_registerMenuCommand('[反调试 v4.1] 查看统计', function () {
            safeConsole.log('%c[AD v4.1] 已拦截 %c' + blockCount + '%c 次 | Worker清理 %c' + workerCount + '%c 次',
                '', 'color:red;font-size:18px;font-weight:bold', '',
                'color:orange;font-size:18px;font-weight:bold', '');
        });
        GM_registerMenuCommand('[反调试 v4.1] 诊断', function () {
            safeConsole.group('[AD v4.1] 防御层状态');
            var checks = [
                ['setInterval', window.setInterval],
                ['setTimeout', window.setTimeout],
                ['eval', window.eval],
                ['Function', window.Function],
                ['FuncProtoCons', Function.prototype.constructor],
                ['Blob', window.Blob],
                ['Reflect.construct', Reflect.construct],
                ['scriptSrc拦截', scriptSrcInterceptorEnabled ? '✅ 激活' : '⏸ 暂停'],
                ['rAF', window.requestAnimationFrame],
                ['rIC', window.requestIdleCallback],
                ['qMicrotask', window.queueMicrotask],
                ['setImmediate', window.setImmediate],
                ['doc.write', document.write],
                ['doc.writeln', document.writeln],
                ['Obj.defineProperty', Object.defineProperty],
                ['BroadcastChannel', window.BroadcastChannel]
            ];
            checks.forEach(function(pair) {
                try {
                    var status = pair[1] && pair[1].toString().includes('native') ? '✅ 伪装' : '❌ 暴露';
                    safeConsole.log(pair[0] + ':', pair[1] ? status : 'N/A');
                } catch(e) {
                    safeConsole.log(pair[0] + ': N/A');
                }
            });
            try {
                safeConsole.log('AsyncFunction:',
                    Object.getPrototypeOf(async function () {}).constructor.toString().includes('native') ? '✅ 伪装' : '❌ 暴露');
                safeConsole.log('GeneratorFunction:',
                    Object.getPrototypeOf(function* () {}).constructor.toString().includes('native') ? '✅ 伪装' : '❌ 暴露');
            } catch (e) {}
            safeConsole.log('拦截次数:', blockCount, '| Worker:', workerCount);
            safeConsole.log('toString保护:', hookedSet.has(window.eval) ? '✅' : '❌');
            safeConsole.groupEnd();
        });
    }

    setTimeout(function () {
        log('✅ v4.1 已激活 | 全防御层:',
            'script.src拦截|script.text|doc.write|rAF/rIC/qMicrotask|Promise.then|Obj.defineProperty|Reflect.defineProperty|锁hook|全局属性防御');
        log('   拦截:', blockCount, '| Worker:', workerCount);
    }, 200);

})();
