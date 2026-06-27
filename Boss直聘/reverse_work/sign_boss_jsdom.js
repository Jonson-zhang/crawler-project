/**
 * sign_boss_jsdom.js — kk.py 路线复现
 * 用 jsdom 代替 vm.createContext，利用真实 DOM API 实现
 * 参考: https://github.com/zwgFF/zp_stoken_jsLearn
 */
var { JSDOM } = require('jsdom');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var seed = process.argv[2] || 'test_seed_44_chars_long_abcde12345678';
var ts = parseInt(process.argv[3] || '1700000000000');

// 创建 DOM
var dom = new JSDOM('<!DOCTYPE html><html></html>', {
    url: 'https://www.zhipin.com',
    pretendToBeVisual: true,
    runScripts: 'dangerously'
});

var window = dom.window;
var navigator = window.navigator;
var document = window.document;

// 设置 location（匹配 /web/common/security-check.html 的 query string）
// kk.py 算法: canshu0 为 seed, canshu1 为 ts
// location.search = "?seed=xxx&ts=xxx&name=xxx"
window.location.search = '?seed=' + encodeURIComponent(seed) + '&ts=' + ts + '&name=7c91433f';

// 用 window.eval 执行安全 JS
try {
    dom.window.eval(code);
} catch(e) {
    process.stderr.write('Eval error: ' + e.message + '\n');
    process.exit(1);
}

// 获取 ABC
if (typeof window.ABC === 'undefined') {
    process.stderr.write('ABC not defined\n');
    process.exit(1);
}

// kk.py 时区计算: ts + 1000*60*(480 + new Date().getTimezoneOffset())
// 中国 UTC+8: getTimezoneOffset() = -480, 所以表达式 = + 0
var timezoneOffset = 60 * (480 + new Date().getTimezoneOffset()) * 1000;
var computedTs = parseInt(ts) + timezoneOffset;

var token = new window.ABC().z(seed, computedTs);

process.stdout.write(encodeURIComponent(token));
