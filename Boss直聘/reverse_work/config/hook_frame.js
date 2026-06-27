// Boss直聘 iframe hook - 拦截 ABC.z() 调用捕获参数和输出
(function(){
    var origCE = document.createElement.bind(document);
    document.createElement = function(tag) {
        var el = origCE(tag);
        if (tag === 'iframe') {
            Object.defineProperty(el, 'contentWindow', {
                get: function() {
                    var cw;
                    try { cw = this.contentWindow; } catch(e) { return null; }
                    if (cw && !cw._zp_hooked) {
                        cw._zp_hooked = true;
                        var check = function() {
                            if (cw.ABC && cw.ABC.prototype && cw.ABC.prototype.z) {
                                var oz = cw.ABC.prototype.z;
                                cw.ABC.prototype.z = function(s, t) {
                                    window._zp_abc_seed = s;
                                    window._zp_abc_ts = t;
                                    window._zp_abc_ts_type = typeof t;
                                    var r = oz.apply(this, arguments);
                                    window._zp_abc_result = r;
                                    return r;
                                };
                                return true;
                            }
                            return false;
                        };
                        if (!check()) {
                            var iv = setInterval(function() {
                                if (check()) clearInterval(iv);
                            }, 50);
                            setTimeout(function() { try { clearInterval(iv); } catch(e) {} }, 30000);
                        }
                    }
                    return cw;
                },
                configurable: true,
                enumerable: true
            });
        }
        return el;
    };
    window._zp_abc_seed = null;
    window._zp_abc_result = null;
})();
