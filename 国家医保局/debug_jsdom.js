/**
 * Debug: Check what jsdom renders after loading app.js
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

const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let url = '', headers = {};
    xhr.open = function (m, u) { url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function (k, v) { headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function (body) {
        if (url.includes('selectByKeys') || url.includes('queryFixedHospital')) {
            process.stderr.write(`[XHR] ${url}\n`);
            process.stderr.write(`[XHR] headers: ${JSON.stringify(headers)}\n`);
            process.stderr.write(`[XHR] body: ${body ? body.substring(0, 300) : 'none'}\n\n`);
        }
        os.call(this, body);
    };
    return xhr;
};

const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    console.error(`\n=== DOM STATE ===`);
    const html = win.document.documentElement.outerHTML;
    console.error(`HTML length: ${html.length}`);
    console.error(`HTML preview:\n${html.substring(0, 3000)}`);

    // Check what's in #app
    const app = win.document.getElementById('app');
    if (app) {
        console.error(`\n#app innerHTML (first 2000):\n${app.innerHTML.substring(0, 2000)}`);
        console.error(`\n#app children: ${app.children.length}`);
        for (let i = 0; i < Math.min(app.children.length, 5); i++) {
            console.error(`  [${i}] ${app.children[i].tagName} class="${app.children[i].className}"`);
        }
    }

    // List all inputs
    const inputs = win.document.querySelectorAll('input');
    console.error(`\nInputs: ${inputs.length}`);
    inputs.forEach((inp, i) => {
        console.error(`  [${i}] placeholder="${inp.placeholder}" type="${inp.type}"`);
    });

    // List all buttons
    const btns = win.document.querySelectorAll('button');
    console.error(`\nButtons: ${btns.length}`);
    btns.forEach((b, i) => {
        console.error(`  [${i}] text="${b.textContent.trim()}"`);
    });

    process.exit(0);
}, 5000);
