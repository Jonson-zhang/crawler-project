#!/usr/bin/env node
/**
 * RS Cookie 生成器 (Node.js + sdenv)
 *
 * 被 Python main.py 通过 subprocess 调用。
 * 输出 JSON 格式 cookie 到 stdout，Python 读取后继续后续爬取。
 *
 * 用法：node generate_cookies.js
 * 输出：{"success":true,"cookies":"key1=val1; key2=val2","error":null}
 */

'use strict';

const { jsdomFromUrl } = require('sdenv');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BASE_URL = 'https://zbzx.lzjtu.edu.cn';

async function main() {
  const dom = await jsdomFromUrl(`${BASE_URL}/zbxx/hwl.htm`, {
    userAgent: UA,
    consoleConfig: { error: () => {} },
  });

  const { cookieJar, window } = dom;

  // 等待 sdenv 完成（RS JSVMP 执行 + Cookie 生成）
  await new Promise(resolve => {
    window.addEventListener('sdenv:exit', () => resolve());
    window.addEventListener('sdenv:location.replace', (e) => {
      // RS 跳转事件，正常现象
    });
    setTimeout(resolve, 10000); // 兜底超时
  });

  // 获取 cookie
  const cookies = cookieJar.getCookieStringSync(BASE_URL);

  try { window.close(); } catch (e) {}

  // 输出 JSON 到 stdout
  if (cookies) {
    process.stdout.write(JSON.stringify({
      success: true,
      cookies: cookies,
      error: null,
    }));
  } else {
    process.stdout.write(JSON.stringify({
      success: false,
      cookies: null,
      error: 'sdenv 未生成有效 Cookie',
    }));
  }

  // 延迟退出让 sdenv 清理
  setTimeout(() => process.exit(0), 500);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({
    success: false,
    cookies: null,
    error: err.message,
  }));
  setTimeout(() => process.exit(1), 500);
});
