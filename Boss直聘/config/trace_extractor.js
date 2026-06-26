/**
 * Deterministic VMP Trace Extractor
 *
 * Takes the EXACT browser trace (1318 encoded states) and extracts
 * the complete linear algorithm by walking each state's chain.
 *
 * This is the community standard approach:
 *   1. Get browser trace → 2. Walk state map → 3. Extract ops → 4. Translate to Python
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// Exact browser trace from MCP (1318 l.apply calls, decoded to states)
var trace = [
    14887,11814,4399,21867,
    3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,
    2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,
    // 16974 × 602
    ...Array(602).fill(16974),
    ...Array(36).fill([10689,16974]).flat(), // interleaved after first 602
    ...Array(392).fill(2164),
    3218,2273,15635,2273,14473,3218,2273,15635,2273,14371,
    3218,2273,15635,2273,7762,3218,
    ...Array(6).fill(1481),
    1219,2096,6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,
    2273,22017,2273,22017,2273,22017,2273,15635,2273,16420,
    2273,15878,12497,3218,14635,2273,15635,2273,10287,3218,
    ...Array(3).fill(1481),
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

console.log('Browser trace length: ' + trace.length);
console.log('Unique states: ' + new Set(trace).size + '\n');

// ===== Walk chain from a state, collecting ALL operations =====
function walkChain(s, maxSteps) {
    var ops = [];
    var seen = new Set();
    for (var i = 0; i < maxSteps; i++) {
        if (seen.has(s)) break;
        seen.add(s);
        var e = stateMap[s];
        if (!e) break;
        if (e.ops && e.ops.length > 0) {
            for (var j = 0; j < e.ops.length; j++) {
                ops.push({ state: s, left: e.ops[j].left, right: e.ops[j].right });
            }
        }
        var next = (e.next || []);
        var chosen = null;
        for (var k = 0; k < next.length; k++) {
            if (typeof next[k] === 'number') { chosen = next[k]; break; }
        }
        if (chosen === null || chosen === s) break;
        s = chosen;
    }
    return ops;
}

// ===== Walk every state in the trace, collect ALL operations =====
var allOps = [];
var processedStates = {};
trace.forEach(function(s) {
    if (processedStates[s]) return;
    processedStates[s] = true;
    var chain = walkChain(s, 40);
    chain.forEach(function(op) { allOps.push(op); });
});

// Remove duplicates (adjacent identical ops from multiple trace entries)
var uniqueOps = [];
for (var i = 0; i < allOps.length; i++) {
    var last = uniqueOps[uniqueOps.length - 1];
    if (last && last.left === allOps[i].left && last.right === allOps[i].right &&
        last.state === allOps[i].state) continue;
    uniqueOps.push(allOps[i]);
}

console.log('Total operations: ' + allOps.length);
console.log('Unique (deduped): ' + uniqueOps.length);
console.log('');

// ===== Map VMP variable names to readable names =====
var renameMap = {};
function readableName(name) {
    if (name === 'arguments[1]') return 'ts';
    if (name === 'arguments[2]') return 'seed';
    if (name === 'arguments[3]') return 'seed_idx';
    if (name.match(/^[a-z]$/i) || name.match(/^[a-z]{2}$/i)) return name; // leaf vars
    if (!renameMap[name]) {
        // Try to infer from operations: look at the first assignment to this var
        renameMap[name] = 'v_' + name;
    }
    return renameMap[name];
}

// ===== Infer variable purpose from operations =====
function inferPurpose(op) {
    var right = op.right;
    // String literal → this variable holds a fragment
    if (right.match(/^"[a-zA-Z0-9_-]{1,20}"$/)) {
        renameMap[op.left] = 's_' + right.replace(/"/g, '');
    }
    // Number literal
    if (right.match(/^\d+$/)) {
        renameMap[op.left] = 'n_' + op.left;
    }
    // Concatenation of strings
    var concat = right.match(/^(\w+)\s*\+\s*(\w+)$/);
    if (concat) {
        renameMap[op.left] = 'cat_' + op.left;
    }
    // l.apply → subroutine
    if (right.indexOf('l.apply') >= 0) {
        renameMap[op.left] = 'fn_' + op.left;
    }
}

// First pass: infer purposes
uniqueOps.forEach(function(op) { inferPurpose(op); });

// Show ALL operations grouped by state type
console.log('=== Algorithm Operations ===\n');

// Group by operation role
var stringFrags = uniqueOps.filter(function(o) { return o.right.match(/^"[^"]*"$/); });
var concats = uniqueOps.filter(function(o) { return o.right.match(/^\w+\s*\+\s*\w+$/); });
var numbers = uniqueOps.filter(function(o) { return !isNaN(o.right); });
var subroutines = uniqueOps.filter(function(o) { return o.right.indexOf('l.apply') >= 0; });
var argAccess = uniqueOps.filter(function(o) { return o.right.indexOf('arguments') >= 0; });
var others = uniqueOps.filter(function(o) {
    return !o.right.match(/^"[^"]*"$/) && !o.right.match(/^\w+\s*\+\s*\w+$/) &&
        isNaN(o.right) && o.right.indexOf('l.apply') < 0 && o.right.indexOf('arguments') < 0;
});

console.log('String fragments (' + stringFrags.length + '):');
stringFrags.forEach(function(o) { console.log('  ' + o.left + ' = ' + o.right); });

console.log('\nConcatenations (' + concats.length + '):');
concats.forEach(function(o) { console.log('  ' + o.left + ' = ' + o.right); });

console.log('\nNumeric constants (' + numbers.length + '):');
numbers.forEach(function(o) { console.log('  ' + o.left + ' = ' + o.right); });

console.log('\nSubroutines (' + subroutines.length + '):');
subroutines.forEach(function(o) { console.log('  ' + o.left + ' = ' + o.right.substring(0, 80)); });

console.log('\nArgument access (' + argAccess.length + '):');
argAccess.forEach(function(o) { console.log('  ' + o.left + ' = ' + o.right); });

console.log('\nOther operations (' + others.length + '):');
others.forEach(function(o) { console.log('  ' + o.left + ' = ' + o.right.substring(0, 120)); });

// ===== Save full trace =====
fs.writeFileSync(__dirname + '/algo_trace.json', JSON.stringify(uniqueOps, null, 2));
console.log('\nSaved algo_trace.json (' + uniqueOps.length + ' operations)');
