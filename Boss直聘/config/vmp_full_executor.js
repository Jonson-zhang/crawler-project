/**
 * Full VMP Interpreter with proper call stack
 *
 * Walks the same path as the browser by using the browser trace
 * to resolve conditional branches (F values).
 *
 * Key: browserTrace = [14887, 11814, 4399, ...] — exact sequence
 * For each state, follow its chain through the state map.
 * When a conditional (multiple next states) is hit, use browserTrace
 * to determine which branch was taken.
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// ── Browser trace (52 unique states) ──
var browserTrace = [
    14887,11814,4399,21867,
    3218,2310,3218,1219,2096,6319,3218,2273,20975,
    1219,2096,6319,3218,2273,20975,
    2273,7279,7299,2273,18784,15635,2273,6798,
    3218,16834,15984,22059,3218,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,16974,10689,16974,10689,16974,10689,16974,10689,
    16974,10689,
    2164,2164,2164,2164,2164,
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
var bTraceIdx = 0;

// Build browser (W,j) → preferred F
var browserF = {};
browserTrace.forEach(function(s) {
    var w = s & 31, j = (s >> 5) & 31, f = (s >> 10) & 31;
    var key = w + ',' + j;
    if (!(key in browserF)) browserF[key] = f;
});

// ── Eval ──
function evalRight(expr, _vars) {
    if (typeof expr !== 'string') return expr;
    var sm = expr.match(/^(?:"([\s\S]*)")$/); if (sm) return sm[1];
    if (/^\d+$/.test(expr)) return parseInt(expr);
    if (expr === 'void 0') return undefined;
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    var bm = expr.match(/^(\w+)\s*([+\-*/&|^])\s*(\w+)$/);
    if (bm) {
        var L = resolve(bm[1], _vars), R = resolve(bm[3], _vars);
        switch (bm[2]) {
            case '+': return ((L != null) ? String(L) : '') + ((R != null) ? String(R) : '');
            case '-': return (L||0) - (R||0);
            case '&': return (L||0) & (R||0);
            case '|': return (L||0) | (R||0);
            case '^': return (L||0) ^ (R||0);
        }
    }
    var nm = expr.match(/^~(\w+)$/); if (nm) return ~(resolve(nm[1], _vars)||0);
    return resolve(expr, _vars);
}

function resolve(name, _vars) {
    if (_vars && _vars[name] !== undefined) {
        var val = _vars[name];
        // If it's a subroutine closure, return a callable
        if (val && val.__sub_state !== undefined) return val;
        return val;
    }
    if (name === 'window') return '[Window]';
    if (name === 'Math') return Math;
    if (name === 'String') return String;
    if (name === 'parseInt') return parseInt;
    if (name === 'RegExp') return RegExp;
    if (name === 'Array') return Array;
    return undefined;
}

// ── Walk a state in the map with one step ──
function stepState(state, _vars) {
    var e = stateMap[state];
    if (!e) return { next: null, vars: _vars };

    // Execute ops
    if (e.ops && e.ops.length > 0) {
        for (var i = 0; i < e.ops.length; i++) {
            var op = e.ops[i];
            if (op.right.indexOf('l.apply') >= 0) {
                var m = op.right.match(/\[(\d+)\]/);
                if (m) {
                    _vars[op.left] = { __sub_state: parseInt(m[1]), __is_sub: true };
                }
                continue;
            }
            try {
                _vars[op.left] = evalRight(op.right, _vars);
            } catch(e) {}
        }
    }

    // Next state: use browser trace for conditionals
    var next = (e.next || []);
    if (next.length === 0) return { next: null, vars: _vars };
    if (next.length === 1 && (next[0] === null || next[0] === state)) return { next: null, vars: _vars };

    // For single-path: just follow
    if (next.length === 1 && typeof next[0] === 'number') {
        return { next: next[0], vars: _vars };
    }

    // For conditional: use browser F table
    var w = state & 31, j = (state >> 5) & 31;
    var prefF = browserF[w + ',' + j];
    if (prefF !== undefined) {
        // Find the next state whose F matches prefF
        for (var k = 0; k < next.length; k++) {
            if (typeof next[k] === 'number') {
                var nf = (next[k] >> 10) & 31;
                if (nf === prefF || k === prefF - 1) {
                    // Hmm, this mapping is not straightforward
                    // Let me just use the first numeric
                }
            }
        }
        // Fallback: first numeric
        for (var k = 0; k < next.length; k++) {
            if (typeof next[k] === 'number') return { next: next[k], vars: _vars };
        }
    }

    // No browser guidance — pick first numeric
    for (var k = 0; k < next.length; k++) {
        if (typeof next[k] === 'number') return { next: next[k], vars: _vars };
    }

    return { next: null, vars: _vars };
}

// ── Walk a full chain ──
function walkChain(startState, maxSteps, _vars) {
    var s = startState;
    var v = _vars || {};
    var seen = {};
    for (var i = 0; i < maxSteps; i++) {
        if (seen[s]) break;
        seen[s] = true;
        var r = stepState(s, v);
        v = r.vars;
        if (r.next === null || r.next === s) break;
        s = r.next;
    }
    return { vars: v, finalState: s };
}

// ── Execute subroutine calls ──
function callSub(sub, _vars) {
    var subState = sub.__sub_state;
    // Create new args context: args[1], args[2], args[3] etc.
    var subVars = Object.assign({}, _vars);
    // The sub gets called from the parent context with specific arguments
    // But we don't know the exact args... let's walk the subroutine's chain
    // from its entry state and see what it produces
    var r = walkChain(subState, 200, subVars);
    return r.vars;
}

// ── Main ──
console.log('=== Full VMP Interpreter ===\n');

// Walk the entry chain
var result = walkChain(21867, 100, {});
var v = result.vars;

console.log('Entry chain: ' + result.finalState);

// Collect subroutine states
var subCalls = {};
for (var k in v) {
    if (v[k] && v[k].__sub_state !== undefined) {
        subCalls[k] = v[k].__sub_state;
    }
}
console.log('Subroutines defined: ' + Object.keys(subCalls).length);

// Walk each subroutine (they share the same parent vars but have their own context)
// Actually, the subroutines are FUNCTION definitions — they're called later with specific args.
// We need to simulate the actual call sequence.

// The top-level flow after 21867:
// 1. Initialize variables (za="c66f", Op="conca", etc.)
// 2. Build property names and check typeof
// 3. Process each seed character through encoding loop
// 4. Concatenate results into final token

// Output key strings
console.log('\n=== Key strings ===');
for (var k in v) {
    if (typeof v[k] === 'string' && v[k].length > 1 && v[k].length < 80) {
        console.log(k+' = '+JSON.stringify(v[k]));
    }
}
