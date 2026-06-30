/**
 * Explore Vue event bus to find API trigger
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let patched = src.substring(0, i1 + p1.length) + ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' + src.substring(i1 + p1.length);
const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
patched = patched.substring(0, i2raw + p2.length) + '(window["_m"+_0x518e77]=_0x1210ab["exports"]),' + patched.substring(i2raw + p2.length);

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
win.crypto = { getRandomValues(a) { crypto.randomFillSync(a); return a; }, subtle: {} };
win.btoa = s => Buffer.from(s, 'binary').toString('base64');
win.atob = s => Buffer.from(s, 'base64').toString('binary');
win.TextEncoder = function () { };
win.TextEncoder.prototype.encode = s => Buffer.from(s, 'utf-8');

// Capture XHR
let captured = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
    let u = '', h = {};
    x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
    x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
    x.send = function (b) {
        if (u.includes('queryFixedHospital')) captured = { url: u, headers: { ...h }, body: b };
        os.call(this, b);
    };
    return x;
};

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

setTimeout(() => {
    const bus = win.__vueEventBus;
    if (!bus) { console.error('No vueEventBus'); process.exit(0); }

    // Show data
    const dataKeys = Object.keys(bus._data || {});
    console.error('Vue bus _data keys:', dataKeys.join(', '));

    // Find router root
    const root = bus._routerRoot;
    if (root) {
        console.error('Router root found');
        // Check for Vuex store
        if (root.$store) {
            console.error('Vuex store found!');
            console.error('  state keys:', Object.keys(root.$store.state || {}).join(', '));
            // List actions
            const actions = root.$store._actions;
            if (actions) {
                const actionKeys = Object.keys(actions);
                console.error('  actions:', actionKeys.join(', '));
                // Try calling a search action
                if (actionKeys.includes('searchMedical') || actionKeys.includes('queryFixedHospital')) {
                    const searchAction = actionKeys.find(k => /search|query/i.test(k));
                    console.error('  Calling action:', searchAction);
                    try {
                        root.$store.dispatch(searchAction, { keyword: '医院', pageNum: 1, pageSize: 10 });
                    } catch (e) { console.error('  dispatch error:', e.message); }
                }
            }
        }
    }

    // List all bus methods
    const methods = Object.keys(bus).filter(k => typeof bus[k] === 'function');
    console.error('\nBus methods:', methods.join(', '));

    // Look for API service in the bus or its children
    // The bus has $children array
    const children = bus.$children || [];
    console.error('\nChildren count:', children.length);

    // Scan each child for API-related methods
    if (children.length > 0) {
        for (let i = 0; i < Math.min(children.length, 3); i++) {
            const child = children[i];
            const cmethods = Object.keys(child).filter(k => typeof child[k] === 'function' && k !== '$el' && k !== '$options');
            console.error('Child[' + i + '] methods:', cmethods.slice(0, 20).join(', '));
            // Check child's data
            const cdata = child._data;
            if (cdata) {
                console.error('  data keys:', Object.keys(cdata).join(', '));
            }
        }
    }

    // Also scan ALL window properties for anything with $store or $axios
    for (const k of Object.keys(win)) {
        try {
            const v = win[k];
            if (v && typeof v === 'object' && v.$store) {
                console.error('\nFound $store in window.' + k);
            }
            if (v && typeof v === 'object' && v.$http) {
                console.error('\nFound $http in window.' + k);
            }
        } catch (e) { }
    }

    // Check captured
    if (captured) {
        console.error('\n*** CAPTURED queryFixedHospital! ***');
        console.error('sig:', captured.headers['x-tif-signature']);
        console.error('ts:', captured.headers['x-tif-timestamp']);
        console.error('nonce:', captured.headers['x-tif-nonce']);
        console.error('body:', captured.body.substring(0, 500));
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 25000);
