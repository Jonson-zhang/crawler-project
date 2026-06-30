/**
 * Brute force SM4 key with correct API (encrypt(data_array, key_hex_string))
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let source = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');
const pattern = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const idx = source.indexOf(pattern);
const patched = source.substring(0, idx + pattern.length) + ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' + source.substring(idx + pattern.length);

const dom = new JSDOM('<html><body></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
win.crypto = { getRandomValues(a) { for(let i=0;i<a.length;i++)a[i]=i%256; return a; }, subtle:{} };
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');
win.TextEncoder = function(){};
win.TextEncoder.prototype.encode = function(s){ return Buffer.from(s,'utf-8'); };

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    const encrypt = win.__c.sm4.encrypt;
    const decrypt = win.__c.sm4.decrypt;
    const sm3 = win.__c.sm3.default;

    const toHex = a => Array.from(a).map(b => ('0'+(b&0xFF).toString(16)).slice(-2)).join('');
    const toArr = h => { const a=[]; for(let i=0;i<h.length;i+=2)a.push(parseInt(h.substring(i,i+2),16)); return a; };

    const TARGET = '4A8E4673BB18D86FE780DACC31C49FE3';
    const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

    // Key candidates (all as 32-char hex strings)
    const keys = [];
    const d = Buffer.from('AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC','base64');
    for(let i=0;i<=17;i++) keys.push({n:'d['+i+']',k:d.slice(i,i+16).toString('hex')});

    const acSm3 = sm3(AC);
    keys.push({n:'sm3(ac)[:16]',k:acSm3.substring(0,32)});
    keys.push({n:'sm3(ac)[16:32]',k:acSm3.substring(32,64)});

    const acHex = Buffer.from(AC,'ascii').toString('hex');
    keys.push({n:'acHex[:16]',k:acHex.substring(0,32)});
    keys.push({n:'acHex[16:32]',k:acHex.substring(32,64)});
    keys.push({n:'acAscii[:16]',k:Buffer.from(AC).slice(0,16).toString('hex')});

    const sha = require('crypto').createHash('sha256').update(AC).digest('hex');
    keys.push({n:'sha256(ac)[:16]',k:sha.substring(0,32)});
    keys.push({n:'zeros',k:'00000000000000000000000000000000'});

    // Plaintexts: pad to exactly 16 bytes
    function padPKCS7(str) {
        const b = Buffer.from(str,'utf-8');
        const p = Buffer.alloc(16); b.copy(p);
        for(let i=b.length;i<16;i++) p[i] = 16 - b.length;
        return Array.from(p);
    }
    function padZero(str) {
        const b = Buffer.from(str,'utf-8');
        const p = Buffer.alloc(16); b.copy(p);
        return Array.from(p);
    }

    const plains = ['{}','[]','""','1','0','null','true','false','all',AC.substring(0,15)];

    console.error('Testing ' + keys.length + ' keys...');
    let found = false;

    for (const kt of keys) {
        for (const pt of plains) {
            for (const arr of [padPKCS7(pt), padZero(pt)]) {
                try {
                    const enc = encrypt(arr, kt.k);
                    if (toHex(enc||[]).toUpperCase() === TARGET) {
                        console.error('*** MATCH! key=' + kt.n + ' pt=' + pt + ' key=' + kt.k);
                        found = true;
                    }
                } catch(e) {}
            }
            if (found) break;
        }
        if (found) break;
    }

    if (!found) {
        // Try decrypt - brute force
        console.error('\nDecrypt approach:');
        const ta = toArr(TARGET);
        for (const kt of keys) {
            try {
                const dec = decrypt(ta, kt.k);
                if (dec && dec.length === 16) {
                    const s = String.fromCharCode.apply(null, dec);
                    // Check for printable ASCII
                    if (/^[\x20-\x7e]+$/.test(s) || s.startsWith('{') || s.startsWith('[')) {
                        console.error(kt.n + ': "' + s + '"');
                    }
                }
            } catch(e) {}
        }
    }

    process.exit(0);
}, 8000);

setTimeout(() => { process.exit(1); }, 30000);
