#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

// ═══ Get fresh cookies + test the API ═══
// Fresh cookies from browser (no web_session = not logged in)
const FRESH_COOKIES = 'abRequestId=55818780-4559-5657-97fb-afaa660ae5b3; ets=1782291318315; webBuild=6.23.0; xsecappid=xhs-pc-web; loadts=1782291318357; a1=19ef8d7465ahmyhdq3gxgtie8qcww35qcthgyqvlm50000154532; webId=bcd58f897d12b78d281c5fe1b5dde8a4; websectiga=cffd9dcea65962b05ab048ac76962acee933d26157113bb213105a116241fa6c; sec_poison_id=c61bc9fe-7192-47f4-95c5-35a87fde3882';

// Old saved cookies (has web_session from logged-in session)
const OLD_COOKIES_FILE = path.join(__dirname, 'data', 'cookies.json');

function getOldCookies() {
  try {
    const c = JSON.parse(fs.readFileSync(OLD_COOKIES_FILE, 'utf-8'));
    return Object.entries(c).map(([k,v]) => k + '=' + v).join('; ');
  } catch(e) { return ''; }
}

function testAPI(cookieStr, label) {
  return new Promise((resolve) => {
    const url = '/api/sns/web/v1/homefeed';
    const body = JSON.stringify({cursor_score:'',num:20,refresh_type:1,note_index:0});

    const options = {
      hostname: 'edith.xiaohongshu.com',
      path: url,
      method: 'POST',
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        'cookie': cookieStr,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'origin': 'https://www.xiaohongshu.com',
        'referer': 'https://www.xiaohongshu.com/',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(label + ': Status=' + res.statusCode + ' Resp=' + data.slice(0, 100));
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('=== Cookie validity test ===\n');

  // Test 1: Old cookies only
  await testAPI(getOldCookies(), 'Test 1 (old cookies)');

  // Test 2: Fresh cookies only
  await testAPI(FRESH_COOKIES, 'Test 2 (fresh cookies)');

  // Test 3: Old cookies + fresh a1 token
  const mixed1 = getOldCookies().replace(/a1=[^;]+/, 'a1=19ef8d7465ahmyhdq3gxgtie8qcww35qcthgyqvlm50000154532');
  await testAPI(mixed1, 'Test 3 (mixed old+new a1)');

  // ═══ Test with _webmsxyw signature ═══
  console.log('\n=== Test with _webmsxyw signature ===');

  const { init, getSandbox } = require('./sign');
  init();
  const s = getSandbox();

  const sigUrl = '/api/sns/web/v1/homefeed';
  const sigBody = JSON.stringify({cursor_score:'',num:20,refresh_type:1,note_index:0});
  const sigResult = s._webmsxyw(sigUrl, sigBody);

  console.log('X-s prefix:', sigResult['X-s'].slice(0, 30));
  console.log('X-t:', sigResult['X-t']);

  const options = {
    hostname: 'edith.xiaohongshu.com',
    path: sigUrl,
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'x-s': sigResult['X-s'],
      'x-t': String(sigResult['X-t']),
      'cookie': getOldCookies(),
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'origin': 'https://www.xiaohongshu.com',
      'referer': 'https://www.xiaohongshu.com/',
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data.slice(0, 300));
      try {
        const obj = JSON.parse(data);
        console.log('success:', obj.success, 'code:', obj.code);
      } catch(e) {}
    });
  });
  req.on('error', (e) => console.error('Error:', e.message));
  req.write(sigBody);
  req.end();
})();
