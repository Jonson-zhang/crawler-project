/**
 * Patch v2: Replace FSl ternary chains with switch-case lookup
 * More efficient than IIFE, works in vm sandbox.
 */
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// Browser trace → (W,j) → F
var trace = [
    14887,11814,4399,21867,3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,16974,10689,2164,3218,2273,15635,2273,14473,
    3218,2273,15635,2273,14371,3218,2273,15635,2273,7762,3218,1481,1219,2096,
    6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,2273,22017,2273,22017,
    2273,22017,2273,15635,2273,16420,2273,15878,12497,3218,14635,2273,15635,
    2273,10287,3218,1481,2273,15635,2273,14704,15635,2273,5285,3218,15635,2273,
    1709,15635,2273,397,15635,2273,6735,2273,15635,2273,16420,2273,15635,2273,
    13760,2051,3218,2273,15635,2273,18928,15635,2273,14406,15635,2273,7178,
    3218,2273,15635,2273,7279,7299,2273,20906,3208,2273,20843,2273,3208,2273,
    20843,2273,15635,2273,15635,2273,15635,2273,7279,7299,10734,3218,2273,
    20492,3216,3655,20754,3463
];
var browserF = {};
trace.forEach(function(s) { var w=s&31,j=(s>>5)&31,f=(s>>10)&31; browserF[w+','+j]=f; });

// Generate switch-case injection
// Pattern: switch(WSl+','+jSl){case'7,17':FSl=14;break;case'6,17':FSl=11;break;...}
var cases = [];
Object.keys(browserF).forEach(function(key) {
    cases.push("case'" + key + "':FSl=" + browserF[key] + ";break;");
});
var inject = "switch(WSl+','+jSl){" + cases.join('') + "}";

// Find: 'FSl=31&p>>10;switch(WSl)'
var target = 'FSl=31&p>>10;switch(WSl)';
var idx = code.indexOf(target);
if (idx < 0) { console.error('Target not found'); process.exit(1); }

// Replace: keep the FSl=31&p>>10; then inject our switch, then the original switch(WSl)
var before = code.substring(0, idx);
// 'FSl=31&p>>10;' is kept, followed by our inject, followed by 'switch(WSl){case 0:...'
var after = code.substring(idx + 'FSl=31&p>>10;'.length);

var patched = before + 'FSl=31&p>>10;' + inject + ';' + after;
fs.writeFileSync(__dirname + '/security-patched.js', patched);
console.log('Patched: ' + patched.length + ' bytes (was ' + code.length + ')');
