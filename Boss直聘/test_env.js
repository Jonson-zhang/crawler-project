/**
 * Boss直聘安全 JS 环境测试 - 诊断驱动最小起点
 * 目标：让 security-7c91433f.js 在 Node.js 中加载并暴露 ABC 类
 */

// Step 0: 最小环境
global.window = globalThis;
global.self = globalThis;
global.document = {
    createElement: function(tag) {
        if (tag === 'iframe') {
            return {
                style: {},
                setAttribute: function() {},
                getAttribute: function() { return null; },
                contentWindow: globalThis,
            };
        }
        return { style: {}, setAttribute: function() {}, getAttribute: function() { return null; } };
    },
    body: { appendChild: function() {} },
    documentElement: { appendChild: function() {} },
    getElementsByTagName: function(tag) {
        return { item: function() { return null; }, length: 0 };
    },
    cookie: '',
};
global.location = {
    hostname: 'www.zhipin.com',
    href: 'https://www.zhipin.com/web/geek/jobs',
    host: 'www.zhipin.com',
    pathname: '/web/geek/jobs',
};

// 加载安全 JS
try {
    console.log('[1] Loading security-7c91433f.js...');
    var code = require('fs').readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');
    eval(code);
    console.log('[2] Done. Checking for ABC...');
    console.log('  typeof ABC:', typeof global.ABC);

    // Check for any new globals
    var newGlobals = Object.getOwnPropertyNames(global).filter(function(k) {
        return k.length <= 4 && k === k.toUpperCase() && typeof global[k] === 'function';
    });
    console.log('  Short uppercase function globals:', newGlobals);

    if (typeof global.ABC !== 'undefined') {
        console.log('  ABC found!');
        console.log('  ABC keys:', Object.keys(global.ABC));
        if (global.ABC.prototype) {
            console.log('  ABC.prototype keys:', Object.keys(global.ABC.prototype));
        }
    }
} catch (e) {
    console.error('[!] Error:', e.message);
    console.error('  First 300 chars:', e.stack && e.stack.substring(0, 300));
}
