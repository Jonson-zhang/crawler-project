/**
 * Pure VMP Executor — walks browser trace through state map linearly
 * Input: seed, ts
 * Output: __zp_stoken__
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

var seed = process.argv[2] || 'test_seed_44_chars_long_abcde12345678';
var gTs = parseInt(process.argv[3] || '1700000000000');

// ── VMP Context ──
var vars = {};  // variable store
var log = [];   // operation log

function set(name, value) { vars[name] = value; return value; }
function get(name) { return vars[name]; }

// ── Expression evaluator ──
function evalRight(expr) {
    if (typeof expr !== 'string') return expr;

    // String literal: "abc" → abc
    var strMatch = expr.match(/^"([\s\S]*)"$/);
    if (strMatch) return strMatch[1];

    // Number
    if (/^\d+$/.test(expr)) return parseInt(expr);
    if (expr === 'void 0') return undefined;
    if (expr === 'true') return true;
    if (expr === 'false') return false;

    // Binary: A + B, A & B, A | B, A ^ B, A - B, etc.
    var binMatch = expr.match(/^(\w+)\s*([+\-*/&|^~])\s*(\w+)$/);
    if (binMatch) {
        var L = resolve(binMatch[1]), R = resolve(binMatch[3]);
        if (typeof L === 'string' && typeof R !== 'string') L = L || '';
        if (typeof R === 'string' && typeof L !== 'string') R = R || '';
        switch (binMatch[2]) {
            case '+': return (L != null ? L : '') + (R != null ? R : '');
            case '-': return (L||0) - (R||0);
            case '&': return (L||0) & (R||0);
            case '|': return (L||0) | (R||0);
            case '^': return (L||0) ^ (R||0);
        }
    }
    // ~X
    var notMatch = expr.match(/^~(\w+)$/);
    if (notMatch) return ~(resolve(notMatch[1])||0);

    // Function calls: X.call(Y, Z) or Y.call(void 0, Z)
    var callMatch = expr.match(/^(\w+)\.call\(\s*(?:void\s+0\s*,)?\s*(\w+)(?:\s*,\s*(\w+))?\s*\)$/);
    if (callMatch) {
        var calleeVal = resolve(callMatch[1]);
        var arg1Val = resolve(callMatch[2]);
        var arg2Val = callMatch[3] ? resolve(callMatch[3]) : undefined;
        if (typeof calleeVal === 'function') {
            return calleeVal.call(void 0, arg1Val, arg2Val);
        }
        // Methods on strings: "hello".charCodeAt(0)
        if (callMatch[2] && vars[callMatch[2]] !== undefined) {
            var obj = vars[callMatch[2]];
            var fn = callMatch[1];
            if (obj && typeof obj[fn] === 'function') {
                return obj[fn].call(obj, arg2Val);
            }
        }
        return '[call:' + expr.substring(0,30) + ']';
    }

    // method call: X = _[v] followed by r.call(_) — already decomposed
    // Simple variable reference or unknown
    var val = resolve(expr);
    if (val !== undefined) return val;
    return expr; // keep as string for unknowns
}

function resolve(name) {
    if (name == null) return undefined;
    // Direct variable lookup
    if (vars[name] !== undefined) return vars[name];
    // arguments[1] → seed, arguments[2] → ts
    if (name === 'arguments[1]') return seed;
    if (name === 'arguments[2]') return gTs;
    if (name === 'window') return '[Window]';
    if (name === 'Math') return {};
    return undefined;
}

// ── Walk a single state's chain ──
function walkState(startState, maxSteps) {
    var s = startState;
    var steps = [];
    var seen = new Set();
    for (var i = 0; i < maxSteps; i++) {
        if (seen.has(s)) break;
        seen.add(s);
        var e = stateMap[s];
        if (!e) break;
        if (e.ops && e.ops.length > 0) {
            steps.push({ state: s, ops: e.ops });
        }
        var next = (e.next || []);
        var chosen = null;
        for (var j = 0; j < next.length; j++) {
            if (typeof next[j] === 'number') { chosen = next[j]; break; }
        }
        if (chosen === null || chosen === s) break;
        s = chosen;
    }
    return steps;
}

// ── Execute a single operation ──
function execOp(op) {
    if (op.right.indexOf('l.apply') >= 0) return; // skip subroutines
    try {
        var val = evalRight(op.right);
        set(op.left, val);
    } catch(e) {
        // Skip errors silently
    }
}

// ── Main execution loop ──
// Use the state map to follow the VMP from entry state
var entryState = 21867; // browser trace entry
var allSeen = new Set();
var current = entryState;

console.log('=== Pure VMP Executor ===');
console.log('Entry state: ' + entryState);

// Walk the FULL path from 21867, following single-path next states
var path = [];
var state = entryState;
var totalOps = 0;
var deadEnds = 0;

while (state !== null && path.length < 5000) {
    if (path.indexOf(state) >= 0) break; // cycle
    path.push(state);

    var entry = stateMap[state];
    if (!entry) { deadEnds++; break; }

    // Execute operations
    if (entry.ops && entry.ops.length > 0) {
        entry.ops.forEach(execOp);
        totalOps += entry.ops.length;
    }

    // Pick next state (first numeric)
    var next = (entry.next || []);
    var nState = null;
    for (var i = 0; i < next.length; i++) {
        if (typeof next[i] === 'number') { nState = next[i]; break; }
    }
    if (nState === null || nState === state) {
        deadEnds++;
        // Use the browser trace as guide: find the next state in the trace
        // Browser trace path: 21867→3714→9766→...→3463
        break;
    }
    state = nState;
}

console.log('Path length:', path.length);
console.log('Total ops executed:', totalOps);
console.log('Dead ends:', deadEnds);
console.log('Final state:', state);

// Show key variables
console.log('\n=== Key Variables ===');
var interesting = ['za','Ua','Ha','Op','Ip','Wp','ja','Fa','Ka','D','N','L','G','P','V','tp','_p','ep','yp','pp','oq','Fl','Kl','Hl','Zl','Ql','r','v','n','o','i','g','E','C','T','M','A','x'];
interesting.forEach(function(k) {
    if (vars[k] !== undefined) console.log('  ' + k + ' = ' + JSON.stringify(vars[k]));
});

// Show ALL string variables (potential token fragments)
console.log('\n=== String Variables ===');
for (var k in vars) {
    if (typeof vars[k] === 'string' && vars[k].length > 0 && vars[k].length < 100) {
        console.log('  ' + k + ' = ' + JSON.stringify(vars[k]));
    }
}
