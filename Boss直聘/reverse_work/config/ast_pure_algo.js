/**
 * AST-level Pure Algorithm Generation
 *
 * Strategy:
 *   1. Parse security-11f5a2fc.js
 *   2. Walk ALL p = <expr> assignments inside l()
 *   3. For conditionals (p = X ? A : B): look at browser trace to determine choice
 *   4. Replace conditionals with the browser-chosen branch
 *   5. For ladder chains (F===0?A:F===1?B:...): keep only browser-chosen branch
 *   6. Replace typeof/env checks with browser values (from Camoufox compare_env)
 *   7. Output: security-pure.js — deterministic algorithm
 *
 * This replicates the community's approach:
 *   AST脱壳 → 剪枝 → 硬编码typeof检查
 */
var parser = require('@babel/parser');
var t = require('@babel/types');
var generator = require('@babel/generator').default;
function gen(n) { return generator(n).code; }
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');
var ast = parser.parse(code, { sourceType: 'script', errorRecovery: true });

// Load browser trace — build p→next_p map
var browserTrace = fs.readFileSync(__dirname + '/traces/browser_vmp_trace.txt', 'utf8')
    .split('\n').filter(function(l) { return l.startsWith('VMP:'); })
    .map(function(l) { return parseInt(l.split(':')[1]); });

// Build: for each unique p, what's the next p (most common)?
var nextCounts = {};
for (var i = 0; i < browserTrace.length - 1; i++) {
    var cp = browserTrace[i], np = browserTrace[i + 1];
    if (!nextCounts[cp]) nextCounts[cp] = {};
    nextCounts[cp][np] = (nextCounts[cp][np] || 0) + 1;
}
var browserNext = {};
Object.keys(nextCounts).forEach(function(p) {
    var best = null, bestCnt = 0;
    Object.keys(nextCounts[p]).forEach(function(np) {
        if (nextCounts[p][np] > bestCnt) { bestCnt = nextCounts[p][np]; best = parseInt(np); }
    });
    browserNext[parseInt(p)] = best;
});

// Build: for each unique p, what's its most common CER?
var cerCounts = {};
browserTrace.forEach(function(p) {
    var cb = p & 31, eb = (p >> 5) & 31, rb = (p >> 10) & 31;
    var key = cb + '_' + eb + '_' + rb;
    if (!cerCounts[p]) cerCounts[p] = {};
    cerCounts[p][key] = (cerCounts[p][key] || 0) + 1;
});

console.log('Browser next-p map:', Object.keys(browserNext).length, 'entries');

// ===== Browser environment values (from Camoufox compare_env) =====
var browserEnv = {
    'navigator.userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    'navigator.platform': 'Win32',
    'navigator.language': 'zh-CN',
    'navigator.hardwareConcurrency': 32,
    'navigator.webdriver': false,
    'navigator.cookieEnabled': true,
    'navigator.maxTouchPoints': 0,
    'navigator.vendor': '',
    'navigator.onLine': true,
    'navigator.doNotTrack': '1',
    'navigator.plugins.length': 5,
    'navigator.mimeTypes.length': 2,
    'screen.width': 1680,
    'screen.height': 1050,
    'screen.colorDepth': 24,
    'window.innerWidth': 1680,
    'window.innerHeight': 915,
};

// ===== HELPERS =====
function findPValue(node) {
    if (!node) return null;
    if (t.isAssignmentExpression(node) && t.isIdentifier(node.left) && node.left.name === 'p') {
        if (t.isNumericLiteral(node.right)) return node.right.value;
        return findPValue(node.right);
    }
    if (t.isSequenceExpression(node)) {
        for (var i = node.expressions.length - 1; i >= 0; i--) {
            var v = findPValue(node.expressions[i]); if (v !== null) return v;
        }
    }
    if (t.isConditionalExpression(node)) {
        return findPValue(node.consequent) || findPValue(node.alternate);
    }
    if (t.isCallExpression(node)) {
        var c = node.callee;
        if (t.isMemberExpression(c) && c.property.name === 'apply') {
            var fn = c.object;
            if (t.isFunctionExpression(fn) && fn.body.body[0]) {
                return findPValue(fn.body.body[0]);
            }
        }
    }
    return null;
}

function isInsideL(path) {
    var anc = path.parentPath;
    while (anc) {
        if (anc.node && anc.node.type === 'FunctionDeclaration' &&
            anc.node.id && anc.node.id.name === 'l') return true;
        anc = anc.parentPath;
    }
    return false;
}

var traverse = require('@babel/traverse').default;
var replacements = { cond_p: 0, ternary_chain: 0, typeof_fix: 0 };

// ===== PHASE 1: Resolve conditional p = X ? A : B =====
traverse(ast, {
    AssignmentExpression: function(path) {
        var node = path.node;
        if (!t.isIdentifier(node.left) || node.left.name !== 'p') return;
        if (!isInsideL(path)) return;

        // Check if RHS is a conditional: p = expr ? p=N1 : p=N2
        if (!t.isConditionalExpression(node.right)) return;

        var cond = node.right;
        var valA = findPValue(cond.consequent);
        var valB = findPValue(cond.alternate);

        if (valA === null || valB === null) return;

        // Determine which branch the browser took
        // We need to know the current p value, but that's set dynamically.
        // Instead, use browserNext to check which next-p appears in trace.

        // Check: does valA appear as a next state for some p?
        // This is imperfect but works for cases where the choice is unambiguous.
        var aInTrace = browserTrace.indexOf(valA) >= 0;
        var bInTrace = browserTrace.indexOf(valB) >= 0;

        // Heuristic: if one value appears in trace and the other doesn't
        if (aInTrace && !bInTrace) {
            path.replaceWith(t.assignmentExpression('=', t.identifier('p'), t.numericLiteral(valA)));
            replacements.cond_p++;
        } else if (bInTrace && !aInTrace) {
            path.replaceWith(t.assignmentExpression('=', t.identifier('p'), t.numericLiteral(valB)));
            replacements.cond_p++;
        }
        // If both appear, we need more context — skip for now
    }
});

console.log('Phase 1: Resolved', replacements.cond_p, 'conditional p-assignments');

// ===== PHASE 2: Collapse Rbl ternary chains =====
// Pattern: 0===Rbl ? (ops, p=N1) : 1===Rbl ? (ops, p=N2) : ... : void 0
traverse(ast, {
    ConditionalExpression: function(path) {
        var node = path.node;
        if (!isInsideL(path)) return;

        var test = node.test;
        var isRblCheck = false;
        if (t.isBinaryExpression(test) && test.operator === '===') {
            if ((t.isNumericLiteral(test.left) && t.isIdentifier(test.right) && test.right.name === 'Rbl') ||
                (t.isNumericLiteral(test.right) && t.isIdentifier(test.left) && test.left.name === 'Rbl')) {
                isRblCheck = true;
            }
        }
        if (!isRblCheck) return;

        // Walk the chain and find browser-matched branch
        var branches = [];
        var cur = node;
        while (cur && t.isConditionalExpression(cur)) {
            var rblVal = null;
            var ct = cur.test;
            if (t.isBinaryExpression(ct) && ct.operator === '===') {
                rblVal = t.isNumericLiteral(ct.left) ? ct.left.value :
                         t.isNumericLiteral(ct.right) ? ct.right.value : null;
            }
            if (rblVal === null) break;

            var nextP = findPValue(cur.consequent);
            branches.push({ rbl: rblVal, next: nextP, node: cur.consequent });
            cur = cur.alternate;
        }

        // For each branch, check if its next-p appears in browser trace
        // This is a simplification — we need the current Cbl+Ebl context
        // to accurately determine which branch the browser took.
        // For now: check if the consequent is a call to .apply()
        // (which wraps hp dispatch) — if so, we need to go deeper.

        // Simple heuristic: if a branch has nextP that matches browser pattern
        for (var bi = 0; bi < branches.length; bi++) {
            var b = branches[bi];
            if (b.next !== null && browserNext[b.next]) {
                // This branch's next state IS in the browser trace
                // Collapse: replace entire chain with just this branch
                path.replaceWith(b.node);
                replacements.ternary_chain++;
                path.stop(); // stop traversing this path
                return;
            }
        }
    }
});

console.log('Phase 2: Collapsed', replacements.ternary_chain, 'ternary chains');

// ===== PHASE 3: Replace typeof checks with browser values =====
// We can't fully do this in AST at this level, but we can mark them

// ===== Generate output =====
var output = generator(ast).code;
fs.writeFileSync(__dirname + '/security-pure.js', output);
console.log('Saved security-pure.js (' + output.length + ' bytes)');
console.log('Size reduction:', ((1 - output.length / code.length) * 100).toFixed(1) + '%');
