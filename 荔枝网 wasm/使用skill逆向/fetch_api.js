#!/usr/bin/env node
'use strict';
const { jsdomFromUrl } = require('sdenv');
const https = require('https');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const API = 'https://gdtv-api.gdtv.cn';

function readStdin() {
  return new Promise(r => {
    if (process.stdin.isTTY) { r({path:'/api/channel/v1/news',query:'beginScore=0&pageSize=11&channelId=117'}); return; }
    let d = ''; process.stdin.setEncoding('utf-8');
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => { try { r(JSON.parse(d)); } catch(e) { r(null); } });
    setTimeout(() => r(null), 2000);
  });
}

async function main() {
  const input = await readStdin();
  const path = input?.path || '/api/channel/v1/news';
  const query = input?.query || 'beginScore=0&pageSize=11&channelId=117';
  const fullUrl = API + path + (query ? '?' + query : '');

  // Load page with sdenv
  const dom = await jsdomFromUrl('https://www.gdtv.cn/', {
    userAgent: UA,
    consoleConfig: { error: () => {} },
  });
  const { window, cookieJar } = dom;

  // Wait for Vue app + WASM (10s for safety)
  await new Promise(r => setTimeout(r, 10000));

  // Get cookies for API domain
  const pageCookies = cookieJar.getCookieStringSync('https://www.gdtv.cn');
  const apiCookies = cookieJar.getCookieStringSync(API);
  const allCookies = [pageCookies, apiCookies].filter(Boolean).join('; ');

  // Intercept XHR headers from app's real API calls
  const vm = require('vm');
  const ctx = dom.getInternalVMContext();

  vm.runInContext(`
    if (!window.__hdrs) {
      window.__hdrs = {};
      const st = XMLHttpRequest.prototype.setRequestHeader;
      XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
        if (k && k.toLowerCase().startsWith('x-itouchtv')) {
          window.__hdrs[k] = v;
        }
        return st.call(this, k, v);
      };
    }
  `, ctx);

  // Wait for app API calls
  await new Promise(r => setTimeout(r, 3000));
  const headers = vm.runInContext('window.__hdrs', ctx);

  // Make request from Node.js with cookies + captured sign headers
  const urlObj = new URL(fullUrl);
  const reqHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.gdtv.cn',
    'Referer': 'https://www.gdtv.cn/',
  };
  if (allCookies) reqHeaders['Cookie'] = allCookies;
  if (headers) Object.assign(reqHeaders, headers);

  const data = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: urlObj.hostname, port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET', headers: reqHeaders, rejectUnauthorized: false,
    }, res => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); }
        catch(e) { resolve(b); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });

  try { window.close(); } catch(e) {}

  const ok = !!(data && (!data.errorCode || data.errorCode !== 401));
  process.stdout.write(JSON.stringify({
    success: ok,
    data: data || null,
    url: fullUrl,
  }));

  setTimeout(() => process.exit(0), 500);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ success: false, error: err.message }));
  setTimeout(() => process.exit(1), 500);
});
