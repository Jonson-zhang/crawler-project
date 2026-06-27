/**
 * Simple patch: directly replace typeof results in the state map,
 * then re-walk. No AST, no code injection. Just JSON editing.
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// Browser visited states
var bVisited = new Set([14887,11814,4399,21867,3218,2310,1219,2096,6319,2273,20975,7279,7299,18784,15635,6798,16834,15984,22059,16974,10689,2164,14473,14371,7762,1481,1194,22017,16420,15878,12497,14635,10287,14704,5285,1709,397,6735,13760,2051,18928,14406,7178,20906,3208,20843,10734,20492,3216,3655,20754,3463]);

// Count states where ops check typeof
var typeofPatches = 0;
for (var k in stateMap) {
    var e = stateMap[k];
    if (!e.ops) continue;
    for (var i = 0; i < e.ops.length; i++) {
        var o = e.ops[i];
        // typeof check on a variable — if the state is visited, assume it's a browser check
        if (o.right.indexOf('typeof') >= 0 && bVisited.has(parseInt(k))) {
            // Replace: X = typeof Y  →  X = "function" (harsh assumption)
            // Better: check if the variable was built from property name concatenation
            typeofPatches++;
        }
    }
}
console.log('typeof ops in visited states:', typeofPatches);

// Better approach: for each VISITED state chain, look at what typeof ops produce
// and what the previous op built (property name)
// Walk 21867 chain and show typeof ops with context
function walkChain(start, max) {
    var s = start, seen = new Set(), i = 0, ops = [];
    while (i < max && !seen.has(s)) {
        seen.add(s); i++;
        var e = stateMap[s];
        if (!e) break;
        if (e.ops) ops.push({state: s, ops: e.ops});
        var n = (e.next||[]).filter(function(x){return typeof x==='number'})[0];
        if (!n || n === s) break;
        s = n;
    }
    return ops;
}

var chain = walkChain(21867, 100);
console.log('\nChain from 21867:');
chain.forEach(function(step) {
    step.ops.forEach(function(o) {
        if (o.right === 'window' || o.right === '[Window]') {
            console.log('['+step.state+'] WINDOW_REF: ' + o.left);
        }
        if (o.right.indexOf('typeof') >= 0) {
            console.log('['+step.state+'] TYPEOF: ' + o.left + ' = ' + o.right);
        }
        if (o.right.match(/^\w+\[\w+\]$/)) {
            console.log('['+step.state+'] PROP_ACCESS: ' + o.left + ' = ' + o.right + ' (browser value needed!)');
        }
    });
});
