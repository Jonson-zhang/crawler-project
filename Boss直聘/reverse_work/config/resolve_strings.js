/**
 * STRING RESOLUTION — trace the string-building chains
 *
 * The VMP builds strings by concatenating short fragments:
 *   o = "g" → y = "Strin" → v = y + o → v = "String"
 *
 * This script:
 *   1. Loads all browser-trace operations
 *   2. Tracks variable → value mappings
 *   3. Resolves string concatenations
 *   4. Outputs resolved operations (no string-building noise)
 *
 * Output: resolved_ops.json — clean operation list
 */
var fs = require('fs');

var ops = JSON.parse(fs.readFileSync(__dirname + '/pure_operations.json', 'utf8'));

// ===== Parse each operation =====
// Pattern types:
//   varName = "literal"        → string literal
//   varName = number           → numeric constant
//   varName = varA + varB      → concatenation
//   varName = varA + "literal" → mixed concat
//   varName = varA | varB      → bitwise
//   varName = typeof varA      → typeof check
//   varName = !varA            → negation
//   p = varA ? N1 : N2        → conditional jump
//   varName = function(){...} → function definition

var varMap = {};  // variable → resolved value
var resolvedOps = [];
var stats = { literal: 0, concat: 0, math: 0, cond: 0, fn: 0, other: 0, resolved: 0 };

function resolveExpr(expr) {
    // Replace variable references with known values
    var resolved = expr;
    // Try to replace = varA + varB with known values
    var m = resolved.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) return { orig: expr, resolved: null };

    var varName = m[1];
    var rhs = m[2].trim();

    // Check if RHS is a single literal
    if (/^"[^"]*"$/.test(rhs)) {
        var val = JSON.parse(rhs);
        varMap[varName] = { type: 'string', value: val };
        stats.literal++;
        return { orig: expr, var: varName, type: 'literal', value: val };
    }

    // Check if RHS is a single number
    if (/^-?\d+$/.test(rhs)) {
        var val = parseInt(rhs);
        varMap[varName] = { type: 'number', value: val };
        return { orig: expr, var: varName, type: 'number', value: val };
    }

    // Check if RHS is varA + varB (string concat)
    var concatMatch = rhs.match(/^(\w+)\s*\+\s*(\w+)$/);
    if (concatMatch) {
        var a = varMap[concatMatch[1]];
        var b = varMap[concatMatch[2]];
        if (a && a.type === 'string' && b && b.type === 'string') {
            var val = a.value + b.value;
            varMap[varName] = { type: 'string', value: val };
            stats.concat++;
            stats.resolved++;
            return { orig: expr, var: varName, type: 'resolved_concat', parts: [concatMatch[1], concatMatch[2]], value: val };
        }
        if (a && a.type === 'number' && b && b.type === 'number') {
            var val = a.value + b.value;
            varMap[varName] = { type: 'number', value: val };
            stats.concat++;
            stats.resolved++;
            return { orig: expr, var: varName, type: 'resolved_concat', value: val };
        }
        stats.concat++;
        return { orig: expr, var: varName, type: 'concat', a: concatMatch[1], b: concatMatch[2] };
    }

    // Check if RHS is varA + "literal"
    var mixedMatch = rhs.match(/^(\w+)\s*\+\s*("[^"]*")$/);
    if (mixedMatch) {
        var a = varMap[mixedMatch[1]];
        var lit = JSON.parse(mixedMatch[2]);
        if (a && a.type === 'string') {
            var val = a.value + lit;
            varMap[varName] = { type: 'string', value: val };
            stats.resolved++;
            return { orig: expr, var: varName, type: 'resolved_mixed', value: val };
        }
        return { orig: expr, var: varName, type: 'mixed_concat' };
    }

    // Check for bitwise/math operations
    if (/[&|^~]/.test(rhs) && !rhs.includes('"') && !rhs.includes("'")) {
        stats.math++;
        return { orig: expr, var: varName, type: 'math' };
    }

    // Check for typeof
    if (rhs.startsWith('typeof ')) {
        return { orig: expr, var: varName, type: 'typeof' };
    }

    // Check for !var
    if (rhs.match(/^!\w+$/)) {
        return { orig: expr, var: varName, type: 'not' };
    }

    // Check for function definition
    if (rhs.startsWith('function')) {
        stats.fn++;
        return { orig: expr, var: varName, type: 'function', fnDef: rhs };
    }

    // Check for conditional
    if (rhs.match(/^\w+\s*\?\s*\d+\s*:\s*\d+$/)) {
        stats.cond++;
        return { orig: expr, var: varName, type: 'conditional' };
    }

    stats.other++;
    return { orig: expr, var: varName, type: 'other' };
}

ops.operations.forEach(function(op, i) {
    var result = resolveExpr(op.ops);
    result.idx = i;
    result.cer = op.cer;
    result.p = op.p;
    resolvedOps.push(result);
});

// ===== Show resolved strings =====
console.log('=== String resolution stats ===');
console.log('Literals:', stats.literal);
console.log('Concatenations:', stats.concat, '(resolved:', stats.resolved, ')');
console.log('Math ops:', stats.math);
console.log('Conditionals:', stats.cond);
console.log('Functions:', stats.fn);
console.log('Other:', stats.other);

// Print all resolved strings
console.log('\n=== All resolved strings (length>=3) ===');
var strings = {};
resolvedOps.forEach(function(op) {
    if (op.type === 'literal' || op.type === 'resolved_concat' || op.type === 'resolved_mixed') {
        if (op.value && typeof op.value === 'string' && op.value.length >= 3) {
            var key = '_s_' + op.value;
            if (!strings[key]) strings[key] = [];
            strings[key].push(op.var);
        }
    }
});

Object.keys(strings).sort(function(a,b){return b.length-a.length}).slice(0, 40).forEach(function(k) {
    console.log('  ' + k.substring(3) + ' ← ' + strings[k].join(', '));
});

// Save
fs.writeFileSync(__dirname + '/resolved_ops.json', JSON.stringify(resolvedOps, null, 2));
console.log('\nSaved resolved_ops.json (' + resolvedOps.length + ' entries)');

// Generate clean JS with resolved strings
var cleanLines = [];
cleanLines.push('// Clean algorithm with resolved strings');
cleanLines.push('// Generated from browser VMP trace');
cleanLines.push('');

var knownVars = {}; // Track which variables we've seen

resolvedOps.forEach(function(op) {
    if (op.type === 'literal' && op.value && op.value.length >= 3) {
        // Don't emit single-char literals (they're building blocks)
        // Only emit the final resolved string
        return;
    }
    if (op.type === 'resolved_concat' || op.type === 'resolved_mixed') {
        // Emit the final resolved value
        cleanLines.push('var ' + op.var + ' = ' + JSON.stringify(op.value) + ';  // was: ' + op.orig);
        return;
    }
    if (op.type === 'number') {
        // Emit numeric constants
        cleanLines.push('var ' + op.var + ' = ' + op.value + ';');
        return;
    }
    // For unresolved concat, emit as-is
    if (op.type === 'concat') {
        cleanLines.push('var ' + op.var + ' = ' + op.a + ' + ' + op.b + ';  // unresolved');
        return;
    }
});

fs.writeFileSync(__dirname + '/strings_resolved.js', cleanLines.join('\n'));
console.log('Saved strings_resolved.js (' + cleanLines.length + ' lines)');
