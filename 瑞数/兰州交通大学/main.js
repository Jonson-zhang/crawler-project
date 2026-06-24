#!/usr/bin/env node
/**
 * 兰州交通大学招标信息获取 — 基于 sdenv 纯 Node.js 方案
 *
 * 原理：
 *   1. sdenv jsdomFromUrl 加载 412 页面
 *   2. RS JSVMP 在 jsdom 中真实执行 → 生成 evbSrBv8QGpBT cookie
 *   3. 携带完整 Cookie 请求招标列表页面 → cheerio 解析
 *
 * 依赖：sdenv, cheerio
 */

'use strict';

const { jsdomFromUrl, logger } = require('sdenv');
const https = require('https');

// ── 配置 ──
const HOST = 'zbzx.lzjtu.edu.cn';
const BASE_URL = `https://${HOST}`;
const ENTRY_PATH = '/zbxx/hwl.htm';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// ── 工具函数 ──
function httpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: HOST,
      port: 443,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'User-Agent': UA,
        'Host': HOST,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': BASE_URL + '/',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        ...(options.headers || {}),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function parseBiddingList(html) {
  // 尝试解析招标列表页面
  const results = [];

  // 提取 title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : '';

  // 遍历所有可能的列表结构
  // 模式1: <a href="..."> 链接列表
  const linkPattern = /<a[^>]*href\s*=\s*["']([^"']*show[^"']*\d+[^"']*|zb[^"']*|detail[^"']*|hwl[^"']*\.\w+)[^"']*["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1].replace(/&amp;/g, '&');
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text && text.length > 3) {
      results.push({ title: text, url: href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? '' : '/') + href });
    }
  }

  // 模式2: <tr> 表格行
  const trPattern = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<a[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([^<]*)<\/a>[\s\S]*?<\/tr>/gi;
  while ((match = trPattern.exec(html)) !== null) {
    const href = match[1].replace(/&amp;/g, '&');
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text && text.length > 3 && !results.some(r => r.title === text)) {
      results.push({ title: text, url: href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? '' : '/') + href });
    }
  }

  return { title, count: results.length, items: results.slice(0, 100) };
}

// ── 主流程 ──
async function main() {
  console.log('='.repeat(60));
  console.log('兰州交通大学招标信息获取 (sdenv 纯 Node.js 方案)');
  console.log('='.repeat(60));
  console.log('');

  // Step 1: sdenv 加载 412 页面，让 RS JSVMP 生成 Cookie T
  console.log('[1/3] 正在通过 RS 挑战...');
  console.log(`      加载 ${BASE_URL}${ENTRY_PATH}`);

  let dom;
  try {
    dom = await jsdomFromUrl(`${BASE_URL}${ENTRY_PATH}`, {
      userAgent: UA,
      consoleConfig: { error: () => {} },
    });
  } catch (e) {
    console.error('  sdenv 加载失败:', e.message);
    console.log('  尝试备用方案...');
    process.exit(1);
  }

  const { window, cookieJar } = dom;
  const cookies = cookieJar.getCookieStringSync(BASE_URL);
  console.log(`  Cookie 生成结果: ${cookies ? '✅ 成功' : '❌ 失败'}`);
  console.log(`  Cookie 内容: ${cookies.substring(0, 120)}...`);
  console.log('');

  // Step 2: 监听页面跳转事件（RS JS 通常会在生成 cookie 后做 location.replace）
  let redirectUrl = null;
  window.addEventListener('sdenv:location.replace', (e) => {
    redirectUrl = e.detail.url;
    console.log(`  检测到 RS 跳转: ${redirectUrl}`);
    e.target.close();
  });
  window.addEventListener('sdenv:location.assign', (e) => {
    redirectUrl = e.detail.url;
    console.log(`  检测到 RS assign: ${redirectUrl}`);
    e.target.close();
  });

  // 等待 JS 执行完成（RS JSVMP 需要几秒）
  console.log('  等待 RS JSVMP 执行...');
  await new Promise(resolve => {
    window.addEventListener('sdenv:exit', () => resolve());
    // 超时兜底：8秒后继续
    setTimeout(resolve, 8000);
  });

  // 最终 cookie
  const finalCookies = cookieJar.getCookieStringSync(BASE_URL);
  console.log(`  最终 Cookie: ${finalCookies ? finalCookies.substring(0, 150) : '(空)'}`);
  console.log('');

  // Step 3: 用 Cookie 请求招标列表页面
  console.log('[2/3] 请求招标列表页面...');

  const pageUrl = redirectUrl || `${BASE_URL}${ENTRY_PATH}`;
  let listHtml = '';
  try {
    const result = await httpRequest({
      path: new URL(pageUrl).pathname + (new URL(pageUrl).search || ''),
      headers: finalCookies ? { Cookie: finalCookies } : {},
    });

    console.log(`  响应状态: ${result.status}`);
    console.log(`  响应长度: ${result.body.length} 字符`);
    listHtml = result.body;
  } catch (e) {
    console.error(`  请求失败: ${e.message}`);
    // 尝试直接用 sdenv 的 cookieJar 重新加载
    try {
      const dom2 = await jsdomFromUrl(pageUrl, {
        cookieJar,
        userAgent: UA,
        consoleConfig: { error: () => {} },
      });
      listHtml = dom2.window.document.documentElement.outerHTML;
      console.log(`  通过 sdenv 重载成功: ${listHtml.length} 字符`);
    } catch (e2) {
      console.error(`  重载也失败: ${e2.message}`);
      process.exit(1);
    }
  }

  // Step 4: 解析招标列表
  console.log('');
  console.log('[3/3] 解析招标信息...');
  const parsed = parseBiddingList(listHtml);

  console.log('');
  console.log('='.repeat(60));
  console.log(`📋 页面标题: ${parsed.title}`);
  console.log(`📊 共发现 ${parsed.count} 条招标信息`);
  console.log('='.repeat(60));
  console.log('');

  if (parsed.items.length > 0) {
    parsed.items.forEach((item, i) => {
      console.log(`${String(i + 1).padStart(3, ' ')}. ${item.title}`);
      console.log(`     ${item.url}`);
      console.log('');
    });
  } else {
    console.log('未能解析到招标列表，打印原始 HTML 前 2000 字符供分析：');
    console.log('-'.repeat(60));
    console.log(listHtml.substring(0, 2000));
    console.log('-'.repeat(60));
  }

  // 清理
  try { window.close(); } catch (e) {}
  console.log('');
  console.log('✅ 完成');
}

main().catch(err => {
  console.error('❌ 运行失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
