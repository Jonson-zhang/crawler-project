/**
 * Patch security JS: hardcode FSl to browser value for all visited (W,j) pairs.
 * This forces the VMP to follow the EXACT browser execution path.
 */
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// All states from browser trace (1318 steps via l().apply hook)
var trace = [
    14887,11814,4399,21867,
    3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,
    2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,
    // 16974 repeated 602 times then interleaved with 10689
    16974,16974,16974,16974,16974,16974,16974,16974,
    16974,16974,16974,16974,16974,16974,16974,16974,
    10689,16974,10689,16974,10689,16974,10689,16974,
    10689,16974,10689,16974,10689,16974,10689,16974,
    10689,16974,10689,16974,10689,16974,10689,16974,
    10689,16974,10689,16974,10689,16974,10689,16974,
    10689,16974,10689,16974,10689,16974,10689,16974,
    10689,16974,10689,16974,10689,16974,10689,16974,
    10689,16974,10689,16974,10689,16974,10689,16974,
    10689,16974,10689,16974,
    // 2164 repeated 392 times
    2164,2164,2164,2164,2164,2164,2164,2164,2164,2164,
    3218,2273,15635,2273,14473,3218,2273,15635,2273,14371,
    3218,2273,15635,2273,7762,3218,
    1481,1481,1481,1481,1481,1481,
    1219,2096,6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,
    2273,22017,2273,22017,2273,22017,2273,15635,2273,16420,
    2273,15878,12497,3218,14635,2273,15635,2273,10287,3218,
    1481,1481,1481,
    2273,2273,2273,2273,2273,2273,2273,
    15635,2273,14704,15635,2273,5285,3218,15635,2273,1709,
    15635,2273,397,15635,2273,6735,2273,15635,2273,16420,
    2273,15635,2273,13760,2051,3218,
    2273,2273,2273,2273,2273,2273,2273,2273,
    15635,2273,18928,15635,2273,14406,15635,2273,7178,
    3218,2273,15635,2273,7279,7299,2273,20906,3208,
    2273,20843,2273,3208,2273,20843,2273,
    15635,2273,15635,2273,15635,2273,7279,7299,10734,
    3218,2273,20492,3216,3655,20754,3463
];

// Build browser F lookup: "W,j" → F (first occurrence wins)
var browserF = {};
trace.forEach(function(s) {
    var w = s & 31, j = (s >> 5) & 31, f = (s >> 10) & 31;
    var key = w + ',' + j;
    if (!(key in browserF)) browserF[key] = f;
});

console.log('Browser (W,j) pairs: ' + Object.keys(browserF).length);
for (var k in browserF) {
    var p = k.split(','), w = parseInt(p[0]), j = parseInt(p[1]), f = browserF[k];
    console.log('  W=' + w + ' j=' + j + ' → F=' + f + ' (state=' + ((f<<10)|(j<<5)|w) + ')');
}

// Build injection code (compact, no spaces)
// Injects: FSl=((function(){var t={'W,j':F,...};var k=WSl+','+jSl;return k in t?t[k]:FSl})())||FSl
var entries = [];
Object.keys(browserF).forEach(function(key) {
    entries.push("'" + key + "':" + browserF[key]);
});
var inject = "FSl=31&p>>10,FSl=((function(){var t={" + entries.join(',') + "};var k=WSl+','+jSl;return k in t?t[k]:FSl})())";

// Replace: 'FSl=31&p>>10;switch(WSl)' with injection
var target = 'FSl=31&p>>10;switch(WSl)';
var idx = code.indexOf(target);
if (idx < 0) {
    console.error('Target not found!');
    process.exit(1);
}

var patched = code.substring(0, idx) + inject + ';switch(WSl)' + code.substring(idx + target.length);

fs.writeFileSync(__dirname + '/security-patched.js', patched);
console.log('\nSaved security-patched.js (' + patched.length + ' bytes, delta=' + (patched.length - code.length) + ')');
