#!/usr/bin/env node
/**
 * 调试脚本：使用 env-patch 生成的 cookie 手动调用 API
 */
const _r = require;
const https = _r('https');
_r('./env_site');
global.setTimeout = function(){};
global.setInterval = function(){};

function fetchBody(url) {
  return new Promise(r => { let d=''; https.get(url,{headers:{'User-Agent':'Mozilla/5.0'}},res=>{res.setEncoding('utf8');res.on('data',c=>d+=c);res.on('end',()=>r(d));}); });
}

async function main() {
  // 1. 获取页面
  const html = await fetchBody('https://www.ouyeel.com/steel');

  // 2. 解析
  const metaRe = /<meta[^>]+content=["']([^"']+)["']/gi;
  let m, mc = '';
  while ((m = metaRe.exec(html)) !== null) mc = m[1];

  const scripts = [];
  const re = /<script\s*([^>]*)>([\s\S]*?)<\/script>/gi;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1], content = (m[2]||'').trim();
    const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      let u = srcMatch[1];
      if (!u.startsWith('http')) u = 'https://www.ouyeel.com' + (u.startsWith('/')?'':'/') + u;
      scripts.push({type:'external',url:u});
    } else if (content) {
      scripts.push({type:'inline',code:content});
    }
  }

  // 3. 设置 meta
  document.getElementsByTagName = function(t) {
    if (String(t).toUpperCase() === 'META' && mc) {
      const el = document.createElement('META');
      el.setAttribute('content', mc);
      const coll = [el];
      coll.item = function(i) { return coll[i]||null; };
      return coll;
    }
    return [];
  };

  // 4. 执行 RS6
  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    if (s.type === 'inline') {
      try { eval(s.code); } catch(e) {}
    } else {
      const ext = await fetchBody(s.url);
      eval(ext);
    }
  }
  try { eval('window.dispatchEvent(new Event("load"))'); } catch(e) {}

  // 5. 清理 cookie
  function parseCookies(str, obj) {
    (str||'').split(';').forEach(function(p) {
      p = p.trim(); if (!p) return;
      const i = p.indexOf('='); if (i < 0) return;
      const n = p.slice(0,i).trim().toLowerCase();
      if (['path','expires','domain','max-age','samesite','httponly','secure'].indexOf(n) >= 0) return;
      obj[n] = p.slice(i+1).trim();
    });
  }
  const cookies = {};
  parseCookies(document.cookie, cookies);
  const cookieStr = Object.keys(cookies).map(k => k + '=' + cookies[k]).join('; ');
  console.log('Cookie length:', cookieStr.length);
  console.log('Cookie keys:', Object.keys(cookies).join(', '));

  // 6. 使用 Node.js https 直接发 API POST
  const postData = 'criteriaJson=' + encodeURIComponent(JSON.stringify({channel:'RJ',pageIndex:0,pageSize:5}));
  const options = {
    hostname: 'www.ouyeel.com',
    path: '/search-ng/complexSearch/queryResult',
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr,
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://www.ouyeel.com',
      'Referer': 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=0&pageSize=5',
    }
  };

  const apiResp = await new Promise(r => {
    const req = https.request(options, res => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', c => d += c);
      res.on('end', () => r({ status: res.statusCode, body: d }));
    });
    req.write(postData);
    req.end();
  });

  console.log('API Status:', apiResp.status);
  if (apiResp.status === 200) {
    console.log('✅ SUCCESS! Body length:', apiResp.body.length);
    const json = JSON.parse(apiResp.body);
    console.log('count:', json.count, 'totalWeight:', json.totalWeight);
  } else {
    console.log('❌ FAILED: HTTP', apiResp.status);
    console.log('body preview:', apiResp.body.slice(0, 300));
  }
}

main().catch(e => console.log('ERROR:', e.message));
