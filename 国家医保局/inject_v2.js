/**
 * Inject custom module v2 - with virtualConsole for debug output
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

// Capture jsdom console output
const virtConsole = new VirtualConsole();
virtConsole.on('log', (msg) => console.error('[jsdom] ' + msg));
virtConsole.on('error', (msg) => console.error('[jsdom-err]', msg));
virtConsole.on('jsdomError', (msg) => console.error('[jsdom-js]', msg));

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical?gbFlag=true',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
    virtualConsole: virtConsole,
});
const win = dom.window;

win.crypto = {
    getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    },
    subtle: {},
};
win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');

// Patch: before app.js loads, install hooks directly
// Hook the creation of the webpack JSONP array
const origSetter = Object.prototype.__lookupSetter__ ?
    null : null; // can't use __lookupSetter__

// Instead, use a getter/setter trap on window via Proxy
// Can't proxy window in jsdom, let's just use defineProperty

console.error('[inject] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {
    console.error(`[inject] Error: ${e.message}`);
}

// After a delay, try to push our module and scan
setTimeout(() => {
    const wpArr = win.webpackJsonp;
    console.error(`[inject] webpackJsonp: ${wpArr ? 'found' : 'NOT FOUND'}`);
    if (!wpArr) {
        process.exit(1);
    }

    // Try different chunk formats
    console.error('[inject] Trying chunk format v1: [[ids], {mods}]');
    try {
        wpArr.push([["_inj1"], {
            "_inj_mod": function(m, e, r) {
                window.__inj_log1 = 'executed';
                window.__wp_r = r;
                if (r && r.m) window.__inj_mcount = Object.keys(r.m).length;
                if (r && r.c) window.__inj_ccount = Object.keys(r.c).length;
                m.exports = { ok: true };
            }
        }]);
        console.error('[inject] v1 push completed');
    } catch(e) {
        console.error(`[inject] v1 error: ${e.message}`);
    }

    // Try v2: with dep array
    console.error('[inject] Trying chunk format v2: [[ids], {mods}, [deps]]');
    try {
        wpArr.push([["_inj2"], {
            "_inj_mod2": function(m, e, r) {
                window.__inj_log2 = 'executed';
                window.__wp_r = r;
                m.exports = { ok: true };
            }
        }, []]);
        console.error('[inject] v2 push completed');
    } catch(e) {
        console.error(`[inject] v2 error: ${e.message}`);
    }

    // Check results
    setTimeout(() => {
        console.error('\n=== RESULTS ===');
        console.error(`v1 executed: ${win.__inj_log1}`);
        console.error(`v2 executed: ${win.__inj_log2}`);
        console.error(`Module count: ${win.__inj_mcount}`);
        console.error(`Cache count: ${win.__inj_ccount}`);

        if (win.__wp_r) {
            console.error('Got webpack require!');

            // Scan module cache
            if (win.__wp_r.c) {
                const cache = win.__wp_r.c;
                const ids = Object.keys(cache);
                console.error(`Cache entries: ${ids.length}`);

                // Find sm-crypto
                for (const id of ids) {
                    try {
                        const exp = cache[id].exports;
                        if (exp && exp.sm2 && exp.sm4) {
                            win.__sm = exp;
                            console.error(`*** SM-CRYPTO at module ${id}! ***`);
                            console.error(`  sm2 funcs: ${Object.keys(exp.sm2).filter(k=>typeof exp.sm2[k]==='function').join(',')}`);
                            console.error(`  sm4 funcs: ${Object.keys(exp.sm4).filter(k=>typeof exp.sm4[k]==='function').join(',')}`);

                            // Test
                            try {
                                const kp = exp.sm2.generateKeyPairHex();
                                console.error(`  SM2 test: ${JSON.stringify(kp).substring(0,80)}`);
                                const enc = exp.sm4.encrypt('test123456', '00000000000000000000000000000000', {
                                    mode: 'cbc', iv: '00000000000000000000000000000000'
                                });
                                console.error(`  SM4 test: ${enc}`);
                            } catch(e) {
                                console.error(`  Test error: ${e.message}`);
                            }
                            break;
                        }
                    } catch(e) {}
                }
            }

            // Scan modules registry
            if (win.__wp_r.m) {
                const mods = win.__wp_r.m;
                const ids = Object.keys(mods);
                console.error(`\nModule registry: ${ids.length} entries`);
                // Find crypto modules
                for (const id of ids) {
                    const src = mods[id].toString();
                    if (src.indexOf('sm2') >= 0 || src.indexOf('sm4') >= 0 ||
                        src.indexOf('doEncrypt') >= 0 || src.indexOf('doSignature') >= 0 ||
                        src.indexOf('x-tif-signature') >= 0) {
                        console.error(`\n  [${id}] ${src.substring(0,250)}`);
                    }
                }
            }
        }

        process.exit(0);
    }, 2000);
}, 8000);

// Safety timeout
setTimeout(() => {
    console.error('FATAL: timeout');
    process.exit(1);
}, 30000);
