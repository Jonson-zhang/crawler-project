/**
 * iv8_polyfills.js — 补全 iv8 Community Edition 缺失的浏览器 API
 *
 * 专为 Tongdun / TrustDecision SDK 设计。
 * iv8 v0.1.3 缺失: URL.createObjectURL, Worker (blob URL support)
 */

(function() {
    'use strict';

    // ══════════════════════════════════════════════════════════
    // 1. Blob 构造器拦截 — 保存原始 text parts 供后续同步读取
    // ══════════════════════════════════════════════════════════
    var _NativeBlob = Blob;
    window.Blob = function(parts, options) {
        var blob = new _NativeBlob(parts, options);
        try {
            Object.defineProperty(blob, '_textParts', {
                value: parts || [],
                writable: false,
                configurable: true,
                enumerable: false
            });
        } catch(e) {}
        return blob;
    };
    window.Blob.prototype = _NativeBlob.prototype;

    // ══════════════════════════════════════════════════════════
    // 2. URL.createObjectURL / revokeObjectURL
    // ══════════════════════════════════════════════════════════
    window._blobStore = {};
    window._blobCounter = 0;

    // Read blob content synchronously from intercepted _textParts
    window._readBlobSync = function(blob) {
        var parts = blob._textParts;
        if (!parts) return '';
        var code = '';
        for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (typeof p === 'string') {
                code += p;
            } else if (p instanceof Uint8Array || p instanceof ArrayBuffer) {
                var bytes = new Uint8Array(p);
                for (var j = 0; j < bytes.length; j++) {
                    code += String.fromCharCode(bytes[j]);
                }
            } else if (p && typeof p.toString === 'function') {
                code += p.toString();
            }
        }
        return code;
    };

    URL.createObjectURL = function(blob) {
        window._blobCounter++;
        var id = 'blob:nk-' + window._blobCounter;
        var code = window._readBlobSync(blob);
        window._blobStore[id] = { code: code, blob: blob };
        return id;
    };

    URL.revokeObjectURL = function(url) {
        delete window._blobStore[url];
    };

    // ══════════════════════════════════════════════════════════
    // 3. Worker shim for blob URLs
    //
    // Tongdun SDK pattern:
    //   new Blob([workerCode], {type:'application/javascript'})
    //   URL.createObjectURL(blob)
    //   new Worker(blobUrl)
    //   worker.postMessage({type:'start', ...})
    //   worker.onmessage = fn
    //
    // We execute the worker code synchronously and wire up
    // postMessage → onmessage through the event loop.
    // ══════════════════════════════════════════════════════════

    var _NativeWorker = Worker;
    var _workerRegistry = {};  // blobUrl → worker wrapper

    window.Worker = function(url) {
        // Normal URLs/scripts → native Worker
        if (typeof url !== 'string' || url.indexOf('blob:nk-') !== 0) {
            return new _NativeWorker(url);
        }

        var store = window._blobStore[url];
        if (!store || !store.code) {
            return new _NativeWorker(url);
        }

        // Build the wrapper object
        var workerId = 'w' + (++window._blobCounter);
        var w = {
            _id: workerId,
            _code: store.code,
            onmessage: null,
            onerror: null,

            postMessage: function(msg) {
                // Main → Worker: schedule call to worker's onmessage
                var self = this;
                setTimeout(function() {
                    var ctx = _workerRegistry[self._id];
                    if (ctx && ctx.workerOnMessage) {
                        try {
                            ctx.workerOnMessage({ data: msg });
                        } catch(e) {
                            if (self.onerror) {
                                self.onerror({
                                    message: String(e.message || e),
                                    filename: 'blob:' + self._id,
                                    lineno: 0
                                });
                            }
                        }
                    }
                }, 0);
            },

            terminate: function() {
                delete _workerRegistry[this._id];
                delete window._blobStore[url];
            }
        };

        // Register BEFORE executing code (so postMessage closures can find us)
        _workerRegistry[workerId] = {
            w: w,
            workerOnMessage: null,
            workerPostMessage: null
        };

        // Execute worker code in isolated scope
        try {
            // Create a WorkerGlobalScope-like object
            var scope = {};

            // The postMessage from worker's perspective:
            // Worker → Main: calls w.onmessage
            var workerPostMessage = function(msg) {
                var self = _workerRegistry[workerId];
                if (self && self.w && self.w.onmessage) {
                    setTimeout(function() {
                        self.w.onmessage({ data: msg });
                    }, 0);
                }
            };

            // Define the worker execution context
            var workerCode = store.code;

            // Use Function constructor for proper scoping
            // The worker code expects: onmessage = function(e) { postMessage(...) }
            var fn = new Function(
                'postMessage',
                'importScripts',
                'close',
                'setTimeout',
                'setInterval',
                'clearTimeout',
                'clearInterval',
                workerCode + '\n' +
                '// Export the onmessage handler\n' +
                'if (typeof onmessage === "function") {\n' +
                '    this._onmessage = onmessage;\n' +
                '}\n'
            );

            fn.call(
                scope,
                workerPostMessage,        // postMessage
                function() {},            // importScripts
                function() {              // close
                    delete _workerRegistry[workerId];
                },
                setTimeout.bind(window),  // setTimeout
                setInterval.bind(window), // setInterval
                clearTimeout.bind(window),
                clearInterval.bind(window)
            );

            // Wire up: extract onmessage set by the worker code
            if (typeof scope.onmessage === 'function') {
                _workerRegistry[workerId].workerOnMessage = scope.onmessage;
            } else if (typeof scope._onmessage === 'function') {
                _workerRegistry[workerId].workerOnMessage = scope._onmessage;
            }

            // Also check if workerPostMessage was captured directly
            _workerRegistry[workerId].workerPostMessage = workerPostMessage;

        } catch(e) {
            // Worker compilation/execution error
            setTimeout(function() {
                if (w.onerror) {
                    w.onerror({
                        message: 'Worker init error: ' + (e.message || String(e)),
                        filename: 'blob:' + workerId,
                        lineno: 0
                    });
                }
            }, 0);
        }

        return w;
    };

    // Copy static methods
    if (_NativeWorker.prototype) {
        // Worker.prototype.terminate etc
    }

})();
