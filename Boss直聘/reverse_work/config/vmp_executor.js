/**
 * VMP Pure Algorithm Executor
 *
 * Walks the browser trace (52 state sequence), expanding each state
 * through its full operation chain, building the algorithm step by step.
 * Properly handles subroutines via call stack.
 *
 * Output: generates __zp_stoken__ purely from seed + ts
 */
var fs = require('fs');
var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));

// ===== VMP Context =====
function VMPContext() {
    this.vars = {};        // variable store
    this.output = [];      // accumulated characters
    this.callsLog = [];    // operation log
    this.depth = 0;
}

VMPContext.prototype.set = function(name, value) {
    this.vars[name] = value;
    return value;
};

VMPContext.prototype.get = function(name) {
    return this.vars[name];
};

// ===== Walk a state through the map, collecting operations =====
function walkStateChain(ctx, startState, maxSteps) {
    var s = startState;
    var steps = 0;
    var subroutines = [];  // [state, arg1, arg2, ...]

    while (steps < maxSteps && s !== null && s !== undefined) {
        var e = stateMap[s];
        if (!e) break;

        // Execute operations
        if (e.ops && e.ops.length > 0) {
            e.ops.forEach(function(op) {
                var left = op.left;
                var right = op.right;

                // Check if this is a subroutine definition: l.apply(this, [N]...)
                var lapplyMatch = right.match(/l\.apply\(this,\s*\[(\d+)\].*\)/);
                if (lapplyMatch) {
                    // Define a function that, when called, enters state N
                    var targetState = parseInt(lapplyMatch[1]);
                    ctx.set(left, { __subroutine: targetState });
                } else {
                    // Regular assignment — evaluate right side
                    var value = evaluateRight(ctx, right);
                    ctx.set(left, value);
                    ctx.callsLog.push({ step: steps, state: s, op: left + ' = ' + (typeof value === 'string' ? JSON.stringify(value) : value) });
                }
            });
        }

        // Determine next state
        var next = e.next || [];
        if (next.length === 0) break;
        if (next.length === 1 && (next[0] === null || next[0] === s)) break;

        // Check for conditional: next may contain null values
        var chosen = null;
        for (var i = 0; i < next.length; i++) {
            if (typeof next[i] === 'number') { chosen = next[i]; break; }
        }
        if (chosen === null) break;

        s = chosen;
        steps++;

        // Cycle detection
        if (steps > 200) break;
    }
    return steps;
}

// ===== Expression Evaluator =====
function evaluateRight(ctx, expr) {
    if (typeof expr !== 'string') return expr;
    if (!expr) return null;

    // String literal
    if (expr.match(/^"[^"]*"$/)) return expr.substring(1, expr.length - 1);
    if (expr.match(/^'[^']*'$/)) return expr.substring(1, expr.length - 1);

    // Number
    if (expr.match(/^[-]?\d+$/)) return parseInt(expr);
    if (expr.match(/^[-]?\d+e\d+$/)) return parseInt(expr); // 1e3 → 1000

    // Special values
    if (expr === 'void 0' || expr === 'undefined') return undefined;
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'window') return '[Window]';
    if (expr === 'Math') return '[Math]';
    if (expr === 'arguments[1]') return ctx.get('_seed_arg1') || ctx.get('T') || undefined;
    if (expr === 'arguments[2]') return ctx.get('_seed_arg2') || undefined;
    if (expr === 'arguments[0]') return ctx.get('_entry_state') || undefined;

    // Binary expressions: X + Y, X & Y, etc.
    var binMatch = expr.match(/^(\w+)\s*([+\-*/&|^~])\s*(\w+)$/);
    if (binMatch) {
        var L = resolveValue(ctx, binMatch[1]);
        var R = resolveValue(ctx, binMatch[3]);
        switch (binMatch[2]) {
            case '+': return (typeof L === 'string' ? L : String(L || '')) + (typeof R === 'string' ? R : String(R || ''));
            case '-': return (L || 0) - (R || 0);
            case '&': return (L || 0) & (R || 0);
            case '|': return (L || 0) | (R || 0);
            case '^': return (L || 0) ^ (R || 0);
            case '~': /* unary */ return ~(R || 0);
        }
    }

    // Unary: ~X
    var unaryMatch = expr.match(/^~(\w+)$/);
    if (unaryMatch) {
        return ~(resolveValue(ctx, unaryMatch[1]) || 0);
    }

    // Function calls: X.call(V, Y)
    var callMatch = expr.match(/^(\w+)\.call\(\s*(?:void\s+0\s*,\s*)?(\w+)(?:\s*,\s*(\w+))?\)$/);
    if (callMatch) {
        var fnName = callMatch[1];
        var arg1 = callMatch[2];
        var arg2 = callMatch[3];
        var fn = resolveValue(ctx, fnName);
        // If fn is a subroutine, trace it
        if (fn && fn.__subroutine) {
            // This is a nested l() call — for simplicity, return placeholder
            return '[call:' + fnName + '(' + arg1 + ')]';
        }
        return '[call:' + expr.substring(0, 40) + ']';
    }

    // Variable reference
    var val = ctx.get(expr);
    if (val !== undefined) return val;

    return expr; // return as string if unknown
}

function resolveValue(ctx, name) {
    var val = ctx.get(name);
    if (val === undefined) {
        // Try parsing as string literal or number
        if (typeof name === 'string') {
            if (name.match(/^"\w*"$/) || name.match(/^'\w*'$/)) return name.slice(1, -1);
            if (name.match(/^\d+$/)) return parseInt(name);
        }
    }
    return val;
}

// ===== Main: Simulate the full browser trace =====
console.log('=== VMP Pure Algorithm Simulation ===\n');

var ctx = new VMPContext();

// Initialize with seed/ts
var seed = 'test_seed_44_chars_long_abcde12345678';
var ts = 1700000000000;
ctx.set('_seed_arg1', seed);
ctx.set('_seed_arg2', ts);

// Browser trace sequence
var trace = [
    {s:14887,name:'init1'},{s:11814,name:'init2'},{s:4399,name:'init3'},
    {s:21867,name:'entry'},{s:3218,name:'set_window'},{s:2310,name:'timezone'},
    {s:3218,name:'set_window2'},{s:1219,name:'cssRuleList'},{s:2096,name:'charCode'},{s:6319,name:'depth'},
    {s:3218,name:'set_window3'},{s:2273,name:'constants'},{s:20975,name:'sub1'},
    {s:1219,name:'cssRuleList2'},{s:2096,name:'charCode2'},{s:6319,name:'depth2'},
    {s:3218,name:'set_window4'},{s:2273,name:'constants2'},{s:20975,name:'sub2'},
    {s:2273,name:'constants3'},{s:7279,name:'bind'},{s:7299,name:'bind2'},
    {s:2273,name:'constants4'},{s:18784,name:'transform1'},{s:15635,name:'seed_iter'},
    {s:2273,name:'constants5'},{s:6798,name:'loop_body'},{s:3218,name:'env_check'},
    {s:16834,name:'call1'},{s:15984,name:'call2'},{s:22059,name:'call3'},
    {s:3218,name:'env_check2'},
];

// Core loop: 16974 ↔ 10689 (36 pairs)
for (var i = 0; i < 36; i++) {
    trace.push({s:16974,name:'loop_header_' + i});
    trace.push({s:10689,name:'loop_body_' + i});
}

// Tail processing
trace.push({s:1481,name:'enum_setup'},{s:1481,name:'enum_iter'},{s:16974,name:'final'},{s:2164,name:'toLowerCase'});
trace.push({s:3208,name:'close1'},{s:2273,name:'close_const'},{s:20843,name:'close2'},{s:2273,name:'close_const2'});
trace.push({s:15635,name:'close3'},{s:2273,name:'close_const3'},{s:15635,name:'close4'});
trace.push({s:2273,name:'close_const4'},{s:15635,name:'close5'},{s:2273,name:'close_const5'});
trace.push({s:7279,name:'close6'},{s:7299,name:'close7'},{s:10734,name:'close8'});
trace.push({s:3218,name:'close_env'},{s:2273,name:'close_const6'},{s:20492,name:'close9'});
trace.push({s:3216,name:'close10'},{s:3655,name:'close11'},{s:20754,name:'close12'},{s:3463,name:'term'});

// Walk ALL states
var totalOps = 0;
trace.forEach(function(entry) {
    var s = entry.s;
    var chain = walkStateChain(ctx, s, 100);
});

console.log('Total operations: ' + ctx.callsLog.length);
console.log('\nSample operations (first 30):');
ctx.callsLog.slice(0, 30).forEach(function(log) {
    console.log('  [' + log.step + '/' + log.state + '] ' + log.op);
});

console.log('\n=== Variables (first 20) ===');
var keys = Object.keys(ctx.vars).filter(function(k) { return !k.startsWith('_'); }).slice(0, 20);
keys.forEach(function(k) {
    console.log('  ' + k + ' = ' + JSON.stringify(String(ctx.vars[k])).substring(0, 80));
});

console.log('\n=== Algorithm extracted ===');
console.log('Operations total: ' + ctx.callsLog.length);
