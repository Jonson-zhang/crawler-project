#!/usr/bin/env node
/**
 * 监控 RS6 执行过程中所有 document.cookie 写入操作
 */
const _r = require;
const https = _r('https');
_r('./env_site');
global.setTimeout = function(){};
global.setInterval = function(){};

var vm = require('vm');
var cookiesSet = [];
var _cookieDesc = Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie')
  || Object.getOwnPropertyDescriptor(document, 'cookie');

Object.defineProperty(document, 'cookie', {
  get: function() {
    return _cookieDesc ? _cookieDesc.get.call(document) : '';
  },
  set: function(v) {
    var trimmed = (v || '').trim();
    if (trimmed) {
      cookiesSet.push(trimmed);
      console.error('[COOKIE SET]', trimmed.slice(0, 100));
    }
    if (_cookieDesc) _cookieDesc.set.call(document, v);
  },
  configurable: true,
  enumerable: true,
});

function fetchBody(url) {
  return new Promise(r => {
    var d = '';
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, function(res) {
      res.setEncoding('utf8');
      res.on('data', function(c) { d += c; });
      res.on('end', function() { r(d); });
    });
  });
}

async function main() {
  var html = await fetchBody('https://www.ouyeel.com/steel');

  var mc = '';
  var metaRe = /<meta[^>]+content=["']([^"']+)["']/gi;
  var m;
  while ((m = metaRe.exec(html)) !== null) mc = m[1];

  var scripts = [];
  var scriptRe = /<script\s*([^>]*)>([\s\S]*?)<\/script>/gi;
  while ((m = scriptRe.exec(html)) !== null) {
    var attrs = m[1], content = (m[2] || '').trim();
    var srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      var u = srcMatch[1];
      if (!u.startsWith('http')) u = 'https://www.ouyeel.com' + (u.startsWith('/') ? '' : '/') + u;
      scripts.push({ type: 'external', url: u });
    } else if (content) {
      scripts.push({ type: 'inline', code: content });
    }
  }

  document.getElementsByTagName = function(t) {
    if (String(t).toUpperCase() === 'META' && mc) {
      var el = document.createElement('META');
      el.setAttribute('content', mc);
      var cl = [el];
      cl.item = function(i) { return cl[i] || null; };
      return cl;
    }
    return [];
  };

  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    if (s.type === 'inline') {
      try { vm.runInThisContext(s.code, { filename: 's' + i + '.js', timeout: 30000, displayErrors: false }); }
      catch (e) {}
    } else {
      var ext = await fetchBody(s.url);
      vm.runInThisContext(ext, { filename: 'ext.js', timeout: 30000, displayErrors: false });
    }
  }

  try { vm.runInThisContext('window.dispatchEvent(new Event("load"))', { filename: 'load.js', timeout: 5000 }); } catch (e) {}

  var finalCookie = '';
  try { finalCookie = vm.runInThisContext('document.cookie', { filename: 'get.js', timeout: 5000 }); } catch (e) {}

  console.log('\n=== Cookie set operations (' + cookiesSet.length + ') ===');
  cookiesSet.forEach(function(c, i) {
    console.log('  #' + i + ': ' + c);
  });

  console.log('\n=== Final document.cookie ===');
  console.log('  ' + finalCookie);
  console.log('\n=== Parsed cookies ===');
  if (finalCookie) {
    finalCookie.split(';').forEach(function(p) {
      p = p.trim();
      if (p) console.log('  ' + p.split('=')[0] + ' = ' + p.slice(p.indexOf('=') + 1));
    });
  }
}

main().catch(function(e) { console.log('ERROR:', e.message); });
