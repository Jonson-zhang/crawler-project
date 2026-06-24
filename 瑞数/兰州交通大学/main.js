#!/usr/bin/env node
/**
 * 兰州交通大学招标信息获取 — 基于 sdenv 纯 Node.js 方案
 *
 * 原理：
 *   1. sdenv jsdomFromUrl 加载 412 页面，RS JSVMP 在 jsdom 中执行
 *   2. 生成 evbSrBv8QGpBP Cookie（客户端指纹加密包）
 *   3. 重用 cookieJar 加载目标页面（DWR AJAX 动态加载内容）
 *   4. cheerio 解析招标列表，支持翻页
 *
 * 依赖：npm i sdenv cheerio
 *
 * 用法：
 *   node main.js hwl     # 货物类（默认）
 *   node main.js gcl     # 工程类
 *   node main.js fwl     # 服务类
 *   node main.js all     # 全部三类
 */

'use strict';

const { jsdomFromUrl } = require('sdenv');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const HOST = 'zbzx.lzjtu.edu.cn';
const BASE_URL = `https://${HOST}`;
const CATEGORIES = {
  hwl: { name: '货物类', basePath: '/zbxx/hwl.htm' },
  gcl: { name: '工程类', basePath: '/zbxx/gcl.htm' },
  fwl: { name: '服务类', basePath: '/zbxx/fwl.htm' },
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// ── URL 解析 ──
function resolveUrl(href, basePath) {
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return BASE_URL + href;

  // 相对路径：相对于 basePath 的目录
  const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
  const combined = (baseDir + href).replace(/\/\.\//g, '/');

  // 处理 ../
  const parts = combined.split('/');
  const clean = [];
  for (const p of parts) {
    if (p === '..') { clean.pop(); }
    else if (p !== '.' && p !== '') { clean.push(p); }
  }
  return BASE_URL + '/' + clean.join('/');
}

// ── sdenv 页面加载 ──
async function loadPage(url, cookieJar = null) {
  const config = { userAgent: UA, consoleConfig: { error: () => {} } };
  if (cookieJar) config.cookieJar = cookieJar;

  const dom = await jsdomFromUrl(url, config);
  const { window } = dom;
  const capturedJar = dom.cookieJar;

  // RS JSVMP 生成 Cookie 后可能触发跳转
  window.addEventListener('sdenv:location.replace', () => {});
  window.addEventListener('sdenv:location.assign', () => {});

  // 等待 JS 执行完成
  await new Promise(resolve => {
    window.addEventListener('sdenv:exit', () => resolve());
    setTimeout(resolve, 10000);
  });

  return { window, cookieJar: capturedJar };
}

// ── 页面解析 ──
function parseItems(domWindow, basePath) {
  const $ = cheerio.load(domWindow.document.documentElement.outerHTML);
  const items = [];

  // 网站群 CMS: 招标列表在 div.listmain 中
  $('.listmain a').each((i, el) => {
    const $a = $(el);
    const title = $a.text().trim();
    if (!title || title.length < 5) return;
    // 过滤分类导航
    if (['货物类', '工程类', '服务类', '招标信息', '信息公示'].includes(title)) return;

    const href = $a.attr('href') || '';
    if (!href) return;

    // 日期：从文本中提取 [YYYY年MM月DD日]
    const parentText = $a.parent().text() || '';
    const dateMatch = parentText.match(/\[(\d{4}年\d{2}月\d{2}日)\]/);
    const date = dateMatch ? dateMatch[1] : '';

    items.push({
      title,
      url: resolveUrl(href, basePath),
      date,
    });
  });

  return items;
}

function getNextPageUrl(domWindow, basePath) {
  const $ = cheerio.load(domWindow.document.documentElement.outerHTML);

  // 网站群分页：class="page" 中的"下页"链接
  const nextEl = $('.page a').filter((i, el) => {
    const t = $(el).text().trim();
    return t === '下页' || t === '下一页' || t === '>»';
  }).first();

  if (nextEl.length) {
    const href = nextEl.attr('href') || '';
    if (href && href !== '#' && !href.includes('javascript:')) {
      return resolveUrl(href, basePath);
    }
  }
  return null;
}

// ── 爬取单个分类 ──
async function crawlCategory(catKey, cookieJar) {
  const cat = CATEGORIES[catKey];
  console.log(`\n${
    '='.repeat(60)}\n📋 ${cat.name} (${catKey})\n${'='.repeat(60)}`);

  const allItems = [];
  let pageNum = 1;
  let url = BASE_URL + cat.basePath;

  while (pageNum <= 100) { // 安全上限
    console.log(`  第 ${pageNum} 页...`);

    const { window, cookieJar: newJar } = await loadPage(url, cookieJar);
    if (!cookieJar) cookieJar = newJar;

    const items = parseItems(window, cat.basePath);
    if (items.length === 0) {
      console.log('  → 无数据，停止翻页');
      try { window.close(); } catch (e) {}
      break;
    }

    const newItems = items.filter(item =>
      !allItems.some(existing => existing.title === item.title)
    );
    console.log(`  → ${newItems.length} 条 (新增) / ${items.length} 条 (本页)`);
    allItems.push(...newItems);

    // 查分页
    const nextUrl = getNextPageUrl(window, cat.basePath);
    try { window.close(); } catch (e) {}

    if (!nextUrl || newItems.length === 0) break;

    url = nextUrl;
    pageNum++;
    await new Promise(r => setTimeout(r, 2000)); // 间隔
  }

  return { category: cat.name, items: allItems, total: allItems.length };
}

// ── 入口 ──
async function main() {
  console.log('='.repeat(60));
  console.log('  兰州交通大学招标信息获取');
  console.log('  sdenv 纯 Node.js (RS6 + DWR)');
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Step 1: 通过 RS 412 挑战
  console.log('\n[1] 通过 RS 412 挑战...');
  const { cookieJar } = await loadPage(BASE_URL + '/zbxx/hwl.htm');
  const cookies = cookieJar.getCookieStringSync(BASE_URL);
  console.log(`  ✅ Cookie 已生成 (${cookies.length} 字符)`);

  // Step 2: 爬取
  const target = process.argv[2] || 'hwl';
  const keys = target === 'all' ? Object.keys(CATEGORIES) : [target];
  console.log(`\n[2] 爬取: ${keys.map(k => CATEGORIES[k].name).join(', ')}`);

  for (const key of keys) {
    const result = await crawlCategory(key, cookieJar);

    // 保存
    const outPath = path.join(__dirname, `${CATEGORIES[key].name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

    // 打印
    console.log(`\n  📁 ${outPath}`);
    console.log(`  📊 共 ${result.total} 条`);
    if (result.items.length > 0) {
      console.log(`  📌 最新: ${result.items[0].title}`);
      console.log(`  📌 最旧: ${result.items[result.items.length - 1].title}`);
      console.log('');
      result.items.forEach((item, i) => {
        console.log(`  ${String(i + 1).padStart(3, ' ')}. ${item.title}`);
        console.log(`       📅 ${item.date || '未标注'}  🔗 ${item.url}`);
      });
    }
  }

  console.log(`\n✅ 完成! 耗时 ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  process.exit(0); // sdenv 保持 event loop，显式退出
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
