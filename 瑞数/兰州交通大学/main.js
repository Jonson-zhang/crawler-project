#!/usr/bin/env node
/**
 * 兰州交通大学招标信息获取 — 基于 sdenv 纯 Node.js 方案
 *
 * 原理：
 *   1. sdenv jsdomFromUrl 加载 412 页面，RS JSVMP 在 jsdom 中真实执行
 *   2. 生成 evbSrBv8QGpBP Cookie（客户端指纹加密包）
 *   3. 重用 cookieJar 加载目标页面（DWR AJAX 动态加载内容）
 *   4. 解析招标列表，支持翻页
 *
 * 依赖：npm i sdenv cheerio
 */

'use strict';

const { jsdomFromUrl } = require('sdenv');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// ── 配置 ──
const HOST = 'zbzx.lzjtu.edu.cn';
const BASE_URL = `https://${HOST}`;
const CATEGORIES = {
  hwl: { name: '货物类', path: '/zbxx/hwl.htm', output: 'goods.json' },
  gcl: { name: '工程类', path: '/zbxx/gcl.htm', output: 'construction.json' },
  fwl: { name: '服务类', path: '/zbxx/fwl.htm', output: 'service.json' },
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// ── 工具函数 ──

/**
 * 从 sdenv 页面解析招标列表
 */
function parseList(dom) {
  const $ = cheerio.load(dom.window.document.documentElement.outerHTML);
  const items = [];

  // 解析 listmain 下的招标条目
  // 站点使用网站群 CMS，列表在 div.listmain 内
  const listDiv = $('.listmain').first();
  if (!listDiv.length) {
    // 尝试其他选择器
    console.log('  listmain 未找到，尝试其他选择器...');
  }

  // 遍历 listmain 中的所有链接
  listDiv.find('a').each((i, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const title = $a.text().trim();
    // 过滤掉导航链接（如"货物类""工程类"等分类标签）
    if (!title || title.length < 5) return;
    if (['货物类', '工程类', '服务类'].includes(title)) return;

    // 获取日期（通常在紧跟的 span 或 [] 中）
    let date = '';
    const parentText = $a.parent().text() || '';
    const dateMatch = parentText.match(/\[(\d{4}年\d{2}月\d{2}日)\]/);
    if (dateMatch) date = dateMatch[1];
    else {
      // 尝试从兄弟节点获取
      const nextText = $a.parent().next().text() || '';
      const dm2 = nextText.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
      if (dm2) date = dm2[1];
    }

    // 构建完整 URL（处理 ../../info/10446/89194.htm 等相对路径）
    let fullUrl;
    if (href.startsWith('http')) {
      fullUrl = href;
    } else if (href.startsWith('/')) {
      fullUrl = BASE_URL + href;
    } else {
      // 相对路径（含 ../）→ 相对于当前分类页面解析
      // ../info/10446/89194.htm → /info/10446/89194.htm
      const basePath = CATEGORIES[key] ? CATEGORIES[key].path : '/zbxx/hwl.htm';
      const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1); // /zbxx/
      const resolved = baseDir + href; // /zbxx/../info/10446/89194.htm
      // 简化 ../
      const parts = resolved.split('/');
      const cleanParts = [];
      for (const p of parts) {
        if (p === '..') cleanParts.pop();
        else if (p !== '.') cleanParts.push(p);
      }
      fullUrl = BASE_URL + '/' + cleanParts.join('/');
    }

    // 需要知道当前分类来解析相对路径
    // 用 IIFE 包装一次确定 catKey
    const catKey = currentCategoryKey || 'hwl';

    items.push({
      title,
      url: fullUrl,
      date,
      // 提取可能的项目编号
      projectId: (title.match(/[A-Z]{2,5}\d{4,}-?\d*/) || [''])[0],
    });
  });

  return items;
}

/**
 * 获取分页信息
 */
function getPagination(dom) {
  const $ = cheerio.load(dom.window.document.documentElement.outerHTML);
  const pages = { current: 1, total: 1, hasNext: false, nextUrl: null, totalPages: [] };

  // 解析分页导航（网站群 CMS 的 _simple_list_gotopage_fun 函数）
  const pageDiv = $('.page, .pagination, #page').first();
  if (!pageDiv.length) return pages;

  // 查找"下页"链接
  const nextLink = pageDiv.find('a').filter((i, el) => {
    const t = $(el).text().trim();
    return t === '下页' || t === '下一页' || t === '>' || t === '»';
  }).first();

  if (nextLink.length) {
    pages.hasNext = true;
    pages.nextUrl = nextLink.attr('href') || null;
  }

  // 查找总页数
  const pageText = pageDiv.text();
  const totalMatch = pageText.match(/共\s*(\d+)\s*页/);
  if (totalMatch) pages.total = parseInt(totalMatch[1]);

  return pages;
}

/**
 * sdenv 加载页面（带 Cookie 持久化）
 */
async function loadPage(url, cookieJar = null) {
  const config = {
    userAgent: UA,
    consoleConfig: { error: () => {} },
  };
  if (cookieJar) config.cookieJar = cookieJar;

  const dom = await jsdomFromUrl(url, config);
  const { window } = dom;

  // 马上捕获 cookieJar 引用（防止 close 事件后丢失）
  const capturedJar = dom.cookieJar;

  // 监听 RS 跳转（RS JSVMP 生成 Cookie 后可能触发跳转）
  window.addEventListener('sdenv:location.replace', (e) => {
    // 不 close，让页面自然完成
  });

  // 等待 JS 执行完成（RS JSVMP + DWR AJAX）
  await new Promise(resolve => {
    window.addEventListener('sdenv:exit', () => resolve());
    setTimeout(resolve, 10000);
  });

  // 把捕获的 cookieJar 挂回去
  dom._capturedJar = capturedJar;
  return dom;
}

/**
 * 获取单个分类的数据
 */
async function crawlCategory(categoryKey, cookieJar) {
  const cat = CATEGORIES[categoryKey];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 分类: ${cat.name} (${categoryKey})`);
  console.log(`${'='.repeat(60)}`);

  const allItems = [];
  let currentPage = 1;
  let hasNext = true;
  let currentUrl = `${BASE_URL}${cat.path}`;

  while (hasNext) {
    console.log(`\n  第 ${currentPage} 页: ${currentUrl}`);

    let dom;
    try {
      dom = await loadPage(currentUrl, cookieJar);
      // 首次加载后保存 cookieJar
      if (!cookieJar) cookieJar = dom._capturedJar || dom.cookieJar;
    } catch (e) {
      console.error(`  ❌ 加载失败: ${e.message}`);
      break;
    }

    const items = parseList(dom);
    console.log(`  解析到 ${items.length} 条招标信息`);

    if (items.length === 0) {
      console.log('  无更多数据，停止翻页');
      break;
    }

    allItems.push(...items);

    // 检查分页
    const pagination = getPagination(dom);
    if (pagination.hasNext && pagination.nextUrl && currentPage < 50) {
      currentPage++;
      currentUrl = pagination.nextUrl.startsWith('http') ?
        pagination.nextUrl : BASE_URL + (pagination.nextUrl.startsWith('/') ? '' : '/') + pagination.nextUrl;
    } else {
      hasNext = false;
    }

    try { dom.window.close(); } catch (e) {}

    // 翻页间隔
    if (hasNext) await new Promise(r => setTimeout(r, 2000));
  }

  return { category: cat.name, items: allItems, total: allItems.length };
}

// ── 主流程 ──
async function main() {
  console.log('='.repeat(60));
  console.log('  兰州交通大学招标信息获取');
  console.log('  基于 sdenv 纯 Node.js 方案 (RS6 + DWR)');
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Step 1: 通过 RS 挑战，获取 Cookie
  console.log('\n[1/4] 正在通过 RS 412 挑战（sdenv jsdom）...');
  let cookieJar = null;
  try {
    const dom = await loadPage(`${BASE_URL}/zbxx/hwl.htm`);
    cookieJar = dom._capturedJar || dom.cookieJar;
    const cookies = (cookieJar && cookieJar.getCookieStringSync) ? cookieJar.getCookieStringSync(BASE_URL) : '';
    console.log(`  ✅ Cookie 生成成功 (${cookies.length} 字符)`);
    try { dom.window.close(); } catch (e) {}
  } catch (e) {
    console.error(`  ❌ RS 挑战失败: ${e.message}`);
    console.error(e.stack);
    process.exit(1);
  }

  // Step 2-3: 按分类爬取
  const crawlType = process.argv[2] || 'hwl'; // 默认货物类
  const categoryKeys = crawlType === 'all' ? Object.keys(CATEGORIES) : [crawlType];

  console.log(`\n[2/4] 爬取分类: ${categoryKeys.map(k => CATEGORIES[k].name).join(', ')}`);

  const allResults = {};
  for (const key of categoryKeys) {
    const result = await crawlCategory(key, cookieJar);
    allResults[key] = result;

    // 保存中间结果
    const outPath = path.join(__dirname, result.category + '.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`  💾 已保存: ${outPath}`);
  }

  // Step 4: 输出汇总
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[4/4] ✅ 完成! 耗时 ${totalTime}s`);
  console.log('='.repeat(60));

  for (const [key, result] of Object.entries(allResults)) {
    console.log(`  ${result.category}: ${result.total} 条`);
    if (result.items.length > 0) {
      console.log(`    最新: ${result.items[0].title}`);
      console.log(`    最旧: ${result.items[result.items.length - 1].title}`);
    }
  }

  // 打印货物类的前10条
  const hwlResult = allResults['hwl'];
  if (hwlResult && hwlResult.items.length > 0) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 货物类招标列表 (共 ${hwlResult.total} 条)`);
    console.log(`${'─'.repeat(60)}`);
    hwlResult.items.slice(0, 20).forEach((item, i) => {
      console.log(`${String(i + 1).padStart(3, ' ')}. ${item.title}`);
      console.log(`     📅 ${item.date || '日期未知'}  🔗 ${item.url}`);
    });
  }
}

main().catch(err => {
  console.error('❌ 运行失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
