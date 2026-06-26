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
                name: '',
                src: '',
                contentWindow: globalThis,  // 简化：直接指向 global
            };
        }
        return { style: {}, setAttribute: function() {}, getAttribute: function() { return null; } };
    },
    body: {
        appendChild: function() {},
    },
    documentElement: {
        appendChild: function() {},
    },
    getElementsByTagName: function(tag) {
        return { item: function() { return null; } };
    },
    cookie: '',
};
global.location = {
    hostname: 'www.zhipin.com',
    href: 'https://www.zhipin.com/web/geek/jobs',
    protocol: 'https:',
    host: 'www.zhipin.com',
    pathname: '/web/geek/jobs',
    search: '',
};

// 加载安全 JS
try {
    console.log('[1] Loading security-7c91433f.js...');
    require('fs').readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');
    // If the file is eval'd and sets ABC on global
    console.log('[2] Done. Checking for ABC...');
    console.log('  typeof ABC:', typeof global.ABC);
    console.log('  typeof window.ABC:', typeof window.ABC);
    if (typeof global.ABC !== 'undefined') {
        console.log('  ABC keys:', Object.keys(global.ABC));
        console.log('  ABC.prototype keys:', Object.keys(global.ABC.prototype || {}));
    }
} catch (e) {
    console.error('[!] Error:', e.message);
    console.error('  Stack:', e.stack && e.stack.substring(0, 500));
}
