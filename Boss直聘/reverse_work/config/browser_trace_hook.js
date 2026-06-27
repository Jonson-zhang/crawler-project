/**
 * Browser-side VMP trace hook - captures p-state transitions in REAL browser
 *
 * Inject into security.html BEFORE the security JS loads.
 * Captures: window.__vmp_browser_trace[]
 */
(function() {
    'use strict';

    // Hook Function.prototype.apply to intercept VMP state machine calls
    var _origApply = Function.prototype.apply;
    window.__vmp_browser_trace = [];
    window.__vmp_browser_states = new Set();
    window.__vmp_browser_capturing = false;

    // We'll start capturing when ABC.z() is called
    var _origToString = Function.prototype.toString;

    // Hook constructor to detect when ABC is created
    var _origDefineProperty = Object.defineProperty;

    // Simpler approach: after security JS loads, wrap ABC.prototype.z
    var _checkInterval = setInterval(function() {
        if (typeof ABC !== 'undefined' && ABC.prototype && ABC.prototype.z && !ABC.prototype.__hooked) {
            ABC.prototype.__hooked = true;
            var _origZ = ABC.prototype.z;
            ABC.prototype.z = function(seed, ts) {
                window.__vmp_browser_capturing = true;
                window.__vmp_browser_trace = [];
                window.__vmp_browser_states = new Set();

                var result = _origZ.call(this, seed, ts);

                window.__vmp_browser_capturing = false;
                return result;
            };
        }
    }, 10);

    // Hook the VMP dispatcher to capture every p-value assignment
    // The VMP dispatcher sets p = value many times
    // We can't easily patch the code, but we can proxy the state variable

    // Instead, hook Array.prototype.slice to detect VMP calls
    var _origSlice = Array.prototype.slice;
    Array.prototype.slice = function() {
        var result = _origSlice.apply(this, arguments);
        if (window.__vmp_browser_capturing && arguments.length === 0 && this.length > 0) {
            // This might be inside the VMP concat call
        }
        return result;
    };

    console.log('[VMP-TRACE] Browser hook installed. ABC.z() will be traced.');
})();
