
global.window = globalThis; global.self = globalThis;
global.document = {
    createElement: function(t) { return { style: {}, setAttribute: function(){}, getAttribute: function(){return null}, contentWindow: globalThis }; },
    body: { appendChild: function(){} },
    documentElement: { appendChild: function(){} },
    getElementsByTagName: function(){ return { item: function(){return null}, length: 0 }; },
    cookie: '',
};
global.location = {
    hostname: 'www.zhipin.com', href: 'https://www.zhipin.com/web/geek/jobs',
    host: 'www.zhipin.com', pathname: '/web/geek/jobs',
};
var fs = require('fs');
var code = fs.readFileSync('E:\crawler-project\Boss直聘\config\security-7c91433f.js', 'utf8');
eval(code);

var seed = process.argv[2];
var ts = parseInt(process.argv[3]);
process.stdout.write(new ABC().z(seed, ts));
