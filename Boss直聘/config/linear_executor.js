/**
 * Linear VMP Executor — walk browser trace directly
 *
 * browserTrace = sequence of states the VMP actually visited
 * For each state: execute ops from stateMap, take next from browserTrace
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

var seed = process.argv[2] || 'test_seed_44_chars_long_abcde12345678';
var gTs = parseInt(process.argv[3] || '1700000000000');

// Full browser trace (flattened from MCP capture)
var trace = [
    14887,11814,4399,21867,3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,16974,16974,16974,16974,16974,16974,
    16974,16974,16974,16974,16974,16974,16974,16974,16974,16974,16974,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,
    2164,2164,2164,2164,2164,2164,2164,2164,2164,2164,
    3218,2273,15635,2273,14473,3218,2273,15635,2273,14371,
    3218,2273,15635,2273,7762,3218,1481,1481,1481,1481,1481,1481,
    1219,2096,6319,3218,2273,20975,15635,2273,1194,3218,2273,22017,
    2273,22017,2273,22017,2273,22017,2273,15635,2273,16420,
    2273,15878,12497,3218,14635,2273,15635,2273,10287,3218,
    1481,1481,1481,2273,2273,2273,2273,2273,2273,2273,
    15635,2273,14704,15635,2273,5285,3218,15635,2273,1709,
    15635,2273,397,15635,2273,6735,2273,15635,2273,16420,
    2273,15635,2273,13760,2051,3218,2273,2273,2273,2273,2273,2273,2273,2273,
    15635,2273,18928,15635,2273,14406,15635,2273,7178,
    3218,2273,15635,2273,7279,7299,2273,20906,3208,
    2273,20843,2273,3208,2273,20843,2273,
    15635,2273,15635,2273,15635,2273,7279,7299,10734,
    3218,2273,20492,3216,3655,20754,3463
];

console.log('=== Linear Executor ===');
console.log('Trace length: ' + trace.length);

var vars = {};
var execCount = 0;

// Eval helpers
function evalExpr(expr, v) {
    var s = expr;
    if (typeof s !== 'string') return s;
    var qm = s.match(/^"([\s\S]*)"$/); if (qm) return qm[1];
    if (/^\d+$/.test(s)) return parseInt(s);
    if (/^\d+e\d+$/.test(s)) return 1000;
    if (s === 'void 0') return undefined;
    if (s === 'true') return true; if (s === 'false') return false;

    var bm = s.match(/^(\w+)\s*([+\-*/&|^])\s*(\w+)$/);
    if (bm) {
        var L = (v[bm[1]] != null ? v[bm[1]] : bm[1]);
        var R = (v[bm[3]] != null ? v[bm[3]] : bm[3]);
        if (typeof L === 'string' && !isNaN(R)) L = isNaN(parseInt(L)) ? L : parseInt(L);
        if (typeof R === 'string' && !isNaN(L)) R = isNaN(parseInt(R)) ? R : parseInt(R);
        switch (bm[2]) {
            case '+': return (L != null ? String(L) : '') + (R != null ? String(R) : '');
            case '-': return (L||0) - (R||0);
            case '&': return (L||0) & (R||0);
            case '|': return (L||0) | (R||0);
            case '^': return (L||0) ^ (R||0);
        }
    }

    var nm = s.match(/^~(\w+)$/); if (nm) return ~((v[nm[1]]||0));

    // Variable lookup
    if (v[s] !== undefined) return v[s];
    // Arguments
    if (s === 'arguments[1]') return seed;
    if (s === 'arguments[2]') return gTs;
    // Builtins
    if (s === 'window') return '[Window]';
    if (s === 'Math') return Math;

    return undefined;
}

// Walk a single state: execute ops, follow chain to next state
function walkFromState(startState, maxSteps, _vars) {
    var state = startState;
    var seen = new Set();
    for (var i = 0; i < maxSteps; i++) {
        if (seen.has(state)) break;
        seen.add(state);

        var e = stateMap[state];
        if (!e) break;

        // Execute non-subroutine ops
        if (e.ops && e.ops.length > 0) {
            for (var j = 0; j < e.ops.length; j++) {
                var op = e.ops[j];
                if (op.right.indexOf('l.apply') >= 0) {
                    var m = op.right.match(/\[(\d+)\]/);
                    if (m) _vars[op.left] = { __sub: parseInt(m[1]) };
                    continue;
                }
                try {
                    _vars[op.left] = evalExpr(op.right, _vars);
                    execCount++;
                } catch(e2) {}
            }
        }

        // Next state
        var next = (e.next || []);
        var nState = null;
        for (var k = 0; k < next.length; k++) {
            if (typeof next[k] === 'number') { nState = next[k]; break; }
        }
        if (nState === null || nState === state) break;
        state = nState;
    }
    return _vars;
}

// Execute ALL states in trace sequentially, walking each one
for (var ti = 0; ti < trace.length; ti++) {
    vars = walkFromState(trace[ti], 50, vars);
}

console.log('Ops executed: ' + execCount);
console.log('');

// Show key strings
console.log('=== String variables ===');
for (var k in vars) {
    if (typeof vars[k] === 'string' && vars[k].length > 1 && vars[k].length < 100) {
        console.log(k + ' = ' + JSON.stringify(vars[k]));
    }
}

// Show subroutines
console.log('\n=== Subroutines ===');
for (var k in vars) {
    if (vars[k] && vars[k].__sub !== undefined) {
        console.log(k + ' → state=' + vars[k].__sub);
    }
}
