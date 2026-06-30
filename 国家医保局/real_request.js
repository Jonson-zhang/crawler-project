/**
 * jsdom 加载 app.js → XHR.send 发真实 HTTP → 捕获加密请求 + 响应
 * ================================================================
 *
 * 让 jsdom 中的 app.js 正常初始化并发送真实 API 请求。
 * 我们替换 XHR.send 为真实 HTTPS 请求，这样签名一定正确。
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
const nodeCrypto = require('crypto');

// 完整 crypto polyfill
win.crypto = {
    getRandomValues(arr) { for (let i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*256);return arr; },
    subtle: {},
};
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');

// ── 替换 XHR.send 为真实 HTTP ──
const captured = [];
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    let _url = '', _method = 'GET', _headers = {}, _body = null;

    const oo = xhr.open, osr = xhr.setRequestHeader;
    xhr.open = function(m, u) { _method = m; _url = u; return oo.call(this, m, u); };
    xhr.setRequestHeader = function(k, v) { _headers[k] = v; return osr.call(this, k, v); };

    xhr.send = function(body) {
        _body = body;

        // 构建真实 HTTPS 请求
        const urlObj = new URL(_url, 'https://fuwu.nhsa.gov.cn');
        const options = {
            hostname: urlObj.hostname, port: 443,
            path: urlObj.pathname + urlObj.search,
            method: _method,
            headers: { ..._headers },
        };
        if (_body) {
            options.headers['Content-Length'] = Buffer.byteLength(_body);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                // 保存捕获结果
                captured.push({
                    url: _url,
                    reqHeaders: { ..._headers },
                    reqBody: typeof _body === 'string' ? _body : String(_body),
                    status: res.statusCode,
                    respHeaders: res.headers,
                    respBody: data,
                });

                // 模拟 XHR 响应
                xhr.status = res.statusCode;
                xhr.responseText = data;
                xhr.readyState = 4;
                if (xhr.onreadystatechange) xhr.onreadystatechange();
            });
        });
        req.on('error', (e) => {
            process.stderr.write(`[http] Error: ${e.message}\n`);
        });
        if (_body) req.write(_body);
        req.end();
    };
    return xhr;
};

// ── 加载 app.js ──
process.stderr.write('[real] Loading app.js...\n');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {
    process.stderr.write(`[real] err: ${e.message}\n`);
}

// ── 等待并输出 ──
setTimeout(() => {
    const output = captured.map(c => ({
        url: c.url,
        reqHeaders: {
            'x-tif-signature': c.reqHeaders['x-tif-signature'],
            'x-tif-timestamp': c.reqHeaders['x-tif-timestamp'],
            'x-tif-nonce': c.reqHeaders['x-tif-nonce'],
        },
        reqBody: c.reqBody ? c.reqBody.substring(0, 300) : null,
        status: c.status,
        respPreview: c.respBody ? c.respBody.substring(0, 200) : null,
    }));
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
}, 15000);
