/**
 * VMP Bytecode Interpreter
 *
 * Walks through the state map, maintaining a variable store,
 * executing operations, and following conditional branches.
 *
 * Usage: node vmp_interpreter.js <seed> <ts>
 */
var fs = require('fs');

var stateMap = JSON.parse(fs.readFileSync(__dirname + '/vmp_state_map.json', 'utf8'));
console.log('Loaded ' + Object.keys(stateMap).length + ' VMP states');

// Symbol table: tracks all variable values
var vars = {};

// === Interpreter ===
function interpret(startState, seed, ts) {
    var state = startState;
    var steps = 0;
    var maxSteps = 50000;
    var trace = [];  // operations log

    // Initialize known variables
    // From the MD5 module and browser context
    vars['window'] = '[object Window]';
    vars['navigator'] = '[object Navigator]';
    vars['document'] = '[object HTMLDocument]';
    vars['location'] = '[object Location]';
    vars['screen'] = '[object Screen]';
    vars['M'] = 0;       // often used as numeric accumulator
    vars['undefined'] = undefined;

    // Track the call stack for l.apply() calls
    var callStack = [];

    while (state !== null && state !== undefined && steps < maxSteps) {
        var entry = stateMap[state];
        if (!entry) {
            console.error('State ' + state + ' not found at step ' + steps);
            // Try to continue with first call stack entry
            if (callStack.length > 0) {
                state = callStack.pop();
                console.log('  Resuming from call stack: state=' + state);
                continue;
            }
            break;
        }

        // Check if this state creates a function via l.apply(this, [N].concat(args))
        // These are "call" states that push the current context and jump to a new state
        var ops = entry.ops || [];
        var hasLApply = false;
        for (var i = 0; i < ops.length; i++) {
            if (ops[i].right && ops[i].right.indexOf('l.apply') >= 0) {
                // Extract the target state from l.apply(this, [TARGET].concat(...))
                var targetMatch = ops[i].right.match(/\[(\d+)\]/);
                if (targetMatch) {
                    var targetState = parseInt(targetMatch[1]);
                    // This is a function assignment: var fn = function(){return l.apply(this,[N].concat(args))}
                    // The function is stored in a variable (ops[i].left)
                    // We need to know WHEN this function is called. For now, treat it as a subroutine.
                    // Store the function reference
                    vars[ops[i].left] = { type: 'subroutine', target: targetState };
                    hasLApply = true;
                    trace.push({ step: steps, state: state, op: ops[i].left + ' = subroutine(' + targetState + ')' });
                }
            }
        }

        // If this state has l.apply calls, they're subroutines.
        // For now, we don't automatically follow them — we need the caller to invoke them.
        // The VMP interleaves subroutine definitions with calls.

        // Execute non-l.apply operations
        if (!hasLApply) {
            for (var i = 0; i < ops.length; i++) {
                var op = ops[i];
                if (op.right && op.right.indexOf('l.apply') < 0) {
                    // Evaluate right side
                    var value = evalExpr(op.right);
                    vars[op.left] = value;
                    trace.push({ step: steps, state: state, op: op.left + ' = ' + (typeof value === 'string' ? JSON.stringify(value) : value) });
                }
            }
        }

        // Determine next state
        var nextList = entry.next || [];
        var nextState = null;

        if (nextList.length === 0) {
            // Terminal state
            console.log('Terminal state ' + state + ' at step ' + steps);
            break;
        } else if (nextList.length === 1) {
            nextState = nextList[0];
        } else {
            // Conditional: need to figure out which branch to take
            // For now, try the first numeric path
            for (var i = 0; i < nextList.length; i++) {
                if (typeof nextList[i] === 'number') {
                    nextState = nextList[i];
                    break;
                }
            }
            if (nextState === null) {
                console.log('No valid next state at step ' + steps);
                break;
            }
        }

        state = nextState;
        steps++;
    }

    return { steps: steps, trace: trace };
}

function evalExpr(expr) {
    // Simple evaluator for expressions in state ops
    // Types seen: strings ("..."), numbers, variable references, concatenations (A+B), function calls

    if (typeof expr !== 'string') return expr;

    // String literal
    if (expr.match(/^["'].*["']$/)) {
        return expr.substring(1, expr.length - 1);
    }

    // Number
    if (expr.match(/^\d+$/)) {
        return parseInt(expr);
    }

    // Boolean
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'void 0') return undefined;
    if (expr === 'undefined') return undefined;

    // Binary operation (concatenation, arithmetic, bitwise)
    var binMatch = expr.match(/^(\w+)\s*([+\-*/&|^~])\s*(.+)$/);
    if (binMatch) {
        var left = vars[binMatch[1]] !== undefined ? vars[binMatch[1]] : binMatch[1];
        var right = vars[binMatch[3]] !== undefined ? vars[binMatch[3]] : binMatch[3];
        if (typeof right === 'string' && right.match(/^\d+$/)) right = parseInt(right);

        switch (binMatch[2]) {
            case '+': return (typeof left === 'number' ? left : 0) + (typeof right === 'number' ? right : 0) || (String(left) + String(right));
            case '-': return left - right;
            case '&': return left & right;
            case '|': return left | right;
            case '^': return left ^ right;
            case '~': return ~left;
        }
    }

    // Variable reference or simple expression
    if (vars[expr] !== undefined) return vars[expr];

    // Function call: X.call(Y, Z)
    var callMatch = expr.match(/^(\w+)\.call\(/);
    if (callMatch) {
        // Complex — return as string identifier
        return '[call:' + expr.substring(0, 50) + ']';
    }

    return expr;
}

// === Run ===
var seed = process.argv[2] || 'test_seed_44_chars_long_abcde12345678';
var ts = parseInt(process.argv[3] || '1700000000000');

// Entry state from browser trace
var entryState = 21867;

console.log('\n=== Interpreting from state ' + entryState + ' ===');
var result = interpret(entryState, seed, ts);

console.log('Steps: ' + result.steps);
console.log('Operations: ' + result.trace.length);
console.log('\nOperations trace:');
result.trace.forEach(function(t) {
    console.log('  [' + t.step + '/' + t.state + '] ' + t.op);
});
