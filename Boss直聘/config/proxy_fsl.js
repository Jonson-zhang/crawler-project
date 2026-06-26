/**
 * Proxy FSl: wrap the VMP for-loop to intercept FSl at runtime
 * Dynamically override FSl to browser value for each (W,j) pair.
 * Uses JavaScript Proxy on the scope object.
 */
var fs = require('fs');
var originalCode = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// Build browser (W,j) → F table
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
var bF = {};
trace.forEach(function(s) {
    var w = s & 31, j = (s >> 5) & 31, f = (s >> 10) & 31;
    bF[w * 32 + j] = f;
});

// Strategy: modify the for loop to call a function that overrides FSl
// BEFORE the switch(WSl) is evaluated.
// Original: var WSl=31&p,jSl=31&p>>5,FSl=31&p>>10;switch(WSl){...}
// Modified: var WSl=31&p,jSl=31&p>>5,FSl=31&p>>10,FSl=_bT[WSl*32+jSl]>=0?_bT[WSl*32+jSl]:FSl;switch(WSl){...}

// Build the table as an array literal
var arr = [];
for (var i = 0; i < 1024; i++) arr.push(bF[i] !== undefined ? bF[i] : -1);
var tableStr = '_bT=[' + arr.join(',') + ']';

// 1. Inject table into IIFE scope (before function l())
var lDef = originalCode.indexOf(',function(){function l(){');
var withTable = originalCode.substring(0, lDef + 12) + 'var ' + tableStr + ';' + originalCode.substring(lDef + 12);

// 2. Inject the override: just before switch(WSl){...}
// Original: 'p!==void 0;){var WSl=31&p,jSl=31&p>>5,FSl=31&p>>10;switch(WSl){'
// We need: 'p!==void 0;){var WSl=31&p,jSl=31&p>>5,FSl=_bT[WSl*32+jSl]>=0?_bT[WSl*32+jSl]:31&p>>10;switch(WSl){'

// Actually, FSl needs to be computed from p AND from our table.
// Let's replace the whole variable declaration:
var oldDecl = 'p!==void 0;){var WSl=31&p,jSl=31&p>>5,FSl=31&p>>10;switch(WSl){';
var newDecl = 'p!==void 0;){var WSl=31&p,jSl=31&p>>5,FSl=31&p>>10;var _idx=WSl*32+jSl;FSl=_bT[_idx]>=0?_bT[_idx]:FSl;switch(WSl){';

var patched = withTable.replace(oldDecl, newDecl);

if (patched.indexOf(newDecl) < 0) {
    // Try with escaped version
    var escapedOld = oldDecl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    patched = withTable.replace(new RegExp(escapedOld), newDecl);
}

// Verify injection
if (patched === withTable) {
    console.error('Injection NOT found in code!');
    console.error('Searching for pattern...');
    var idx = originalCode.indexOf('p!==void 0;){var WSl=');
    console.error('Found at index:', idx);
    if (idx >= 0) {
        console.error('Context:', originalCode.substring(idx, idx + 60));
    }
    process.exit(1);
}

console.log('Injection successful');

// Save
fs.writeFileSync(__dirname + '/security-proxy-fsl.js', patched);
console.log('Saved security-proxy-fsl.js (' + patched.length + ' bytes)');

// Quick parse check
try {
    new Function(patched);
    console.log('Parse OK');
} catch(e) {
    console.error('Parse ERROR:', e.message);
}
