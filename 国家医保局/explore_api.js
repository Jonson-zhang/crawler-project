/**
 * Explore: Find the API service in jsdom global scope
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
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
win.TextEncoder = function() {};
win.TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); };

// XHR intercept
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let _url = '', headers = {};
    xhr.open = function (m, u) { _url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function (k, v) { headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function (body) {
        if (_url.includes('queryFixedHospital') || _url.includes('selectByKeys')) {
            process.stderr.write(`\n[XHR] ${_url}\n`);
            process.stderr.write(`[XHR] Headers:\n`);
            for (const [k, v] of Object.entries(headers)) {
                process.stderr.write(`  ${k}: ${v}\n`);
            }
            process.stderr.write(`[XHR] Body: ${body ? body.substring(0, 500) : 'none'}\n`);
        }
        os.call(this, body);
    };
    return xhr;
};

const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    // Explore global scope
    const allKeys = Object.keys(win).filter(k => !k.startsWith('_'));
    process.stderr.write(`\n=== Window keys (non-underscore, first 50): ${allKeys.slice(0, 50).join(', ')}\n`);

    // Find webpack-related paths
    const webpackKeys = Object.keys(win).filter(k => {
        try { return typeof win[k] === 'object' && win[k] && (win[k].push || win[k].m || win[k].c); }
        catch(e) { return false; }
    });
    process.stderr.write(`\n=== Possible webpack globals: ${webpackKeys.join(', ')}\n`);

    // Explore the module cache if we can find it
    // Common webpack global names
    for (const key of ['webpackJsonp', '__webpack_require__', 'webpackChunk']) {
        if (win[key]) {
            process.stderr.write(`\nFound ${key}!\n`);
        }
    }

    // Look for the API service by searching in all global objects
    // The encryption key material _0x3d8a47 should be somewhere
    const allGlobalStr = JSON.stringify(win, (key, val) => {
        if (typeof val === 'function') return '[Function]';
        if (typeof val === 'object' && val && val.constructor && val.constructor.name === 'Window') return '[Window]';
        return val;
    }).substring(0, 3000);

    if (allGlobalStr.includes('T98HPCGN')) {
        process.stderr.write('\nFound appCode in global scope!\n');
    }

    // Try calling a search via __vueEventBus
    if (win.__vueEventBus) {
        process.stderr.write('\n=== __vueEventBus found! ===\n');
        process.stderr.write(`Keys: ${Object.keys(win.__vueEventBus).join(', ')}\n`);

        // Try emitting a search event
        try {
            win.__vueEventBus.$emit('searchMedical', { keyword: '医院', pageNum: 1, pageSize: 10 });
            process.stderr.write('Emitted searchMedical event\n');
        } catch(e) {
            process.stderr.write(`Emit error: ${e.message}\n`);
        }
    }

    // Try to find and call the API module directly
    // Look for something that has "queryFixedHospital" as a method
    function findApi(obj, depth) {
        if (depth > 3) return;
        if (!obj || typeof obj !== 'object') return;
        try {
            const keys = Object.keys(obj);
            for (const k of keys) {
                if (k === 'queryFixedHospital' || k === 'k') {
                    process.stderr.write(`\nFOUND: obj[${depth}].${k} = ${typeof obj[k]}\n`);
                    if (typeof obj[k] === 'object') {
                        process.stderr.write(`  Sub-keys: ${Object.keys(obj[k]).slice(0, 10).join(', ')}\n`);
                    }
                }
                if (typeof obj[k] === 'object' && obj[k] && k !== 'window' && k !== 'self' && k !== 'top') {
                    try { findApi(obj[k], depth + 1); } catch(e) {}
                }
            }
        } catch(e) {}
    }

    process.stderr.write('\nSearching for API...\n');
    findApi(win, 0);

    process.exit(0);
}, 5000);
