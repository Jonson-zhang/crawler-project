#!/usr/bin/env node
/**
 * 调试脚本：逐行排查 RS6 外链 JS 的执行错误
 */
const _r = require;
const vm = _r('vm');
const https = _r('https');
_r('./env_site');

function fetchBody(url) {
  return new Promise(r => {
    let d = '';
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res => {
      res.setEncoding('utf8');
      res.on('data', c => d += c);
      res.on('end', () => r(d));
    });
  });
}

async function main() {
  const html = await fetchBody('https://www.ouyeel.com/steel');

  // 按顺序提取脚本
  const scripts = [];
  const re = /<script\s*([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1], content = (m[2] || '').trim();
    const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      let u = srcMatch[1];
      if (!u.startsWith('http')) u = 'https://www.ouyeel.com' + (u.startsWith('/') ? '' : '/') + u;
      scripts.push({ type: 'external', url: u });
    } else if (content) {
      scripts.push({ type: 'inline', code: content });
    }
  }

  // meta content
  const metaRe = /<meta[^>]+content=["']([^"']+)["']/gi;
  let metaContent = '';
  while ((m = metaRe.exec(html)) !== null) metaContent = m[1];
  console.log('metaContent:', metaContent.slice(0, 30));

  // setTimeout noop
  global.setTimeout = function () {};
  global.setInterval = function () {};

  // 执行 inline #0
  try { vm.runInThisContext(scripts[0].code, { filename: 's0.js', timeout: 10000 }); } catch (e) { console.log('s0 err:', e.message); }

  // 执行 inline #1 — 检查 $_ts
  vm.runInThisContext(scripts[1].code, { filename: 's1.js', timeout: 10000 });
  const tsKeys = vm.runInThisContext('typeof $_ts;', { filename: 'ck1.js', timeout: 5000 });
  console.log('typeof $_ts:', tsKeys);
  const tsCdType = vm.runInThisContext('typeof $_ts.cd;', { filename: 'ck2.js', timeout: 5000 });
  console.log('typeof $_ts.cd:', tsCdType);

  // 读取外链 JS
  const extUrl = scripts[2].url;
  console.log('fetching:', extUrl);
  const extJs = await fetchBody(extUrl);
  console.log('ext JS:', extJs.length, 'bytes');

  // 试执行外链 JS — 捕获完整错误
  console.log('--- executing external JS ---');
  try {
    const t0 = Date.now();
    vm.runInThisContext(extJs, { filename: 'ext.js', timeout: 30000, displayErrors: true });
    console.log('OK, duration:', Date.now() - t0, 'ms');
  } catch (e) {
    console.log('ERROR:', e.message);
    console.log('STACK:', e.stack);
  }

  // inline #3
  if (scripts[3]) {
    try { vm.runInThisContext(scripts[3].code, { filename: 's3.js', timeout: 10000 }); } catch (e) { console.log('s3 err:', e.message); }
  }

  // cookie
  try { vm.runInThisContext('window.dispatchEvent(new Event("load"))', { filename: 'load.js', timeout: 5000 }); } catch (e) { }
  const cookie = vm.runInThisContext('document.cookie', { filename: 'get.js', timeout: 5000 });
  console.log('cookie:', cookie.length, 'bytes');
  console.log('cookie:', cookie.slice(0, 150));
}

main().catch(e => { console.log('FATAL:', e.message, e.stack); });
