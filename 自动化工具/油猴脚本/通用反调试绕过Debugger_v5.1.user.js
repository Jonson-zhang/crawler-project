// ==UserScript==
// @name         通用反调试绕过Debugger v 5.1
// @namespace    https://github.com/Cunninger/anti-debug-bypass
// @version      5.1.0
// @description  通用反调试 v5.1 — 移除eval hook（避免破坏直接eval）+ 保留其他全部动态防御层
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
    //  ⚠️ 能力边界（请读）
    //
    //  ✅ 能拦截：
    //     Function / AsyncFunction / GeneratorFunction / Reflect.construct
    //     setTimeout / setInterval (string 参数或含 debugger 的函数)
    //     requestAnimationFrame / requestIdleCallback / queueMicrotask / setImmediate
    //     Promise.then (含 debugger 的回调)
    //     script.text setter / innerHTML / document.write / writeln
    //     appendChild / insertBefore / replaceChild (动态 script 节点)
    //     Worker / SharedWorker / Blob (JS 类型)
    //     BroadcastChannel postMessage
    //
    //  ❌ 不能拦截：
    //     HTML 解析器加载的外部 <script src="xxx.js"> 中的 debugger
    //     （浏览器 C++ 层直通，JS 钩子无效）
    //
    //  ⚠️  刻意不 hook eval：
    //     JavaScript 中 eval(code) 是"直接 eval"，享有闭包作用域。
    //     任何 wrapper 都会把它变成"间接 eval"（只跑全局作用域），
    //     导致站点 VM 报 _$aY is not defined。这是 ES 规范限制，无法绕过。
    //
    //  外部 JS 中的 debugger 请用：
    //    ① Playwright CDP Debugger.resume（自动化）
    //    ② Chrome DevTools → Ctrl+F8（手动）
    //    ③ Chrome Overrides（替换远程文件）
    //    ④ mitmproxy 代理拦截（网络层清洗）
    // ============================================================

    var CONFIG = {
        verbose: false,
        blockConsoleClear: true,
        lockPrepareStackTrace: false
    };

    var safeConsole = (typeof unsafeWindow !== 'undefined' && unsafeWindow.console)
        ? unsafeWindow.console : console;

    window.__ad_config__ = CONFIG;
    var blockCount = 0;
    var workerCount = 0;

    function log() {
        if (!CONFIG.verbose) return;
        try { safeConsole.log.apply(safeConsole, ['[AD]'].concat(Array.prototype.slice.call(arguments))); } catch(e) {}
    }

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
        var out = '', i = 0, len = code.length;
        var inString = false, stringChar = '', inTemplate = false;
        var inBlockComment = false, inLineComment = false, inRegex = false;
        while (i < len) {
            if (!inString && !inTemplate && !inLineComment && !inRegex && code[i]==='/' && code[i+1]==='*') {
                inBlockComment = true; out += '/*'; i += 2;
                while (i < len && !(code[i]==='*' && code[i+1]==='/')) { out += code[i]; i++; }
                if (i < len) { out += '*/'; i += 2; } inBlockComment = false; continue;
            }
            if (!inString && !inTemplate && !inBlockComment && !inRegex && code[i]==='/' && code[i+1]==='/') {
                inLineComment = true; out += '//'; i += 2;
                while (i < len && code[i]!=='\n') { out += code[i]; i++; }
                inLineComment = false; continue;
            }
            if (!inBlockComment && !inLineComment && !inRegex && !inTemplate && (code[i]==='"'||code[i]==="'"||code[i]==='`')) {
                var q = code[i];
                if (q==='`') inTemplate=true; else { inString=true; stringChar=q; }
                out += code[i]; i++;
                while (i < len) { out += code[i];
                    if (code[i]==='\\') { i++; if (i < len) out += code[i]; }
                    else if (q==='`' && code[i]==='`') { inTemplate=false; i++; break; }
                    else if (code[i]===stringChar) { inString=false; i++; break; }
                    i++;
                } continue;
            }
            if (!inString && !inTemplate && !inBlockComment && !inLineComment && !inRegex) {
                var prevChar = i>0 ? code[i-1] : ' ';
                var isWordBoundary = /[^a-zA-Z0-9_$.]/.test(prevChar);
                if (isWordBoundary && code.substr(i,8)==='debugger') {
                    var nextChar = code[i+8]||' ';
                    if (/[\s;}\n\r]/.test(nextChar) || i+8>=len) { blockCount++; i+=8;
                        while (i<len && /[\s;]/.test(code[i]) && code[i]!=='\n') i++;
                        continue;
                    }
                }
                if (code[i]==='/' && !/[a-zA-Z0-9_$)\]]/.test(prevChar)) {
                    var back=i-1; while (back>=0 && /\s/.test(code[back])) back--;
                    var eff=back>=0?code[back]:' ';
                    if (!((eff==='+'||eff==='-')&&back>=1&&code[back-1]===eff) && !/[a-zA-Z0-9_$)\]]/.test(eff)) {
                        inRegex=true; out+=code[i]; i++;
                        while (i<len) { out+=code[i];
                            if (code[i]==='\\') { i++; if (i<len) out+=code[i]; }
                            else if (code[i]==='/') { inRegex=false; i++;
                                while (i<len&&/[gimsuy]/.test(code[i])){out+=code[i]; i++;} break;
                            } i++;
                        } continue;
                    }
                }
            }
            out+=code[i]; i++;
        }
        return out;
    }

    function filterCodeString(code) {
        if (typeof code !== 'string') return code;
        if (isExactlyDebuggerStmt(code)) return null;
        if (/\bdebugger\b/i.test(code)) return removeDebuggerStatements(code);
        return code;
    }

    function debuggerInFunc(fn) {
        try {
            if (typeof fn === 'function')
                return /\bdebugger\b/.test(Function.prototype.toString.call(fn));
        } catch(e) {}
        return false;
    }

    // ============================================================
    //  toString 伪装
    // ============================================================
    var _origFunctionToString = Function.prototype.toString;
    var hookedSet = new WeakSet();

    Function.prototype.toString = function() {
        if (hookedSet.has(this)) {
            var name = '';
            try { name = this[NAME_SYM] || this.name || ''; } catch(e) {}
            return 'function ' + name + '() { [native code] }';
        }
        if (typeof this !== 'function')
            throw new TypeError("Function.prototype.toString requires that 'this' be a Function");
        return _origFunctionToString.call(this);
    };

    function tagAsNative(fn, name) {
        try {
            hookedSet.add(fn);
            if (typeof NAME_SYM === 'symbol')
                Object.defineProperty(fn, NAME_SYM, { value: name, enumerable: false, configurable: false, writable: false });
            else fn[NAME_SYM] = name;
        } catch(e) {}
        // 复制原型避免 VM 检测 .prototype 失败
        if (typeof fn === 'function' && !fn.hasOwnProperty('prototype')) {
            try { fn.prototype = { constructor: fn }; } catch(e) {}
        }
    }
    tagAsNative(Function.prototype.toString, 'toString');

    // ============================================================
    //  Object.defineProperty 防御
    // ============================================================
    var _origDefineProperty = Object.defineProperty;
    var blockedProps = ['setInterval', 'setTimeout', 'Function'];

    Object.defineProperty = function(obj, prop, desc) {
        if (obj === window && blockedProps.indexOf(prop) !== -1) return obj;
        if (obj === Function.prototype && prop === 'constructor' && desc && desc.configurable === true) return obj;
        return _origDefineProperty.call(Object, obj, prop, desc);
    };
    tagAsNative(Object.defineProperty, 'defineProperty');

    if (typeof Reflect !== 'undefined' && Reflect.defineProperty) {
        var _origRDP = Reflect.defineProperty;
        Reflect.defineProperty = function(obj, prop, desc) {
            if (obj === window && blockedProps.indexOf(prop) !== -1) return true;
            if (obj === Function.prototype && prop === 'constructor' && desc && desc.configurable === true) return true;
            return _origRDP.call(Reflect, obj, prop, desc);
        };
        tagAsNative(Reflect.defineProperty, 'defineProperty');
    }

    // ============================================================
    //  定时器 Hook — 只拦截 string 参数（保留函数参数的原样传递）
    // ============================================================
    var _setInterval = window.setInterval;
    var _setTimeout = window.setTimeout;

    function makeTimerHook(orig, name) {
        var wrapped = function(fn, delay) {
            // string 参数 → filter
            if (typeof fn === 'string') {
                var filtered = filterCodeString(fn);
                if (filtered === null) { blockCount++; return orig(function(){}, 86400000); }
                return orig.call(window, filtered, delay);
            }
            // 函数参数 → 检查函数体但让原函数正常执行
            // 不替代函数——反调试系统通常会检测 toString
            if (typeof fn === 'function' && debuggerInFunc(fn)) {
                blockCount++;
                log(name + ' 拦截 (含 debugger 的函数)');
                return orig(function(){}, 86400000);
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
            if (debuggerInFunc(cb)) { blockCount++; return name==='queueMicrotask'?undefined:0; }
            return _orig.apply(window, arguments);
        };
        tagAsNative(window[name], name);
    });

    // Promise.then
    (function() {
        var _then = Promise.prototype.then;
        Promise.prototype.then = function(onFulfilled, onRejected) {
            if (typeof onFulfilled === 'function' && debuggerInFunc(onFulfilled)) { blockCount++; onFulfilled = undefined; }
            if (typeof onRejected === 'function' && debuggerInFunc(onRejected)) { blockCount++; onRejected = undefined; }
            return _then.call(this, onFulfilled, onRejected);
        };
        tagAsNative(Promise.prototype.then, 'then');
    })();

    // ============================================================
    //  Function / AsyncFunction / GeneratorFunction
    //  只拦截纯字符串构造（保留对象/函数参数的原样传递）
    // ============================================================
    var _origProtoCons = Function.prototype.constructor;
    var asyncFunctionConstructor, generatorFunctionConstructor;
    var asyncWrapper, genWrapper;

    function makeConstructorWrapper(origCons, name, emptyFactory) {
        var wrapped = function() {
            var args = [];
            var intercepted = false;
            for (var i = 0; i < arguments.length; i++) {
                var arg = arguments[i];
                if (typeof arg === 'string') {
                    var filtered = filterCodeString(arg);
                    if (filtered === null) { blockCount++; return emptyFactory ? emptyFactory() : function(){}; }
                    if (filtered !== arg) intercepted = true;
                    args.push(filtered);
                } else { args.push(arg); }
            }
            if (!intercepted) return origCons.apply(this, args);
            try { return origCons.apply(this, args); }
            catch(e) { return origCons.apply(origCons, args); }
        };
        tagAsNative(wrapped, name);
        return wrapped;
    }

    var constructorWrapper = makeConstructorWrapper(_origProtoCons, 'Function', function(){ return function(){}; });
    try { Function.prototype.constructor = constructorWrapper; } catch(e) {}
    window.Function = constructorWrapper;

    (function() {
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
    })();

    // Reflect.construct
    (function() {
        try {
            var _rc = Reflect.construct;
            Reflect.construct = function(target, args, newTarget) {
                var isFnCons = target===Function||target===Function.prototype.constructor
                    ||target===asyncFunctionConstructor||target===generatorFunctionConstructor
                    ||target===asyncWrapper||target===genWrapper;
                if (!isFnCons) return _rc.call(Reflect, target, args, newTarget||target);
                var filteredArgs = [], intercepted = false;
                for (var i = 0; i < args.length; i++) {
                    if (typeof args[i] === 'string') {
                        var f = filterCodeString(args[i]);
                        if (f === null) {
                            blockCount++;
                            if (target===asyncFunctionConstructor||target===asyncWrapper) return asyncFunctionConstructor('return;');
                            if (target===generatorFunctionConstructor||target===genWrapper) return generatorFunctionConstructor('yield;');
                            return function(){};
                        }
                        if (f !== args[i]) intercepted = true;
                        filteredArgs.push(f);
                    } else { filteredArgs.push(args[i]); }
                }
                return _rc.call(Reflect, target, filteredArgs, newTarget||target);
            };
            tagAsNative(Reflect.construct, 'construct');
        } catch(e) {}
    })();

    // ============================================================
    //  ★ v5.1：不 hook eval
    //  原因：任何 eval wrapper 都会把"直接 eval"变成"间接 eval"，
    //  导致 VM 丢失闭包变量（_$aY, _$gA 等），报错而非正常运行。
    //  这是 ES 规范层面无法绕过的限制。
    //
    //  eval 创建的 debugger 由 CDP Debugger.resume 处理。
    // ============================================================

    // ============================================================
    //  Worker / Blob / DOM / BroadcastChannel（保留全部）
    // ============================================================
    ['Worker','SharedWorker'].forEach(function(WType) {
        if (typeof window[WType] !== 'function') return;
        var _W = window[WType];
        window[WType] = function(scriptURL, options) {
            var url = scriptURL, urlStr = typeof url==='string'?url:(url.href||url.toString());
            try {
                var resolved = new URL(urlStr, location.href);
                if (resolved.origin === location.origin) {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', urlStr, false);
                    try { xhr.send();
                        if (xhr.status===200 && xhr.responseText) {
                            var cleaned = filterCodeString(xhr.responseText);
                            if (cleaned!==null && cleaned!==xhr.responseText) {
                                var blob=new Blob([cleaned],{type:'application/javascript'});
                                var blobUrl=URL.createObjectURL(blob);
                                blockCount++; workerCount++; url=blobUrl;
                                setTimeout(function(){URL.revokeObjectURL(blobUrl);},5000);
                            }
                        }
                    } catch(e) {}
                }
            } catch(e) {}
            return options ? new _W(url,options) : new _W(url);
        };
        window[WType].prototype = _W.prototype;
        tagAsNative(window[WType], WType);
    });

    (function() {
        var _Blob = Blob;
        window.Blob = function(parts, options) {
            var type = options&&options.type ? options.type : '';
            if (type && /(javascript|ecmascript)/i.test(type)) {
                var filtered = [];
                for (var i=0; i<parts.length; i++) {
                    if (typeof parts[i]==='string') { var f=filterCodeString(parts[i]); if (f!==null) filtered.push(f); }
                    else filtered.push(parts[i]);
                }
                if (filtered.length!==parts.length) blockCount++;
                parts = filtered;
            }
            return new _Blob(parts, options);
        };
        window.Blob.prototype = _Blob.prototype;
        tagAsNative(window.Blob, 'Blob');
    })();

    // document.write / writeln
    (function() {
        var _dw = document.write.bind(document), _dwl = document.writeln.bind(document);
        document.write = function(html) {
            if (typeof html==='string' && /\bdebugger\b/i.test(html)) { blockCount++;
                html = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                    function(m,o,b,c){ return /\bdebugger\b/i.test(b) ? o+removeDebuggerStatements(b)+c : m; });
            }
            return _dw.apply(document, arguments);
        };
        tagAsNative(document.write, 'write');
        document.writeln = function(html) {
            if (typeof html==='string' && /\bdebugger\b/i.test(html)) { blockCount++;
                html = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                    function(m,o,b,c){ return /\bdebugger\b/i.test(b) ? o+removeDebuggerStatements(b)+c : m; });
            }
            return _dwl.apply(document, arguments);
        };
        tagAsNative(document.writeln, 'writeln');
    })();

    // script.text setter
    (function() {
        var d = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'text');
        if (!d) d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
        if (d && d.set) {
            var _g = d.get, _s = d.set;
            Object.defineProperty(HTMLScriptElement.prototype, 'text', {
                get: function(){ return _g ? _g.call(this) : ''; },
                set: function(v) {
                    if (typeof v==='string' && /\bdebugger\b/i.test(v)) { blockCount++; return _s.call(this, removeDebuggerStatements(v)); }
                    return _s.call(this, v);
                },
                configurable: true, enumerable: true
            });
        }
    })();

    // innerHTML
    (function() {
        var d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        if (d && d.set) {
            var _s = d.set;
            Object.defineProperty(Element.prototype, 'innerHTML', {
                get: d.get,
                set: function(v) {
                    if (typeof v==='string' && /\bdebugger\b/i.test(v)) { blockCount++;
                        v = v.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi,
                            function(m,o,b,c){ return /\bdebugger\b/i.test(b) ? o+removeDebuggerStatements(b)+c : m; });
                    }
                    return _s.call(this, v);
                },
                configurable: true, enumerable: true
            });
        }
    })();

    // createElement — 实例级 text hook
    var _createElement = document.createElement.bind(document);
    document.createElement = function(tag, options) {
        var el = _createElement(tag, options);
        if ((tag||'').toLowerCase()==='script') {
            try {
                var pt = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'text');
                Object.defineProperty(el, 'text', {
                    get: function(){ return pt&&pt.get?pt.get.call(this):this.textContent; },
                    set: function(v) {
                        if (typeof v==='string' && /\bdebugger\b/i.test(v)) { blockCount++; v = removeDebuggerStatements(v); }
                        if (pt&&pt.set) return pt.set.call(this, v);
                        this.textContent = v;
                    },
                    configurable: true, enumerable: true
                });
            } catch(e) {}
        }
        return el;
    };

    // appendChild / insertBefore / replaceChild
    ['appendChild','insertBefore','replaceChild'].forEach(function(m) {
        var _orig = Node.prototype[m];
        Node.prototype[m] = function(node, ref) {
            if (node && node.nodeType===1 && node.tagName==='SCRIPT') {
                var content = node.text||node.textContent||'';
                if (content && /\bdebugger\b/i.test(content)) { node.text=removeDebuggerStatements(content); blockCount++; }
                if (node.querySelectorAll) {
                    try {
                        var nested = node.querySelectorAll('script');
                        for (var s=0; s<nested.length; s++) {
                            var nc = nested[s].text||nested[s].textContent||'';
                            if (/\bdebugger\b/i.test(nc)) { nested[s].text=removeDebuggerStatements(nc); blockCount++; }
                        }
                    } catch(e) {}
                }
            }
            return _orig.call(this, node, ref);
        };
    });

    // BroadcastChannel
    (function() {
        if (typeof BroadcastChannel !== 'function') return;
        var _BC = BroadcastChannel;
        window.BroadcastChannel = function(name) {
            var ch = new _BC(name);
            var _pm = ch.postMessage;
            ch.postMessage = function(msg) {
                if (typeof msg==='string' && /\bdebugger\b/i.test(msg)) { blockCount++; return; }
                return _pm.apply(ch, arguments);
            };
            return ch;
        };
        window.BroadcastChannel.prototype = _BC.prototype;
        tagAsNative(window.BroadcastChannel, 'BroadcastChannel');
    })();

    // Console / DevTools
    if (CONFIG.blockConsoleClear) {
        var ccw = function(){};
        console.clear = ccw; tagAsNative(ccw, 'clear');
    }
    ['outerWidth','outerHeight'].forEach(function(p) {
        try { Object.defineProperty(window, p, { get: function(){ return p==='outerWidth'?window.innerWidth:window.innerHeight; }, configurable: false }); } catch(e) {}
    });
    if (CONFIG.lockPrepareStackTrace) {
        try { var _pst=Error.prepareStackTrace; Object.defineProperty(Error, 'prepareStackTrace', { get:function(){return _pst;}, set:function(){}, configurable:false }); } catch(e) {}
    }

    // 全局属性防御
    (function() {
        var pg = blockedProps.concat(['$_ts','jskj','_$','__jsl','_0x','cd','lcd']);
        try { if (window.__defineGetter__) { var dg=window.__defineGetter__; window.__defineGetter__=function(p,f){ if(pg.indexOf(p)!==-1)return; return dg.call(window,p,f); }; } } catch(e) {}
        try { if (window.__defineSetter__) { var ds=window.__defineSetter__; window.__defineSetter__=function(p,f){ if(pg.indexOf(p)!==-1)return; return ds.call(window,p,f); }; } } catch(e) {}
    })();

    // ============================================================
    //  Tampermonkey 菜单
    // ============================================================
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('[反调试 v5.1] 切换日志', function() {
            CONFIG.verbose = !CONFIG.verbose;
            safeConsole.log('[AD v5.1] verbose =', CONFIG.verbose);
        });
        GM_registerMenuCommand('[反调试 v5.1] 查看统计', function() {
            safeConsole.log('%c[AD v5.1] 已拦截 %c'+blockCount+'%c 次 | Worker %c'+workerCount+'%c 次',
                '', 'color:red;font-size:18px;font-weight:bold', '',
                'color:orange;font-size:18px;font-weight:bold', '');
        });
        GM_registerMenuCommand('[反调试 v5.1] 诊断', function() {
            safeConsole.group('[AD v5.1] 防御层');
            var checks = [
                ['setInterval', window.setInterval],
                ['setTimeout', window.setTimeout],
                ['Function', window.Function],
                ['AsyncFunction', (function(){try{return Object.getPrototypeOf(async function(){}).constructor}catch(e){}}())],
                ['GeneratorFunction', (function(){try{return Object.getPrototypeOf(function*(){}).constructor}catch(e){}}())],
                ['Reflect.construct', Reflect.construct],
                ['rAF', window.requestAnimationFrame],
                ['rIC', window.requestIdleCallback],
                ['qMicrotask', window.queueMicrotask],
                ['Promise.then', Promise.prototype.then],
                ['Worker', window.Worker],
                ['Blob', window.Blob],
                ['doc.write', document.write],
                ['innerHTML', Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML')],
                ['script.text', Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'text')],
                ['appendChild', Node.prototype.appendChild],
                ['createElement', document.createElement],
                ['Obj.defineProperty', Object.defineProperty],
                ['BroadcastChannel', window.BroadcastChannel],
            ];
            checks.forEach(function(pair) {
                try {
                    var v = pair[1], status;
                    if (!v) status = 'N/A';
                    else if (v && v.toString().includes('native')) status = '✅ 伪装';
                    else status = '✅ hook';
                    safeConsole.log(pair[0]+':', status);
                } catch(e) { safeConsole.log(pair[0]+': ❌'); }
            });
            safeConsole.log('拦截次数:', blockCount, '| Worker:', workerCount);
            safeConsole.log('');
            safeConsole.log('⚠️  eval 未 hook（避免破坏直接 eval 的闭包作用域）');
            safeConsole.log('⚠️  外部 <script src="..."> 无法拦截（浏览器 C++ 层直通）');
            safeConsole.log('   若仍触发 debugger → 用 CDP/Overrides/代理 方案');
            safeConsole.groupEnd();
        });
    }

    setTimeout(function() {
        log('✅ v5.1 已激活 | eval 未 hook | 动态路径全覆盖');
        log('   拦截:', blockCount, '| Worker:', workerCount);
    }, 200);
})();
