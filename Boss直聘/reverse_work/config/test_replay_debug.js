/**
 * Debug test: run replay with error logging
 */
var fs = require('fs');
var seed = 'testXYZ', ts = 1700000000000;

// Load replay JS and add error logging to l()'s catch block
var seccode = fs.readFileSync(__dirname + '/security-replay.js', 'utf8');

// Add error logging: replace }catch(l){} with }catch(l){console.error('VMP error:',l)}
seccode = seccode.replace(/}catch\(l\){}/g, '}catch(l){console.error("VMP error:",l&&l.message,"stack:",l&&l.stack&&l.stack.substring(0,200))}');
// Also catch try{ in l(): try{for(... → try{console.error("l() started");for(...
seccode = seccode.replace(/(function l\(\)\{try\{)for\(/, '$1console.error("l() started, __T.length="+__T.length+", __P="+__P);for(');

// Setup full env
require('./env_full.js');

// Override with specific values for test
global.location.href = 'http://127.0.0.1:8899/test_browser.html';
global.location.hostname = '127.0.0.1';
global.location.origin = 'http://127.0.0.1:8899';
global.location.protocol = 'http:';
global.location.pathname = '/test_browser.html';
global.location.port = '8899';
global.location.search = '';

console.error('Eval-ing replay JS (' + seccode.length + ' bytes)...');
try {
    eval(seccode);
} catch(e) {
    console.error('Eval error:', e.message);
    process.exit(1);
}

console.error('ABC type:', typeof ABC);
if (typeof ABC !== 'undefined') {
    console.error('Calling ABC.z...');
    try {
        var token = new ABC().z(seed, ts);
        console.error('Token result:', typeof token, token ? token.length : 'null');
        if (token) {
            console.error('Prefix:', token.substring(0, 20));
            process.stdout.write(token);
        }
    } catch(e) {
        console.error('ABC.z() threw:', e.message);
    }
}
