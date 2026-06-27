/**
 * Pure VMP Executor v2 — with proper subroutine call stack
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

var seed = process.argv[2] || 'test_seed_44_chars_long_abcde12345678';
var gTs = parseInt(process.argv[3] || '1700000000000');

var callStack = [];  // [{ state, vars, returnVar }]
var execLog = [];

// ── Eval ──
function evalRight(expr, _vars) {
    var v = _vars;
    if (typeof expr !== 'string') return expr;
    var sm = expr.match(/^"([\s\S]*)"$/); if (sm) return sm[1];
    if (/^\d+$/.test(expr)) return parseInt(expr);
    if (expr === 'void 0') return undefined;
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    var bm = expr.match(/^(\w+)\s*([+\-*/&|^])\s*(\w+)$/);
    if (bm) {
        var L = resolve(bm[1], v), R = resolve(bm[3], v);
        switch (bm[2]) {
            case '+': return ((L != null) ? String(L) : '') + ((R != null) ? String(R) : '');
            case '-': return (L||0) - (R||0);
            case '&': return (L||0) & (R||0);
            case '|': return (L||0) | (R||0);
            case '^': return (L||0) ^ (R||0);
        }
    }
    var nm = expr.match(/^~(\w+)$/); if (nm) return ~(resolve(nm[1], v)||0);
    return resolve(expr, v);
}

function resolve(name, _vars) {
    var v = _vars;
    if (v[name] !== undefined) return v[name];
    if (name === 'arguments[1]') return v._arg1 !== undefined ? v._arg1 : seed;
    if (name === 'arguments[2]') return v._arg2 !== undefined ? v._arg2 : gTs;
    if (name === 'arguments[0]') return v._entry;
    if (name === 'window') return '[Window]';
    if (name === 'Math') return Math;
    // Built-in globals that VMP calls
    if (name === 'parseInt') return parseInt;
    if (name === 'String') return String;
    if (name === 'RegExp') return RegExp;
    if (name === 'Array') return Array;
    return undefined;
}

// ── Walk a state through the map ──
function walkStates(entryState, maxSteps, _vars, entryArgs) {
    var s = entryState;
    var sVars = Object.assign({}, _vars || {});
    if (entryArgs) {
        sVars._entry = entryState;
        sVars._arg1 = entryArgs[1];
        sVars._arg2 = entryArgs[2];
        sVars._arg3 = entryArgs[3];
    }
    var seen = new Set();
    var steps = 0;

    while (steps < maxSteps) {
        if (seen.has(s)) { /* console.log('  cycle at', s); */ break; }
        seen.add(s);

        var e = stateMap[s];
        if (!e) { /* console.log('  missing state', s); */ break; }

        // Execute ops
        if (e.ops && e.ops.length > 0) {
            for (var i = 0; i < e.ops.length; i++) {
                var op = e.ops[i];
                if (op.right.indexOf('l.apply') >= 0) {
                    // Subroutine reference: var fn = function(){return l.apply(this, [N].concat(args))}
                    var m = op.right.match(/\[(\d+)\]/);
                    if (m) {
                        var subState = parseInt(m[1]);
                        // Store as callable function
                        sVars[op.left] = {
                            __sub_state: subState,
                            __call: function() { return 'sub'; }
                        };
                    }
                    continue;
                }
                try {
                    var val = evalRight(op.right, sVars);
                    sVars[op.left] = val;
                } catch(e) {}
            }
        }

        // Pick next
        var next = (e.next || []);
        var nState = null;
        for (var j = 0; j < next.length; j++) {
            if (typeof next[j] === 'number') { nState = next[j]; break; }
        }
        if (nState === null || nState === s) break;
        s = nState;
        steps++;
    }

    return { finalState: s, vars: sVars, steps: steps };
}

// ── Top-level walk from entry 21867 ──
console.log('=== Pure VMP Executor v2 ===');

var result = walkStates(21867, 500, {}, undefined);

console.log('Walked', result.steps, 'steps to state', result.finalState);
var v = result.vars;

// Show key string variables
console.log('\n=== String values ===');
for (var k in v) {
    if (typeof v[k] === 'string' && v[k].length > 0 && !v[k].startsWith('[')) {
        console.log('  ' + k + ' = ' + JSON.stringify(v[k].substring(0, 80)));
    }
}

// Show subroutines defined
console.log('\n=== Subroutines ===');
for (var k in v) {
    if (v[k] && v[k].__sub_state !== undefined) {
        console.log('  ' + k + ' → state=' + v[k].__sub_state);
    }
}

// Now follow each subroutine call sequence
console.log('\n=== Walking subroutines ===');

// Walk the important sub states
var subStates = {};
for (var k in v) {
    if (v[k] && v[k].__sub_state !== undefined) {
        var subSt = v[k].__sub_state;
        if (!subStates[subSt]) {
            var subResult = walkStates(subSt, 100, result.vars, undefined);
            subStates[subSt] = subResult;
            console.log('\nSub ' + k + ' (entry state=' + subSt + '): ' + subResult.steps + ' steps');
            for (var sk in subResult.vars) {
                if (typeof subResult.vars[sk] === 'string' && subResult.vars[sk].length > 0
                    && subResult.vars[sk].length < 60 && !subResult.vars[sk].startsWith('[')) {
                    console.log('  ' + sk + ' = ' + JSON.stringify(subResult.vars[sk]));
                }
            }
        }
    }
}
