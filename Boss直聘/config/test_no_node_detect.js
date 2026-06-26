// test_no_node_detect.js - Disable Node.js detection in security JS
var fs = require('fs');

// Delete Node.js-specific globals that VMP uses for detection
delete global.process;
try { delete global.module; } catch(e) {}
try { delete global.define; } catch(e) {}

global._zp_a = '26709070.1782456825..1782456825.2.1.2.2';
global._zp_ts = '1782456825';
global.window = globalThis;
global.self = globalThis;
global.top = globalThis;
global.parent = globalThis;
global.CSSRuleList = function(){};
global.document = {
    cookie: 'ab_guid=test; __a=26709070.1782456825..1782456825.2.1.2.2; __c=1782456825; __g=-',
    createElement: function(t) { if(t==='iframe') return {style:{}, contentWindow: globalThis}; return {style:{}}; },
    body: {appendChild: function(){}},
    documentElement: {appendChild: function(){}},
    getElementsByTagName: function(){return {item:function(){return null}, length:0};}
};
global.location = {
    hostname:'www.zhipin.com',
    href:'https://www.zhipin.com/web/geek/jobs',
    host:'www.zhipin.com',
    pathname:'/web/geek/jobs'
};
global.navigator = {
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
};

var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');
eval(code);

console.log('ABC type:', typeof ABC);
if (typeof ABC !== 'undefined') {
    var token = new ABC().z('test_seed_12345', 1782456800000);
    console.log('Token len:', token.length);
    console.log('Token preview:', token.substring(0, 60));
}
