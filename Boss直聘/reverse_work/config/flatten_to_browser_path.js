/**
 * FLATTEN VMP to browser path by hardcoding branch decisions
 *
 * Strategy:
 *   1. Parse security-11f5a2fc.js
 *   2. For each CER dispatch point in function l():
 *      a. If there's only ONE branch (no hp dispatch) → keep it
 *      b. If there are hp branches → check which one the browser took
 *         by looking at the browser trace
 *   3. Replace the dispatch with the browser's chosen branch
 *   4. This yields a deterministic JS that follows the browser's exact path
 *
 * Output: security-browser-flat.js
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(node) { return generator(node).code; }
var fs = require('fs');

// ===== Load browser trace and build next-p lookup =====
var browserTraceRaw = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8');
var browserTrace = browserTraceRaw.split('\n')
    .filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build: for each p value, what was the NEXT p value the browser went to?
// This is essentially: trace[i] → trace[i+1] ... but wait, each trace entry
// IS a p=N assignment. The "next" p after processing p=X is the next trace entry.
var browserNextP = {};
for (var i = 0; i < browserTrace.length - 1; i++) {
    var currentP = browserTrace[i];
    var nextP = browserTrace[i + 1];
    // Don't overwrite if we already have a value (keep first occurrence)
    if (!(currentP in browserNextP)) {
        browserNextP[currentP] = nextP;
    }
}

console.log('Browser trace:', browserTrace.length, 'states');
console.log('Browser next-p lookup:', Object.keys(browserNextP).length, 'entries');

// ===== Parse security JS =====
var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });
console.log('Parsed OK,', code.length, 'bytes');

// ===== HELPERS =====
function findPInNode(node) {
    if (!node) return null;
    if (t.isAssignmentExpression(node) && t.isIdentifier(node.left) && node.left.name === 'p') {
        if (t.isNumericLiteral(node.right)) return node.right.value;
        return findPInNode(node.right);
    }
    if (t.isSequenceExpression(node)) {
        for (var i = node.expressions.length - 1; i >= 0; i--) {
            var v = findPInNode(node.expressions[i]); if (v !== null) return v;
        }
    }
    if (t.isConditionalExpression(node)) {
        return findPInNode(node.consequent) || findPInNode(node.alternate);
    }
    return null;
}

function isHpCheck(testNode) {
    if (!t.isBinaryExpression(testNode) || testNode.operator !== '===') return false;
    var left = testNode.left, right = testNode.right;
    return (t.isNumericLiteral(left) && t.isIdentifier(right) && right.name === 'hp') ||
           (t.isNumericLiteral(right) && t.isIdentifier(left) && left.name === 'hp');
}

// ===== MAIN TRANSFORMATION =====
var replacements = 0;
var traverse = require('@babel/traverse').default;

traverse(ast, {
    // Find all hp dispatch ternary chains
    ConditionalExpression: function(path) {
        var node = path.node;

        // Only handle hp dispatch: 0===hp ? branch0 : 1===hp ? branch1 : ...
        if (!isHpCheck(node.test)) return;

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

        // Find browser-chosen branch:
        // 1. Compute the p value for EACH hp branch
        // 2. Determine the CURRENT p value (from outer switch context)
        // 3. Look up what the browser did

        var branches = [];
        var cur = node;
        while (cur && t.isConditionalExpression(cur) && isHpCheck(cur.test)) {
            var hpVal = (t.isNumericLiteral(cur.test.left) ? cur.test.left : cur.test.right).value;
            var nextP = findPInNode(cur.consequent);
            branches.push({ hp: hpVal, next: nextP, node: cur.consequent });
            cur = cur.alternate;
        }

        // Try to determine the browser's chosen hp value
        // We need to know the CURRENT state. Look up in an outer scope.
        // For now, we'll check ALL branches against the browser trace
        // by looking at the outer dispatch context

        // Let's walk up to find the enclosing switch case to get Cbl/Ebl/Rbl
        var swCase = path.findParent(function(p) {
            return t.isSwitchCase(p.node) && p.node.test && t.isNumericLiteral(p.node.test);
        });
        if (!swCase) return;

        // Find the outer switch depth
        var depth = 0;
        var p2 = path.parentPath;
        while (p2) {
            if (p2.node && t.isSwitchStatement(p2.node)) depth++;
            p2 = p2.parentPath;
        }

        // For hp dispatch at Rbl level (depth 3), we need Cbl, Ebl, Rbl
        // We can compute possible p values and check browser trace
        // But this is complex. Let's try a different approach.

        // Count hp branches
        var hpCount = branches.length;
        if (hpCount === 0) return;

        // SIMPLE HEURISTIC: compute p for each hp branch,
        // and choose the one that either:
        //   a) Appears in the browser trace
        //   b) Is the only valid option
        // We'll do a smarter analysis in v2

        // For now: try to match by checking if branch hp=0 leads to known path
        // Default to hp=0 if no better info (this is wrong but gets us started)
    }
});

console.log('Replacements (Phase 1 - hp chains):', replacements);

// ===== Phase 2: Direct state → p lookup =====
// For each p=N assignment inside l(), check if the browser
// went to a DIFFERENT p. If so, there might be a nested l() call
// in between that we need to account for.

// Write intermediate output
var output = generator(ast).code;
fs.writeFileSync(__dirname + '/security-browser-flat.js', output);
console.log('Saved security-browser-flat.js (' + output.length + ' bytes)');
console.log('Same as input for now - need to complete hp resolution');
