/**
 * Boss直聘安全 JS - 测试 ABC.z() 加密函数
 */
global.window = globalThis;
global.self = globalThis;
global.document = {
    createElement: function(tag) {
        if (tag === 'iframe') {
            return { style: {}, setAttribute: function() {}, getAttribute: function() { return null; }, contentWindow: globalThis };
        }
        return { style: {}, setAttribute: function() {}, getAttribute: function() { return null; } };
    },
    body: { appendChild: function() {} },
    documentElement: { appendChild: function() {} },
    getElementsByTagName: function(tag) { return { item: function() { return null; }, length: 0 }; },
    cookie: '',
};
global.location = {
    hostname: 'www.zhipin.com', href: 'https://www.zhipin.com/web/geek/jobs',
    host: 'www.zhipin.com', pathname: '/web/geek/jobs',
};

// 加载安全 JS
var code = require('fs').readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');
eval(code);

// 测试 ABC.z()
var seed = "test_seed_12345";
var ts = Date.now();
console.log('[Test] ABC.z()');
console.log('  seed:', seed);
console.log('  ts:', ts);

try {
    var result = new ABC().z(seed, ts);
    console.log('  result length:', result ? result.length : 'null');
    console.log('  result preview:', result ? result.substring(0, 80) : 'null');
    console.log('  result type:', typeof result);
} catch(e) {
    console.error('  Error:', e.message);
    console.error('  Stack:', e.stack.substring(0, 500));
}

// 对比：真实 token 长度是 461 (URL编码后)
// URL 解码后应该更短
