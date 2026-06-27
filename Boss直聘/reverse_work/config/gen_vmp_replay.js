/**
 * Generate VMP REPLAY JS — forces exact browser path
 *
 * Strategy: Replace ALL p = N assignments with p = __TRACE[__POS++]
 * This forces the VMP to replay the browser's exact state sequence.
 *
 * Output: security-replay.js
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

// Load browser trace (ALL p values, including nested calls)
var browserTraceRaw = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8');
var browserTrace = browserTraceRaw.split('\n')
    .filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

console.log('Browser trace:', browserTrace.length, 'states');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK');

// Inject trace replay
var traverse = require('@babel/traverse').default;
var injections = 0;

traverse(ast, {
    AssignmentExpression: function(path) {
        var node = path.node;
        if (!t.isIdentifier(node.left) || node.left.name !== 'p') return;
        // Only replace p = <numeric> assignments
        if (!t.isNumericLiteral(node.right)) return;

        // Must be inside l()
        var ancestor = path.parentPath;
        var insideL = false;
        while (ancestor) {
            if (ancestor.node && ancestor.node.type === 'FunctionDeclaration' &&
                ancestor.node.id && ancestor.node.id.name === 'l') {
                insideL = true; break;
            }
            ancestor = ancestor.parentPath;
        }
        if (!insideL) return;

        // Replace: p = N  →  p = __sp(N)
        // __sp is a helper: function __sp(n){return __P<__T.length?__T[__P++]:n}
        var newAssign = t.assignmentExpression(
            '=',
            t.identifier('p'),
            t.callExpression(
                t.identifier('__sp'),
                [t.numericLiteral(node.right.value)]
            )
        );
        path.replaceWith(newAssign);
        injections++;
    }
});

console.log('Replaced', injections, 'p-assignments with trace replay');

// Generate output
var output = generator(ast).code;

// Prepend the trace array and position counter
var traceArrayStr = '[' + browserTrace.join(',') + ']';
var preamble = 'var __T=' + traceArrayStr + ',__P=0;function __sp(n){return __P<__T.length?__T[__P++]:n}\n';

// Insert the preamble right before function l() definition
// Find: function l(){try{... and insert trace before it
var lIdx = output.indexOf('function l(){try{');
if (lIdx < 0) lIdx = output.indexOf('function l(){');

if (lIdx > 0) {
    // Insert before the entire IIFE that contains l()
    // Find a good insertion point
    var insertIdx = output.indexOf('}(),function(){', lIdx - 500);
    if (insertIdx < 0) insertIdx = output.indexOf('}(),function(){');
    if (insertIdx < 0) insertIdx = output.lastIndexOf('}(),function (){', lIdx);
    if (insertIdx < 0) insertIdx = 0;

    output = output.substring(0, insertIdx + 4) + preamble + output.substring(insertIdx + 4);
} else {
    output = preamble + output;
}

fs.writeFileSync(__dirname + '/security-replay.js', output);
console.log('Saved security-replay.js (' + output.length + ' bytes)');
console.log('Sample trace:', browserTrace.slice(0, 5));
