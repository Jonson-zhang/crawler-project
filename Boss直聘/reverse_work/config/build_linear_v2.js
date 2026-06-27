/**
 * Build Linear VMP v2: replace ONLY the for-loop body inside l()
 * Keep everything else (including ABC creation logic)
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// 1. Collect ALL browser-visited + chain states
var visited = new Set([
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
]);

// Expand chain
function expand(s, max) {
    if (max <= 0 || !s) return;
    visited.add(s);
    var e = stateMap[s];
    if (!e) return;
    (e.next || []).forEach(function(n) {
        if (typeof n === 'number' && !visited.has(n)) expand(n, max - 1);
    });
}
var sizeBefore = visited.size;
visited.forEach(function(s) { expand(s, 20); });
console.log('States: ' + sizeBefore + ' + chain = ' + visited.size);

// 2. Build linear case blocks
var cases = [];
visited.forEach(function(s) {
    var e = stateMap[s];
    if (!e) return;
    var body = '';
    if (e.ops && e.ops.length > 0) {
        var realOps = e.ops.filter(function(o) { return o.right.indexOf('l.apply') < 0; });
        if (realOps.length > 0) {
            body = realOps.map(function(o) { return o.left + '=' + o.right; }).join(',');
        }
    }
    var next = (e.next || []).filter(function(n) { return typeof n === 'number'; })[0];
    var nextStr = 'p=' + (next !== undefined ? next : 'void 0');
    cases.push('case ' + s + ':' + (body ? body + ',' : '') + nextStr + ';break;');
});

// 3. Build new for loop body (with switch wrapper)
var newForBody = '{switch(p){' + cases.join('') + 'default:p=void 0;break;}}';

// 4. Replace inside l(): find the for loop and replace its body
// Pattern in original: 'for(var p=arguments[0],...,p!==void 0;){...}'
// Find the for loop
var lStart = code.indexOf('function l(){');
var forStart = code.indexOf('for(', lStart);
var forBodyStart = code.indexOf('){', forStart) + 2; // after '){'
// Find matching }
var depth = 1;
var forBodyEnd = forBodyStart;
while (depth > 0) {
    if (code[forBodyEnd] === '{') depth++;
    else if (code[forBodyEnd] === '}') depth--;
    forBodyEnd++;
}
forBodyEnd--; // back to the closing }

// Replace
var before = code.substring(0, forBodyStart);
var after = code.substring(forBodyEnd);
var patched = before + newForBody + after;

fs.writeFileSync(__dirname + '/security-linear-v2.js', patched);
console.log('Saved security-linear-v2.js (' + patched.length + ' bytes)');
