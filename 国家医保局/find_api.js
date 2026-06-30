/**
 * Find the API service by exploring all window properties exhaustively
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

const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    // Scan ALL window properties for objects with interesting properties
    const interesting = [];
    const visited = new Set();

    function scan(obj, name, depth) {
        if (depth > 4 || !obj || typeof obj !== 'object' || visited.has(obj)) return;
        visited.add(obj);

        try {
            const keys = Object.keys(obj);
            const hasQFH = keys.includes('queryFixedHospital');
            const hasSm = keys.includes('sm2') || keys.includes('sm3') || keys.includes('sm4');
            const hasEncrypt = keys.includes('encrypt') || keys.includes('doEncrypt');
            const hasSign = keys.includes('doSignature') || keys.includes('generateKeyPairHex');
            const hasAppCode = keys.some(k => k === 'appCode' || k === 'a' || k === 'e');

            if (hasQFH || hasSm || hasEncrypt || hasSign || hasAppCode) {
                interesting.push({
                    path: name,
                    keyCount: keys.length,
                    hasQFH, hasSm, hasEncrypt, hasSign, hasAppCode,
                    keys: keys.slice(0, 20),
                });
            }

            // Only recurse into interesting objects
            for (const key of keys.slice(0, 30)) {
                if (['window','self','top','parent','document','location','console','navigator',
                     'screen','history','localStorage','sessionStorage','crypto','performance',
                     'XMLHttpRequest','fetch','WebSocket','Worker','setTimeout','setInterval',
                     'clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame',
                     'onerror','onload','onunload','onmessage','Element','Node','HTMLElement',
                     'HTMLInputElement','HTMLDivElement','Event','CustomEvent','MessageChannel',
                     'MutationObserver','ResizeObserver','IntersectionObserver',
                     'CSSStyleDeclaration','getComputedStyle','matchMedia',
                     'Blob','File','FileReader','FormData','URL','URLSearchParams',
                     'Promise','Symbol','Proxy','Reflect','JSON','Math','Date','RegExp','Error',
                     'Array','Object','String','Number','Boolean','Function','Map','Set','WeakMap',
                     'ArrayBuffer','Uint8Array','Int8Array','DataView','Float32Array',
                     'TextDecoder','TextEncoder'].includes(key)) continue;
                try {
                    scan(obj[key], `${name}.${key}`, depth + 1);
                } catch(e) {}
            }
        } catch(e) {}
    }

    process.stderr.write('Scanning window...\n');
    scan(win, 'window', 0);

    process.stderr.write(`\nFound ${interesting.length} interesting objects:\n`);
    interesting.forEach(o => {
        process.stderr.write(`  ${o.path} (${o.keyCount} keys)\n`);
        process.stderr.write(`    QFH:${o.hasQFH} Sm:${o.hasSm} Enc:${o.hasEncrypt} Sign:${o.hasSign} AppCode:${o.hasAppCode}\n`);
        process.stderr.write(`    Keys: ${o.keys.join(', ')}\n`);
    });

    // Also try to find the internal webpack module cache
    // Look for objects with very large number of numeric/string keys (these are module IDs)
    function findWebpackCache(obj, name, depth) {
        if (depth > 5 || !obj || typeof obj !== 'object') return;
        try {
            const keys = Object.keys(obj);
            if (keys.length > 100) {
                const numericKeys = keys.filter(k => /^\d+$/.test(k) || /^[0-9a-f]{4}$/.test(k));
                if (numericKeys.length > 50) {
                    process.stderr.write(`\nPossible webpack cache at ${name}: ${keys.length} keys, ${numericKeys.length} numeric\n`);
                }
            }
            for (const key of Object.keys(obj).slice(0, 20)) {
                findWebpackCache(obj[key], `${name}.${key}`, depth + 1);
            }
        } catch(e) {}
    }

    process.stderr.write('\nSearching for webpack module cache...\n');
    findWebpackCache(win, 'window', 0);

    process.exit(0);
}, 5000);
