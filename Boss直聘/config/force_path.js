/**
 * Force Browser Path — inject FSl override into security JS
 *
 * After FSl=31&p>>10, inject a lookup table that overrides FSl
 * to the browser's value for each (W,j) combination.
 */
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// Browser trace — all visited states
var trace = [14887,11814,4399,21867,3218,2310,3218,1219,2096,6319,3218,2273,20975,1219,2096,6319,3218,2273,20975,2273,7279,7299,2273,18784,15635,2273,6798,3218,16834,15984,22059,3218,16974,10689,2164,3218,2273,15635,2273,14473,3218,2273,15635,2273,14371,3218,2273,15635,2273,7762,3218,1481,1219,2096,6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,2273,22017,2273,22017,2273,22017,2273,15635,2273,16420,2273,15878,12497,3218,14635,2273,15635,2273,10287,3218,1481,2273,15635,2273,14704,15635,2273,5285,3218,15635,2273,1709,15635,2273,397,15635,2273,6735,2273,15635,2273,16420,2273,15635,2273,13760,2051,3218,2273,15635,2273,18928,15635,2273,14406,15635,2273,7178,3218,2273,15635,2273,7279,7299,2273,20906,3208,2273,20843,2273,3208,2273,20843,2273,15635,2273,15635,2273,15635,2273,7279,7299,10734,3218,2273,20492,3216,3655,20754,3463];

// Build browser F lookup: "W,j" → F
var browserF = {};
trace.forEach(function(s) {
    var w = s & 31, j = (s >> 5) & 31, f = (s >> 10) & 31;
    var key = w + ',' + j;
    if (!(key in browserF)) browserF[key] = f;
});

console.log('Browser (W,j) pairs: ' + Object.keys(browserF).length);

// Build inject code: JSON-like object literal (compact for minified code)
var entries = [];
Object.keys(browserF).forEach(function(key) {
    entries.push("'" + key + "':" + browserF[key]);
});
var injectCode = ';var _bF={' + entries.join(',') + '};var _k=WSl+","+jSl;if(_k in _bF)FSl=_bF[_k]';

// Find injection point: after 'FSl=31&p>>10' (right before the semicolon)
var fslPattern = 'FSl=31&p>>10;';
var idx = code.indexOf(fslPattern);
if (idx < 0) {
    console.error('FSl assignment not found!');
    process.exit(1);
}

console.log('Injection point: index ' + idx);

// Inject after the semicolon (which is included in the pattern)
var before = code.substring(0, idx + fslPattern.length);
var after = code.substring(idx + fslPattern.length);

var patched = before + injectCode + after;

fs.writeFileSync(__dirname + '/security-forced.js', patched);
console.log('Saved security-forced.js (' + patched.length + ' bytes, was ' + code.length + ')');
