/**
 * VMP Path Simulator
 *
 * Strategy: Execute the VMP in Node.js but FORCE the browser's state transitions.
 *
 * How it works:
 *   1. Inject code at EVERY p=N assignment in function l():
 *      Before: p = N
 *      After:  p = window.__browserPath[p] ?? N  (use browser value if available)
 *   2. window.__browserPath maps: p_old → p_new (from browser trace)
 *   3. For each state, the VMP runs normally but when it tries to set p=N,
 *      we override with the browser's value if available.
 *   4. This forces the VMP to follow the exact browser path.
 *
 * Output: security-forced-path.js
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

// Load browser trace and build next-p mapping
var browserTraceRaw = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8');
var browserTrace = browserTraceRaw.split('\n')
    .filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build: for each p value in trace, what's the UNIQUE next p?
// Since the same p can appear multiple times (in loops), we take the
// MODE (most common) next value
var nextPCounts = {};
for (var i = 0; i < browserTrace.length - 1; i++) {
    var cur = browserTrace[i];
    var next = browserTrace[i + 1];
    if (!nextPCounts[cur]) nextPCounts[cur] = {};
    nextPCounts[cur][next] = (nextPCounts[cur][next] || 0) + 1;
}

var browserPath = {};
Object.keys(nextPCounts).forEach(function(cur) {
    var counts = nextPCounts[cur];
    var bestNext = null, bestCount = 0;
    Object.keys(counts).forEach(function(next) {
        if (counts[next] > bestCount) {
            bestCount = counts[next];
            bestNext = parseInt(next);
        }
    });
    browserPath[cur] = bestNext;
});

console.log('Browser path mapping:', Object.keys(browserPath).length, 'entries');
console.log('Sample mappings:');
var samples = Object.keys(browserPath).slice(0, 10);
samples.forEach(function(k) {
    console.log('  ' + k + ' → ' + browserPath[k]);
});

// ===== Parse security JS =====
var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK');

// ===== Inject path forcing =====
var traverse = require('@babel/traverse').default;
var injections = 0;

traverse(ast, {
    // Target: p = <numeric> assignments inside function l()
    AssignmentExpression: function(path) {
        var node = path.node;
        if (!t.isIdentifier(node.left) || node.left.name !== 'p') return;
        if (!t.isNumericLiteral(node.right)) return;

        // Must be inside function l()
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

        var pValue = node.right.value;

        // Only inject if this p value has a different browser path
        // (to avoid unnecessary overhead for already-correct transitions)
        // But we inject ALL to catch edge cases
        if (!browserPath[pValue] && !browserTrace.includes(pValue)) return;

        // Replace: p = N  →  p = (__bp[N] !== void 0 ? __bp[N] : N)
        var replacement = t.assignmentExpression(
            '=',
            t.identifier('p'),
            t.conditionalExpression(
                t.binaryExpression(
                    '!==',
                    t.memberExpression(
                        t.identifier('__bp'),
                        t.numericLiteral(pValue),
                        true
                    ),
                    t.unaryExpression('void', t.numericLiteral(0))
                ),
                t.memberExpression(
                    t.identifier('__bp'),
                    t.numericLiteral(pValue),
                    true
                ),
                t.numericLiteral(pValue)
            )
        );

        path.replaceWith(replacement);
        injections++;
    }
});

console.log('Injected', injections, 'path overrides');

// Generate output
var output = generator(ast).code;

// Add the __bp definition as a preamble
var preamble = 'var __bp = ' + JSON.stringify(browserPath) + ';\n';
output = preamble + output;

fs.writeFileSync(__dirname + '/security-forced-path.js', output);
console.log('Saved security-forced-path.js (' + output.length + ' bytes)');

// Also save browserPath for use in runner
fs.writeFileSync(__dirname + '/browser_path.json', JSON.stringify(browserPath));
console.log('Saved browser_path.json');
